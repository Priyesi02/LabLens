from contextlib import asynccontextmanager
from datetime import datetime, time as dt_time, timedelta
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo
import asyncio
import os
import re
import tempfile
import uuid

import pdfplumber
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from twilio.rest import Client

from backend.auth.cognito_verifier import verify_cognito_token
from backend.db import appointments_collection, medications_collection, reports_collection
from backend.doctor_search import search_nearby_doctors
from backend.parser import parse_lab_values
from backend.pipeline import run_analysis_pipeline
from backend.translation import translate_to_hindi


# =========================================================
# PATHS AND PERSISTENT STORAGE
# =========================================================
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploaded_reports"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_TIMEZONE = os.getenv("APP_TIMEZONE", "Asia/Kolkata")
DAY_REMINDER_HOUR = int(os.getenv("DAY_REMINDER_HOUR", "9"))
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")

if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_PHONE_NUMBER:
    print(
        "[Twilio] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, "
        "or TWILIO_PHONE_NUMBER in environment."
    )
    twilio_client = None
else:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


# =========================================================
# HELPERS
# =========================================================
def normalize_name(name: str):
    if not name:
        return "unknown"

    normalized = name.lower().strip()
    normalized = re.sub(r"[^a-z0-9 ]", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized or "unknown"


def make_patient_key(email: str, patient_name: str):
    return f"{email.lower().strip()}::{normalize_name(patient_name)}"


def validate_phone_number(phone_number: str):
    cleaned = phone_number.strip().replace(" ", "").replace("-", "")

    if not re.fullmatch(r"\+[1-9]\d{7,14}", cleaned):
        raise HTTPException(
            status_code=400,
            detail="Phone number must use E.164 format, for example +919876543210.",
        )

    return cleaned


def send_sms(phone_number: str, message: str):
    """Send one SMS using Twilio."""
    phone_number = validate_phone_number(phone_number)

    if twilio_client is None:
        raise RuntimeError(
            "Twilio is not configured. Add TWILIO_ACCOUNT_SID, "
            "TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env."
        )

    twilio_message = twilio_client.messages.create(
        body=message,
        from_=TWILIO_PHONE_NUMBER,
        to=phone_number,
    )

    print(
        f"[SMS] Sent to {phone_number}. "
        f"Message SID={twilio_message.sid}"
    )
    return {
        "sid": twilio_message.sid,
        "status": getattr(twilio_message, "status", None),
    }


def get_appointment_datetime(appointment: dict):
    timezone_name = appointment.get("timezone") or DEFAULT_TIMEZONE

    try:
        timezone = ZoneInfo(timezone_name)
    except Exception:
        timezone = ZoneInfo(DEFAULT_TIMEZONE)

    date_text = appointment["appointment_date"]
    time_text = appointment["appointment_time"]
    naive_datetime = datetime.strptime(
        f"{date_text} {time_text}",
        "%Y-%m-%d %H:%M",
    )

    return naive_datetime.replace(tzinfo=timezone)


def find_appointment(appointment_id: str):
    return appointments_collection.find_one({"id": appointment_id}, {"_id": 0})


def find_medication(medication_id: str):
    return medications_collection.find_one({"id": medication_id}, {"_id": 0})


def get_medication_date_range(medication: dict):
    start = datetime.strptime(medication["start_date"], "%Y-%m-%d").date()
    end = start + timedelta(days=int(medication["duration_days"]) - 1)
    return start, end


def validate_time_slots(times):
    cleaned = []
    for t in times:
        t = str(t).strip()
        try:
            datetime.strptime(t, "%H:%M")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid time '{t}'. Use 24-hour HH:MM format, e.g. 09:00.",
            )
        cleaned.append(t)

    if not cleaned:
        raise HTTPException(
            status_code=400,
            detail="At least one reminder time is required.",
        )

    return cleaned


async def check_appointment_reminders():
    """
    Check all future appointments and send:
    1. A reminder on the appointment day at/after 9 AM.
    2. A reminder when the appointment is within one hour.

    Reminder flags are persisted so the same SMS is not sent twice.
    """
    appointments_snapshot = list(
        appointments_collection.find({"status": "scheduled"}, {"_id": 0})
    )

    for appointment in appointments_snapshot:
        try:
            appointment_datetime = get_appointment_datetime(appointment)
            now = datetime.now(appointment_datetime.tzinfo)
            seconds_until = (appointment_datetime - now).total_seconds()

            if seconds_until <= 0:
                continue

            doctor_name = appointment.get("doctor_name", "your doctor")
            hospital = appointment.get("hospital", "the clinic")
            display_time = appointment_datetime.strftime("%I:%M %p")
            display_date = appointment_datetime.strftime("%d %B %Y")
            phone_number = appointment["phone_number"]

            day_reminder_due = (
                appointment_datetime.date() == now.date()
                and now.time() >= dt_time(DAY_REMINDER_HOUR, 0)
                and not appointment.get("day_reminder_sent", False)
            )

            one_hour_reminder_due = (
                0 < seconds_until <= 3600
                and not appointment.get("one_hour_reminder_sent", False)
            )

            if day_reminder_due:
                day_message = (
                    "LabLens Appointment Reminder\n"
                    f"You have an appointment today with {doctor_name}.\n"
                    f"Time: {display_time}\n"
                    f"Location: {hospital}\n"
                    "Please carry your medical reports and current prescriptions."
                )

                await asyncio.to_thread(send_sms, phone_number, day_message)

                appointments_collection.update_one(
                    {"id": appointment["id"]},
                    {"$set": {
                        "day_reminder_sent": True,
                        "day_reminder_sent_at": now.isoformat(),
                    }},
                )

            if one_hour_reminder_due:
                hour_message = (
                    "LabLens Appointment Reminder\n"
                    f"Your appointment with {doctor_name} starts in about 1 hour.\n"
                    f"Time: {display_time}\n"
                    f"Location: {hospital}\n"
                    "Please leave on time and carry your reports."
                )

                await asyncio.to_thread(send_sms, phone_number, hour_message)

                appointments_collection.update_one(
                    {"id": appointment["id"]},
                    {"$set": {
                        "one_hour_reminder_sent": True,
                        "one_hour_reminder_sent_at": now.isoformat(),
                    }},
                )

        except Exception as exc:
            print(
                "[Appointments] Reminder check failed for "
                f"{appointment.get('id')}: {exc}"
            )


async def appointment_reminder_loop():
    while True:
        try:
            await check_appointment_reminders()
        except Exception as exc:
            print(f"[Appointments] Reminder loop error: {exc}")

        await asyncio.sleep(30)


async def check_medication_reminders():
    """
    For every active medication, check each configured time slot for today.
    Sends one SMS per (date, time) slot, tracked in 'sent_reminders' so
    nothing is sent twice even if the loop restarts.
    Medications past their duration are auto-marked 'completed'.
    """
    medications_snapshot = list(
        medications_collection.find({"status": "active"}, {"_id": 0})
    )

    for medication in medications_snapshot:
        try:
            timezone_name = medication.get("timezone") or DEFAULT_TIMEZONE
            try:
                timezone = ZoneInfo(timezone_name)
            except Exception:
                timezone = ZoneInfo(DEFAULT_TIMEZONE)

            now = datetime.now(timezone)
            start_date, end_date = get_medication_date_range(medication)

            if now.date() > end_date:
                medications_collection.update_one(
                    {"id": medication["id"], "status": "active"},
                    {"$set": {"status": "completed"}},
                )
                continue

            if now.date() < start_date:
                continue

            sent_reminders = set(medication.get("sent_reminders", []))
            reminders_changed = False
            phone_number = medication["phone_number"]
            medicine_name = medication.get("medicine_name", "your medicine")
            dosage = medication.get("dosage", "")
            instructions = medication.get("instructions", "")

            for slot in medication.get("times", []):
                slot_time = datetime.strptime(slot, "%H:%M").time()
                slot_key = f"{now.date().isoformat()}_{slot}"

                if slot_key in sent_reminders:
                    continue

                if now.time() < slot_time:
                    continue

                slot_datetime = datetime.combine(
                    now.date(), slot_time, tzinfo=timezone
                )
                if (now - slot_datetime).total_seconds() > 3600:
                    # Too late to be a useful reminder, mark sent and skip.
                    sent_reminders.add(slot_key)
                    reminders_changed = True
                    continue

                message = (
                    "LabLens Medication Reminder\n"
                    f"Time to take: {medicine_name}"
                    + (f" ({dosage})" if dosage else "")
                    + "\n"
                    + (f"{instructions}\n" if instructions else "")
                    + f"Scheduled: {slot}"
                )

                await asyncio.to_thread(send_sms, phone_number, message)
                sent_reminders.add(slot_key)
                reminders_changed = True

            if reminders_changed:
                medications_collection.update_one(
                    {"id": medication["id"]},
                    {"$set": {"sent_reminders": sorted(sent_reminders)}},
                )

        except Exception as exc:
            print(
                "[Medications] Reminder check failed for "
                f"{medication.get('id')}: {exc}"
            )


async def medication_reminder_loop():
    while True:
        try:
            await check_medication_reminders()
        except Exception as exc:
            print(f"[Medications] Reminder loop error: {exc}")

        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    appointment_task = asyncio.create_task(appointment_reminder_loop())
    medication_task = asyncio.create_task(medication_reminder_loop())
    print("[Appointments] Reminder scheduler started.")
    print("[Medications] Reminder scheduler started.")

    try:
        yield
    finally:
        appointment_task.cancel()
        medication_task.cancel()

        for task in (appointment_task, medication_task):
            try:
                await task
            except asyncio.CancelledError:
                pass

        print("[Appointments] Reminder scheduler stopped.")
        print("[Medications] Reminder scheduler stopped.")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/uploaded_reports",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploaded_reports",
)


# =========================================================
# APPOINTMENT MODELS
# =========================================================
class AppointmentCreate(BaseModel):
    patient_name: str
    phone_number: str
    doctor_name: str
    hospital: str
    appointment_date: str = Field(
        description="Appointment date in YYYY-MM-DD format"
    )
    appointment_time: str = Field(
        description="Appointment time in 24-hour HH:MM format"
    )
    specialty: Optional[str] = "General Physician"
    timezone: Optional[str] = DEFAULT_TIMEZONE


# =========================================================
# MEDICATION MODELS
# =========================================================
class MedicationCreate(BaseModel):
    patient_name: str
    phone_number: str
    medicine_name: str
    dosage: Optional[str] = ""
    times: list[str] = Field(
        description="Reminder times in 24-hour HH:MM format, e.g. ['09:00', '21:00']"
    )
    start_date: str = Field(description="Start date in YYYY-MM-DD format")
    duration_days: int = Field(
        default=7, ge=1, description="How many days to send reminders"
    )
    instructions: Optional[str] = ""
    timezone: Optional[str] = DEFAULT_TIMEZONE


# =========================================================
# CORE ENDPOINTS
# =========================================================
@app.get("/")
def home():
    return {
        "status": "API running smoothly",
        "appointment_scheduler": "running",
        "medication_scheduler": "running",
        "saved_appointments": appointments_collection.count_documents({}),
        "saved_medications": medications_collection.count_documents({}),
    }


@app.get("/api/patient/has-records")
async def check_patient_records(
    patient_name: str = Query(default=""),
    current_user: dict = Depends(verify_cognito_token),
):
    email = current_user.get("email", "").lower().strip()

    if not email:
        return {"success": True, "hasRecords": False}

    if patient_name:
        query = {"patient_key": make_patient_key(email, patient_name)}
    else:
        query = {"email": email}

    has_records = reports_collection.count_documents(query) > 0

    return {"success": True, "hasRecords": has_records}


@app.get("/api/patient/history")
async def get_patient_history(
    patient_name: str = Query(default=""),
    current_user: dict = Depends(verify_cognito_token),
):
    email = current_user.get("email", "").lower().strip()

    if not email:
        return {"success": True, "history": []}

    if patient_name:
        query = {"patient_key": make_patient_key(email, patient_name)}
    else:
        query = {"email": email}

    history = list(
        reports_collection.find(query, {"_id": 0}).sort("analyzed_at", -1)
    )

    return {"success": True, "history": history}


# =========================================================
# APPOINTMENT ENDPOINTS
# =========================================================
@app.post("/api/appointments")
async def create_appointment(
    payload: AppointmentCreate,
    current_user: dict = Depends(verify_cognito_token),
):
    clean_email = current_user.get("email", "").lower().strip()
    patient_name = payload.patient_name.strip() or "Unknown"
    phone_number = validate_phone_number(payload.phone_number)

    try:
        timezone = ZoneInfo(payload.timezone or DEFAULT_TIMEZONE)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid timezone. Use {DEFAULT_TIMEZONE} for India.",
        )

    try:
        appointment_datetime = datetime.strptime(
            f"{payload.appointment_date} {payload.appointment_time}",
            "%Y-%m-%d %H:%M",
        ).replace(tzinfo=timezone)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Use appointment_date YYYY-MM-DD and appointment_time HH:MM.",
        )

    if appointment_datetime <= datetime.now(timezone):
        raise HTTPException(
            status_code=400,
            detail="Appointment date and time must be in the future.",
        )

    appointment = {
        "id": f"appointment_{uuid.uuid4().hex}",
        "email": clean_email,
        "patient_name": patient_name,
        "phone_number": phone_number,
        "doctor_name": payload.doctor_name.strip() or "Selected Doctor",
        "hospital": payload.hospital.strip() or "Clinic/Hospital",
        "appointment_date": payload.appointment_date,
        "appointment_time": payload.appointment_time,
        "specialty": payload.specialty or "General Physician",
        "timezone": payload.timezone or DEFAULT_TIMEZONE,
        "status": "scheduled",
        "day_reminder_sent": False,
        "one_hour_reminder_sent": False,
        "created_at": datetime.now(timezone).isoformat(),
    }

    appointments_collection.insert_one({**appointment})

    confirmation_message = (
        "LabLens Appointment Saved\n"
        f"Doctor: {appointment['doctor_name']}\n"
        f"Date: {appointment_datetime.strftime('%d %B %Y')}\n"
        f"Time: {appointment_datetime.strftime('%I:%M %p')}\n"
        f"Location: {appointment['hospital']}\n"
        "We will remind you on the appointment day and about 1 hour before."
    )

    sms_sent = True
    sms_error = None

    try:
        await asyncio.to_thread(
            send_sms,
            phone_number,
            confirmation_message,
        )
    except Exception as exc:
        sms_sent = False
        sms_error = str(exc)
        print(f"[Appointments] Confirmation SMS failed: {exc}")

    return {
        "success": True,
        "appointment": appointment,
        "confirmation_sms_sent": sms_sent,
        "sms_error": sms_error,
    }


@app.get("/api/appointments")
async def get_appointments(
    patient_name: str = Query(default=""),
    current_user: dict = Depends(verify_cognito_token),
):
    clean_email = current_user.get("email", "").lower().strip()
    normalized_patient = normalize_name(patient_name) if patient_name else None

    appointments = [
        appointment
        for appointment in appointments_collection.find(
            {"email": clean_email}, {"_id": 0}
        )
        if normalized_patient is None
        or normalize_name(appointment.get("patient_name", "")) == normalized_patient
    ]

    appointments.sort(
        key=lambda item: (
            item.get("appointment_date", ""),
            item.get("appointment_time", ""),
        )
    )

    return {"success": True, "appointments": appointments}


@app.patch("/api/appointments/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: str,
    current_user: dict = Depends(verify_cognito_token),
):
    clean_email = current_user.get("email", "").lower().strip()

    appointment = find_appointment(appointment_id)

    if not appointment or appointment.get("email") != clean_email:
        raise HTTPException(
            status_code=404,
            detail="Appointment not found.",
        )

    appointment["status"] = "cancelled"
    appointment["cancelled_at"] = datetime.now(
        ZoneInfo(appointment.get("timezone", DEFAULT_TIMEZONE))
    ).isoformat()

    appointments_collection.update_one(
        {"id": appointment_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": appointment["cancelled_at"],
        }},
    )

    return {
        "success": True,
        "appointment": appointment,
    }


# =========================================================
# MEDICATION REMINDER ENDPOINTS
# =========================================================
@app.post("/api/medications")
async def create_medication(
    payload: MedicationCreate,
    current_user: dict = Depends(verify_cognito_token),
):
    clean_email = current_user.get("email", "").lower().strip()
    patient_name = payload.patient_name.strip() or "Unknown"
    phone_number = validate_phone_number(payload.phone_number)
    times = validate_time_slots(payload.times)

    if not payload.medicine_name.strip():
        raise HTTPException(status_code=400, detail="Medicine name is required.")

    try:
        timezone = ZoneInfo(payload.timezone or DEFAULT_TIMEZONE)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid timezone. Use {DEFAULT_TIMEZONE} for India.",
        )

    try:
        datetime.strptime(payload.start_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Use start_date in YYYY-MM-DD format.",
        )

    medication = {
        "id": f"medication_{uuid.uuid4().hex}",
        "email": clean_email,
        "patient_name": patient_name,
        "phone_number": phone_number,
        "medicine_name": payload.medicine_name.strip(),
        "dosage": (payload.dosage or "").strip(),
        "times": times,
        "start_date": payload.start_date,
        "duration_days": payload.duration_days,
        "instructions": (payload.instructions or "").strip(),
        "timezone": payload.timezone or DEFAULT_TIMEZONE,
        "status": "active",
        "sent_reminders": [],
        "created_at": datetime.now(timezone).isoformat(),
    }

    medications_collection.insert_one({**medication})

    confirmation_message = (
        "LabLens Medication Reminder Set\n"
        f"Medicine: {medication['medicine_name']}"
        + (f" ({medication['dosage']})" if medication["dosage"] else "")
        + "\n"
        f"Times: {', '.join(times)}\n"
        f"Duration: {payload.duration_days} day(s) starting {payload.start_date}\n"
        "We'll text you a reminder at each dose time."
    )

    sms_sent = True
    sms_error = None

    try:
        await asyncio.to_thread(
            send_sms,
            phone_number,
            confirmation_message,
        )
    except Exception as exc:
        sms_sent = False
        sms_error = str(exc)
        print(f"[Medications] Confirmation SMS failed: {exc}")

    return {
        "success": True,
        "medication": medication,
        "confirmation_sms_sent": sms_sent,
        "sms_error": sms_error,
    }


@app.get("/api/medications")
async def get_medications(
    patient_name: str = Query(default=""),
    current_user: dict = Depends(verify_cognito_token),
):
    clean_email = current_user.get("email", "").lower().strip()
    normalized_patient = normalize_name(patient_name) if patient_name else None

    medications = [
        medication
        for medication in medications_collection.find(
            {"email": clean_email}, {"_id": 0}
        )
        if normalized_patient is None
        or normalize_name(medication.get("patient_name", "")) == normalized_patient
    ]

    medications.sort(key=lambda item: item.get("start_date", ""))

    return {"success": True, "medications": medications}


@app.patch("/api/medications/{medication_id}/cancel")
async def cancel_medication(
    medication_id: str,
    current_user: dict = Depends(verify_cognito_token),
):
    clean_email = current_user.get("email", "").lower().strip()

    medication = find_medication(medication_id)

    if not medication or medication.get("email") != clean_email:
        raise HTTPException(
            status_code=404,
            detail="Medication reminder not found.",
        )

    medication["status"] = "cancelled"
    medication["cancelled_at"] = datetime.now(
        ZoneInfo(medication.get("timezone", DEFAULT_TIMEZONE))
    ).isoformat()

    medications_collection.update_one(
        {"id": medication_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": medication["cancelled_at"],
        }},
    )

    return {
        "success": True,
        "medication": medication,
    }


# =========================================================
# REPORT ANALYSIS
# =========================================================
@app.post("/analyze-report")
def analyze_report(
    file: UploadFile = File(...),
    city: str = Form(default="Delhi"),
    current_user: dict = Depends(verify_cognito_token),
):
    email = current_user.get("email", "")
    print("\n--- [START] Incoming Analysis Request ---")
    print(f"Target Account Email: {email}")
    print(f"File Received: {file.filename}")

    temporary_path = None

    try:
        file_bytes = file.file.read()

        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        report_id = f"report_{uuid.uuid4().hex}"
        original_filename = file.filename or "lab-report.pdf"
        safe_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", original_filename)
        saved_filename = f"{report_id}_{safe_filename}"
        saved_path = UPLOAD_DIR / saved_filename

        saved_path.write_bytes(file_bytes)
        report_url = f"/uploaded_reports/{saved_filename}"

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temporary:
            temporary.write(file_bytes)
            temporary_path = temporary.name

        text_parts = []

        with pdfplumber.open(temporary_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)

        text = "\n".join(text_parts).strip()

        if not text:
            raise HTTPException(
                status_code=400,
                detail="No readable text was found in the PDF.",
            )

        parsed = parse_lab_values(text)

        if not parsed:
            raise HTTPException(
                status_code=400,
                detail="Could not parse lab report.",
            )

        patient_name = parsed.get("patient_name", "Unknown")
        report_date = parsed.get("report_date", "Unknown")
        tests = parsed.get("tests", [])

        try:
            result = run_analysis_pipeline(parsed)
        except Exception as ai_error:
            print(f"[AI Core] Pipeline error: {ai_error}")

            normal_count = sum(
                1 for test in tests if test.get("status") == "NORMAL"
            )
            abnormal_count = sum(
                1
                for test in tests
                if test.get("status") in {"HIGH", "LOW", "CRITICAL"}
            )

            result = {
                "status": "partial_success",
                "total_tests": len(tests),
                "normal_count": normal_count,
                "abnormal_count": abnormal_count,
                "summary": (
                    "Report values were extracted, but the detailed "
                    "AI explanation could not complete."
                ),
                "specialist": {
                    "primary_specialist": "General Physician"
                },
                "parsed_report": parsed,
            }

        specialist = result.get("specialist", {}) or {}
        primary_specialist = specialist.get(
            "primary_specialist",
            "General Physician",
        )

        try:
            result["nearby_doctors"] = search_nearby_doctors(
                primary_specialist,
                city,
            )
        except Exception as doctor_error:
            print(f"[Doctor Search] Error: {doctor_error}")
            result["nearby_doctors"] = []

        result["id"] = report_id
        result["analyzed_at"] = datetime.now(
            ZoneInfo(DEFAULT_TIMEZONE)
        ).isoformat()
        result["file_name"] = original_filename
        result["report_url"] = report_url
        result["patient_name"] = patient_name
        result["report_date"] = report_date
        result["parsed_report"] = parsed

        clean_email = email.lower().strip()
        patient_key = make_patient_key(clean_email, patient_name)
        reports_collection.insert_one({
            **result,
            "email": clean_email,
            "patient_key": patient_key,
        })

        return result

    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Analyze Report] Critical error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if temporary_path and os.path.exists(temporary_path):
            try:
                os.remove(temporary_path)
            except OSError:
                pass


class TranslateRequest(BaseModel):
    summary: Optional[str] = ""
    specialist_reason: Optional[str] = ""
    questions: list[str] = []


@app.post("/api/translate")
def translate_report_text(
    payload: TranslateRequest,
    current_user: dict = Depends(verify_cognito_token),
):
    translated = translate_to_hindi(
        payload.summary, payload.specialist_reason, payload.questions
    )
    return {"success": True, **translated}


@app.get("/api/dashboard")
def get_patient_dashboard(
    current_user: dict = Depends(verify_cognito_token),
):
    user_id = current_user.get("sub")
    email = current_user.get("email")

    return {
        "status": "Authorized",
        "message": f"Welcome to your secure AI health desk, {email}!",
        "aws_cognito_user_id": user_id,
    }


@app.get("/api/patient/report/text-summary")
async def get_text_summary(
    report_id: str = Query(...),
    patient_name: str = Query(default=""),
    current_user: dict = Depends(verify_cognito_token),
):
    clean_email = current_user.get("email", "").lower().strip()

    query = {"id": report_id, "email": clean_email}
    if patient_name:
        query["patient_key"] = make_patient_key(clean_email, patient_name)

    report = reports_collection.find_one(query, {"_id": 0})

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Requested lab report not found.",
        )

    status_flag = str(report.get("status", "NORMAL")).upper()
    briefing_summary = report.get(
        "summary",
        "Your tested health metrics have been processed.",
    )
    specialist = report.get("specialist", {}) or {}
    recommended_doctor = specialist.get(
        "primary_specialist",
        "General Physician",
    )

    if any(
        word in status_flag
        for word in ["CRITICAL", "HIGH", "ABNORMAL", "ALERT"]
    ):
        greeting = (
            "Your latest report has been processed, and some values "
            "need attention."
        )
        next_step = (
            f"The system recommends consulting a {recommended_doctor} "
            "for formal review."
        )
    else:
        greeting = (
            "Your latest report has been analyzed, and the extracted "
            "values appear stable."
        )
        next_step = (
            f"For routine tracking, you may consult a "
            f"{recommended_doctor}."
        )

    return {
        "success": True,
        "summary_text": (
            f"{greeting} {briefing_summary} {next_step}"
        ),
    }