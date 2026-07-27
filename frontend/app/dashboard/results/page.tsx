"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceSummaryButton } from "../../components/VoiceSummaryButton";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  RotateCcw,
  Activity,
  AlertCircle,
  Stethoscope,
  HelpCircle,
  MapPin,
  ClipboardList,
  Clock,
  TrendingUp,
  ExternalLink,
  Phone,
  Globe,
  FileText,
  CalendarDays,
  Bell,
  X,
  Save,
  Pill,
  Plus,
  Trash2,
} from "lucide-react";
import { Logo, Avatar, PillBadge, Card, GhostButton } from "../../components/ui";
import { getAuthenticatedUser } from "@/utils/aws-cognito";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type ReferenceLink = {
  label: string;
  url: string;
  source: string;
};

type AbnormalValue = {
  name: string;
  value: string | number;
  unit?: string;
  status: string;
  normal_range?: string;
  reference_link?: ReferenceLink | null;
};

type NearbyDoctor = {
  name: string;
  address: string;
  rating?: string | number;
  reviews?: number;
  phone?: string;
  website?: string;
  maps_link?: string;
  source?: string;
};

type Appointment = {
  id: string;
  email: string;
  patient_name: string;
  phone_number: string;
  doctor_name: string;
  hospital: string;
  appointment_date: string;
  appointment_time: string;
  specialty?: string;
  timezone?: string;
  status: "scheduled" | "cancelled";
  day_reminder_sent?: boolean;
  one_hour_reminder_sent?: boolean;
};

type Medication = {
  id: string;
  email: string;
  patient_name: string;
  phone_number: string;
  medicine_name: string;
  dosage?: string;
  times: string[];
  start_date: string;
  duration_days: number;
  instructions?: string;
  timezone?: string;
  status: "active" | "completed" | "cancelled";
  sent_reminders?: string[];
};

type AnalysisResult = {
  id?: string;
  file_name?: string;
  report_url?: string;
  analyzed_at?: string;
  patient_name?: string;
  report_date?: string;
  total_tests?: number;
  normal_count?: number;
  abnormal_count?: number;
  status?: string;
  summary?: string;
  health_score?: number;
  abnormal_values?: AbnormalValue[];
  specialist?: {
    primary_specialist?: string;
    urgency?: string;
    reason?: string;
    booking_message?: string;
  };
  questions?: { questions?: string[] };
  nearby_doctors?: NearbyDoctor[];
};

const statusTone: Record<string, "danger" | "warning" | "critical" | "success"> = {
  HIGH: "danger",
  LOW: "warning",
  CRITICAL: "critical",
  NORMAL: "success",
};

const EMPTY_MEDICATION_FORM = {
  medicine_name: "",
  dosage: "",
  times: [""],
  start_date: "",
  duration_days: "7",
  instructions: "",
  phone_number: "",
};

export default function ResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [activeTab, setActiveTab] = useState<
    "analysis" | "questions" | "doctors" | "appointments" | "medications" | "history"
  >("analysis");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [appointmentMessage, setAppointmentMessage] = useState("");
  const [appointmentForm, setAppointmentForm] = useState({
    doctor_name: "",
    hospital: "",
    appointment_date: "",
    appointment_time: "",
    phone_number: "",
    specialty: "",
  });

  const [medications, setMedications] = useState<Medication[]>([]);
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [medicationSaving, setMedicationSaving] = useState(false);
  const [medicationMessage, setMedicationMessage] = useState("");
  const [medicationForm, setMedicationForm] = useState(EMPTY_MEDICATION_FORM);

  useEffect(() => {
    async function loadHistory() {
      const auth = await getAuthenticatedUser();

      if (!auth.success || !auth.email) {
        setHistory([]);
        setResult(null);
        setLoaded(true);
        return;
      }

      setUserEmail(auth.email);

      try {
        const patientName = sessionStorage.getItem("lablens_active_patient_name") || "";

        try {
          const appointmentResponse = await fetch(
            `${API_BASE_URL}/api/appointments?email=${encodeURIComponent(auth.email)}&patient_name=${encodeURIComponent(patientName)}`
          );

          if (appointmentResponse.ok) {
            const appointmentData = await appointmentResponse.json();
            setAppointments(
              Array.isArray(appointmentData.appointments)
                ? appointmentData.appointments
                : []
            );
          }
        } catch (appointmentError) {
          console.error("Unable to load appointments:", appointmentError);
        }

        try {
          const medicationResponse = await fetch(
            `${API_BASE_URL}/api/medications?email=${encodeURIComponent(auth.email)}&patient_name=${encodeURIComponent(patientName)}`
          );

          if (medicationResponse.ok) {
            const medicationData = await medicationResponse.json();
            setMedications(
              Array.isArray(medicationData.medications)
                ? medicationData.medications
                : []
            );
          }
        } catch (medicationError) {
          console.error("Unable to load medications:", medicationError);
        }

        const res = await fetch(
          `${API_BASE_URL}/api/patient/history?email=${encodeURIComponent(auth.email)}&patient_name=${encodeURIComponent(patientName)}`
        );

        if (!res.ok) throw new Error(`history fetch failed ${res.status}`);

        const data = await res.json();
        const records: AnalysisResult[] = Array.isArray(data.history) ? data.history : [];

        if (records.length === 0) {
          const latest = sessionStorage.getItem("lablens_latest_result");
          if (latest) {
            const parsedLatest = JSON.parse(latest);
            setHistory([parsedLatest]);
            setResult(parsedLatest);
            setLoaded(true);
            return;
          }
        }

        setHistory(records);

        const url = new URL(window.location.href);
        const requestedId = url.searchParams.get("reportId");
        const selected = requestedId ? records.find((r) => r.id === requestedId) : records[0];

        setResult(selected || records[0] || null);
      } catch (err) {
        console.error("Unable to load history:", err);

        const latest = sessionStorage.getItem("lablens_latest_result");
        if (latest) {
          const parsedLatest = JSON.parse(latest);
          setHistory([parsedLatest]);
          setResult(parsedLatest);
        } else {
          setHistory([]);
          setResult(null);
        }
      } finally {
        setLoaded(true);
      }
    }

    loadHistory();
  }, []);

  function openAppointmentForm(doctor?: NearbyDoctor) {
    setAppointmentMessage("");
    setAppointmentForm({
      doctor_name: doctor?.name || "",
      hospital: doctor?.address || "",
      appointment_date: "",
      appointment_time: "",
      phone_number: "",
      specialty: result?.specialist?.primary_specialist || "General Physician",
    });
    setShowBookingModal(true);
  }

  async function saveAppointment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!result?.patient_name || !userEmail) {
      setAppointmentMessage("Patient information is missing.");
      return;
    }

    setAppointmentSaving(true);
    setAppointmentMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          patient_name: result.patient_name,
          phone_number: appointmentForm.phone_number,
          doctor_name: appointmentForm.doctor_name,
          hospital: appointmentForm.hospital,
          appointment_date: appointmentForm.appointment_date,
          appointment_time: appointmentForm.appointment_time,
          specialty:
            appointmentForm.specialty ||
            result.specialist?.primary_specialist ||
            "General Physician",
          timezone: "Asia/Kolkata",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not save appointment.");
      }

      setAppointments((current) =>
        [...current, data.appointment].sort((a, b) =>
          `${a.appointment_date} ${a.appointment_time}`.localeCompare(
            `${b.appointment_date} ${b.appointment_time}`
          )
        )
      );

      setAppointmentMessage(
        data.confirmation_sms_sent
          ? "Appointment saved and confirmation SMS sent."
          : "Appointment saved. SMS could not be sent; check AWS SNS settings."
      );

      setTimeout(() => {
        setShowBookingModal(false);
        setActiveTab("appointments");
      }, 1200);
    } catch (error) {
      setAppointmentMessage(
        error instanceof Error
          ? error.message
          : "Could not save appointment."
      );
    } finally {
      setAppointmentSaving(false);
    }
  }

  async function cancelAppointment(appointmentId: string) {
    if (!userEmail) return;

    const response = await fetch(
      `${API_BASE_URL}/api/appointments/${encodeURIComponent(appointmentId)}/cancel?email=${encodeURIComponent(userEmail)}`,
      { method: "PATCH" }
    );

    if (!response.ok) {
      alert("Could not cancel this appointment.");
      return;
    }

    setAppointments((current) =>
      current.map((appointment) =>
        appointment.id === appointmentId
          ? { ...appointment, status: "cancelled" }
          : appointment
      )
    );
  }

  function openMedicationForm() {
    setMedicationMessage("");
    setMedicationForm(EMPTY_MEDICATION_FORM);
    setShowMedicationModal(true);
  }

  function updateMedicationTime(index: number, value: string) {
    setMedicationForm((current) => {
      const times = [...current.times];
      times[index] = value;
      return { ...current, times };
    });
  }

  function addMedicationTimeSlot() {
    setMedicationForm((current) => ({
      ...current,
      times: [...current.times, ""],
    }));
  }

  function removeMedicationTimeSlot(index: number) {
    setMedicationForm((current) => ({
      ...current,
      times: current.times.filter((_, i) => i !== index),
    }));
  }

  async function saveMedication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!result?.patient_name || !userEmail) {
      setMedicationMessage("Patient information is missing.");
      return;
    }

    const cleanTimes = medicationForm.times
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (cleanTimes.length === 0) {
      setMedicationMessage("Add at least one reminder time.");
      return;
    }

    setMedicationSaving(true);
    setMedicationMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/medications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
          patient_name: result.patient_name,
          phone_number: medicationForm.phone_number,
          medicine_name: medicationForm.medicine_name,
          dosage: medicationForm.dosage,
          times: cleanTimes,
          start_date: medicationForm.start_date,
          duration_days: Number(medicationForm.duration_days) || 1,
          instructions: medicationForm.instructions,
          timezone: "Asia/Kolkata",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not save medication reminder.");
      }

      setMedications((current) =>
        [...current, data.medication].sort((a, b) =>
          a.start_date.localeCompare(b.start_date)
        )
      );

      setMedicationMessage(
        data.confirmation_sms_sent
          ? "Medication reminder saved and confirmation SMS sent."
          : "Reminder saved. SMS could not be sent; check Twilio settings."
      );

      setTimeout(() => {
        setShowMedicationModal(false);
        setActiveTab("medications");
      }, 1200);
    } catch (error) {
      setMedicationMessage(
        error instanceof Error
          ? error.message
          : "Could not save medication reminder."
      );
    } finally {
      setMedicationSaving(false);
    }
  }

  async function cancelMedication(medicationId: string) {
    if (!userEmail) return;

    const response = await fetch(
      `${API_BASE_URL}/api/medications/${encodeURIComponent(medicationId)}/cancel?email=${encodeURIComponent(userEmail)}`,
      { method: "PATCH" }
    );

    if (!response.ok) {
      alert("Could not cancel this medication reminder.");
      return;
    }

    setMedications((current) =>
      current.map((medication) =>
        medication.id === medicationId
          ? { ...medication, status: "cancelled" }
          : medication
      )
    );
  }

  if (!loaded) return null;

  if (!result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-canvas to-canvas-deep pb-24 selection:bg-teal-50">
        <div className="mx-auto max-w-[1280px] px-6 py-10 sm:px-10">
          <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-line pb-6">
            <Logo size={44} />
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-full border border-teal-500/20 bg-white/80 px-5 py-3 text-[13px] font-medium text-teal-700 transition hover:bg-teal-50"
            >
              Add new report
            </button>
          </div>

          <div className="rounded-3xl border border-line bg-white/80 p-10 text-center shadow-card">
            <h1 className="text-[24px] font-bold text-ink mb-3">No saved reports yet</h1>
            <p className="text-[15px] text-muted mb-8">
              Once you upload your first clinical report, your latest result will appear here.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center justify-center rounded-full bg-teal-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-600"
            >
              Upload first report
            </button>
          </div>
        </div>
      </div>
    );
  }

  const initials = (result.patient_name || "P").trim().charAt(0).toUpperCase();
  const normalVal = result.normal_count || 0;
  const abnormalVal = result.abnormal_count || 0;
  const healthScore = result.health_score ?? (result.total_tests ? Math.round((normalVal / result.total_tests) * 100) : 75);

  const testDistributionData = [
    { name: "Normal Levels", value: normalVal, color: "#10b981" },
    { name: "Out of Range", value: abnormalVal, color: "#ef4444" },
  ];

  const markerBreakdownData =
    result.abnormal_values
      ?.map((item) => ({
        name: item.name.length > 14 ? item.name.substring(0, 12) + ".." : item.name,
        Value: parseFloat(String(item.value)) || 0,
      }))
      .slice(0, 5) || [];

  const timelineData = [...history]
    .map((item) => {
      const normal = item.normal_count || 0;
      const total = item.total_tests || 1;
      const computedScore = item.health_score ?? Math.round((normal / total) * 100);
      return {
        date: item.report_date || "Unknown",
        "Health Score": computedScore,
      };
    })
    .reverse();

  return (
    <div className="min-h-screen bg-gradient-to-b from-canvas to-canvas-deep pb-24 selection:bg-teal-50">
      <div className="mx-auto max-w-[1280px] px-6 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-line pb-6"
        >
          <Logo size={44} />
          <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-[13.5px] font-medium font-display text-muted">
              {result.patient_name || "Guest User"} · {result.report_date || "Recent Report"}
            </span>
            <GhostButton
              onClick={() => router.push("/dashboard")}
              className="group border-teal-500/20 hover:border-teal-500/40 text-[13px] font-medium"
            >
              <RotateCcw size={13} className="transition-transform duration-500 group-hover:rotate-180" /> Add new report
            </GhostButton>
          </div>
        </motion.div>

        <div className="flex items-center gap-8 mb-10 border-b border-line/60 overflow-x-auto scrollbar-none w-full">
          {[
            { id: "analysis", label: "My Results", icon: ClipboardList },
            { id: "questions", label: "Doctor Prep Guide", icon: HelpCircle },
            { id: "doctors", label: "Doctors Near Me", icon: MapPin },
            { id: "appointments", label: "Appointments", icon: CalendarDays },
            { id: "medications", label: "Medications", icon: Pill },
            { id: "history", label: "Report History", icon: Clock },
          ].map((tab) => {
            const IsActive = activeTab === tab.id;
            const TabIcon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-2 pb-4 text-[14.5px] font-bold font-display tracking-tight transition-colors whitespace-nowrap outline-none ${
                  IsActive ? "text-teal-600" : "text-muted hover:text-ink"
                }`}
              >
                <TabIcon size={16} strokeWidth={IsActive ? 2.5 : 2} />
                {tab.label}
                {IsActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-teal-400 to-teal-500 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="space-y-6 lg:col-span-1">
            <Card className="p-6 bg-white shadow-card">
              <div className="flex items-center gap-4">
                <Avatar label={initials} size={50} />
                <div>
                  <h2 className="text-[17px] font-extrabold font-display text-ink leading-tight">
                    {result.patient_name || "Patient Record"}
                  </h2>
                  <p className="text-[12.5px] font-medium text-muted mt-0.5">
                    Report date: {result.report_date || "Not specified"}
                  </p>
                </div>
              </div>

              {result.report_url && (
                <a
                  href={`${API_BASE_URL}${result.report_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-teal-600"
                >
                  <FileText size={15} />
                  View Original Report
                </a>
              )}

              {userEmail && result.id && (
                <div className="mt-4">
                  <VoiceSummaryButton email={userEmail} reportId={result.id} />
                </div>
              )}

              <div className="my-5 h-px bg-line" />

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-canvas p-2.5 rounded-xl border border-line/40">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Total Tests</span>
                  <span className="text-[19px] font-extrabold text-ink">{result.total_tests ?? "—"}</span>
                </div>
                <div className="bg-status-success-bg/40 p-2.5 rounded-xl border border-status-success/10">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-status-success">Normal</span>
                  <span className="text-[19px] font-extrabold text-status-success">{result.normal_count ?? "—"}</span>
                </div>
                <div className="bg-status-danger-bg/40 p-2.5 rounded-xl border border-status-danger/10">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-status-danger">Attention</span>
                  <span className="text-[19px] font-extrabold text-status-danger">{result.abnormal_count ?? "—"}</span>
                </div>
              </div>
            </Card>

            <div className="p-6 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-xl relative overflow-hidden text-center shadow-card">
              <h3 className="text-[14px] font-bold font-display tracking-tightish text-ink mb-1">Your Lab Health Score</h3>
              <p className="text-[12px] text-muted max-w-[85%] mx-auto mb-4">
                Based on how many parameters are within range.
              </p>

              <div className="relative mx-auto w-36 h-36 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{ value: healthScore }, { value: 100 - healthScore }]}
                      innerRadius={52}
                      outerRadius={62}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#14b8a6" />
                      <Cell fill="rgba(15, 23, 42, 0.05)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[34px] font-black tracking-tighter text-ink leading-none">{healthScore}%</span>
                  <span className="text-[11px] font-bold text-teal-600 uppercase mt-0.5">Score</span>
                </div>
              </div>

              <div className="mt-4 inline-block px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[12px] font-bold text-teal-700">
                Overall Status: <span className="uppercase text-ink">{result.status ?? "STABLE"}</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-xl shadow-card">
              <h4 className="text-[13.5px] font-bold font-display text-ink mb-3">Health Balance</h4>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={testDistributionData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value" stroke="none">
                      {testDistributionData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {result.specialist && (
              <Card className="p-6 bg-white shadow-card border-l-[4px] border-l-teal-400">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 shadow-sm">
                    <Stethoscope size={20} />
                  </div>
                  <div className="flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                      Suggested Doctor Specialty
                    </span>
                    <div className="text-[17px] font-extrabold text-ink mt-0.5 leading-tight">
                      {result.specialist.primary_specialist || "General Physician"}
                    </div>
                  </div>
                </div>

                {result.specialist.reason && (
                  <div className="mt-4 rounded-xl bg-canvas/60 p-3.5 border border-line/60 text-[13.5px] leading-relaxed text-muted">
                    <span className="font-bold text-ink block mb-0.5">Why this matches:</span>
                    {result.specialist.reason}
                  </div>
                )}
              </Card>
            )}
          </div>

          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeTab === "analysis" && (
                <motion.div key="analysis" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
                  {history.length > 1 && (
                    <div className="p-6 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-xl shadow-card">
                      <h3 className="text-[14.5px] font-bold text-ink mb-1 flex items-center gap-2">
                        <TrendingUp size={16} className="text-teal-500" /> Medical Trends Timeline
                      </h3>
                      <p className="text-[12px] text-muted mb-6">
                        Tracking this patient’s reports only.
                      </p>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={timelineData} margin={{ top: 10, right: 20, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.04)" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="Health Score" stroke="#14b8a6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {markerBreakdownData.length > 0 && (
                    <div className="p-6 rounded-2xl border border-white/70 bg-white/40 backdrop-blur-xl shadow-card">
                      <h3 className="text-[14.5px] font-bold text-ink mb-4 flex items-center gap-2">
                        <Activity size={16} className="text-teal-500" /> Values Requiring Check
                      </h3>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={markerBreakdownData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey="Value" fill="#14b8a6" radius={[6, 6, 0, 0]} maxBarSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {result.abnormal_values && result.abnormal_values.length > 0 ? (
                    <Card className="p-6 bg-white shadow-card">
                      <div className="mb-4 flex items-center gap-2.5">
                        <AlertCircle size={18} className="text-status-danger" />
                        <h3 className="text-[16px] font-extrabold text-ink">Flags Found in Report</h3>
                      </div>

                      <div className="space-y-3">
                        {result.abnormal_values.map((item, i) => {
                          const tone = statusTone[item.status?.toUpperCase()] || "success";
                          return (
                            <div key={i} className="rounded-xl border border-line border-l-[4px] p-4 bg-canvas/30 border-l-status-danger">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-bold text-ink text-[14.5px]">{item.name}</p>
                                <PillBadge tone={tone}>
                                  {item.status === "HIGH" ? "High Value" : item.status === "LOW" ? "Low Value" : item.status}
                                </PillBadge>
                              </div>

                              <p className="mt-1.5 text-[13.5px] font-bold text-ink bg-white/70 px-2.5 py-1 rounded-md w-fit border border-line/40">
                                Your Value: <span className="text-teal-600 font-black">{item.value}</span> {item.unit || ""}
                              </p>

                              {item.normal_range && (
                                <p className="mt-2 text-[12.5px] text-muted">
                                  Normal range: {item.normal_range}
                                </p>
                              )}

                              {item.reference_link && (
                                <a
                                  href={item.reference_link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-teal-700 hover:underline"
                                >
                                  <ExternalLink size={13} />
                                  Learn about {item.reference_link.label} · {item.reference_link.source}
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  ) : (
                    <Card className="p-10 text-center bg-white shadow-card">
                      <p className="text-[15px] font-medium text-muted">
                        No high or low flags detected. All markers look standard.
                      </p>
                    </Card>
                  )}
                </motion.div>
              )}

              {activeTab === "questions" && (
                <motion.div key="questions" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <Card className="p-6 bg-white shadow-card">
                    <div className="mb-4 flex items-center gap-2.5">
                      <HelpCircle size={18} className="text-teal-500" />
                      <h3 className="text-[16px] font-extrabold text-ink">Questions to Ask Your Doctor</h3>
                    </div>

                    {result.questions?.questions && result.questions.questions.length > 0 ? (
                      <ul className="space-y-3">
                        {result.questions.questions.map((q, i) => (
                          <li key={i} className="flex items-start gap-3 text-[14px] bg-canvas/30 p-3.5 rounded-xl border border-line/40">
                            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-teal-400" />
                            <span className="leading-relaxed font-medium text-ink">{q}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[14px] text-muted">No questions generated.</p>
                    )}
                  </Card>
                </motion.div>
              )}

              {activeTab === "doctors" && (
                <motion.div key="doctors" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <Card className="p-6 bg-white shadow-card">
                    <div className="mb-4 flex items-center gap-2.5">
                      <MapPin size={18} className="text-teal-500" />
                      <h3 className="text-[16px] font-extrabold text-ink">Recommended Doctors Near You</h3>
                    </div>

                    <p className="text-[13.5px] text-muted mb-5 leading-relaxed">
                      Based on your suggested specialty:{" "}
                      <span className="font-bold text-ink">{result.specialist?.primary_specialist || "General Physician"}</span>
                    </p>

                    {result.nearby_doctors && result.nearby_doctors.length > 0 ? (
                      <div className="space-y-4">
                        {result.nearby_doctors.map((doctor, i) => (
                          <div key={i} className="rounded-2xl border border-line bg-canvas/30 p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h4 className="text-[15px] font-extrabold text-ink">{doctor.name}</h4>
                                <p className="mt-1 text-[13px] text-muted leading-relaxed">{doctor.address}</p>
                              </div>
                              {doctor.rating && (
                                <span className="rounded-full bg-teal-50 px-3 py-1 text-[12px] font-bold text-teal-700">
                                  ⭐ {doctor.rating}
                                </span>
                              )}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {doctor.phone && doctor.phone !== "Not available" && (
                                <a href={`tel:${doctor.phone}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[12.5px] font-bold text-ink">
                                  <Phone size={13} /> Call
                                </a>
                              )}

                              {doctor.website && doctor.website !== "Not available" && (
                                <a href={doctor.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[12.5px] font-bold text-ink">
                                  <Globe size={13} /> Website
                                </a>
                              )}

                              {doctor.maps_link && doctor.maps_link !== "Not available" && (
                                <a href={doctor.maps_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-teal-500 px-3 py-2 text-[12.5px] font-bold text-white">
                                  <ExternalLink size={13} /> Open Maps
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => openAppointmentForm(doctor)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600 px-3 py-2 text-[12.5px] font-bold text-white transition hover:bg-cyan-700"
                              >
                                <CalendarDays size={13} /> Save Appointment
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-line bg-canvas/40 p-6 text-center">
                        <p className="text-[14px] font-medium text-muted">
                          No nearby doctors were returned. Check your Google Places API key or city setting.
                        </p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}

              {activeTab === "appointments" && (
                <motion.div
                  key="appointments"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <Card className="p-6 bg-white shadow-card">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <Bell size={18} className="text-teal-500" />
                        <h3 className="text-[16px] font-extrabold text-ink">
                          Appointment reminders
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => openAppointmentForm()}
                        className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-teal-600"
                      >
                        <CalendarDays size={14} />
                        Add appointment
                      </button>
                    </div>

                    <p className="mb-5 text-[13.5px] leading-relaxed text-muted">
                      We send an SMS on the appointment day and another reminder
                      about one hour before the appointment.
                    </p>

                    {appointments.length > 0 ? (
                      <div className="space-y-4">
                        {appointments.map((appointment) => (
                          <div
                            key={appointment.id}
                            className={`rounded-2xl border p-5 ${
                              appointment.status === "cancelled"
                                ? "border-line bg-canvas/40 opacity-60"
                                : "border-teal-200 bg-teal-50/30"
                            }`}
                          >
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                              <div>
                                <p className="text-[15px] font-extrabold text-ink">
                                  {appointment.doctor_name}
                                </p>
                                <p className="mt-1 text-[13px] text-muted">
                                  {appointment.hospital}
                                </p>
                                <p className="mt-3 text-[13.5px] font-bold text-teal-700">
                                  {appointment.appointment_date} at{" "}
                                  {appointment.appointment_time}
                                </p>
                                <p className="mt-1 text-[12.5px] text-muted">
                                  SMS: {appointment.phone_number}
                                </p>
                              </div>

                              <div className="flex flex-col items-start gap-2 sm:items-end">
                                <span
                                  className={`rounded-full px-3 py-1 text-[11.5px] font-bold uppercase ${
                                    appointment.status === "scheduled"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {appointment.status}
                                </span>

                                {appointment.status === "scheduled" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      cancelAppointment(appointment.id)
                                    }
                                    className="text-[12px] font-bold text-red-600 hover:underline"
                                  >
                                    Cancel appointment
                                  </button>
                                )}
                              </div>
                            </div>

                            {appointment.status === "scheduled" && (
                              <div className="mt-4 grid grid-cols-1 gap-2 text-[12px] text-muted sm:grid-cols-2">
                                <div className="rounded-xl border border-line bg-white/70 p-3">
                                  Day reminder:{" "}
                                  <span className="font-bold text-ink">
                                    {appointment.day_reminder_sent
                                      ? "Sent"
                                      : "Scheduled"}
                                  </span>
                                </div>
                                <div className="rounded-xl border border-line bg-white/70 p-3">
                                  1-hour reminder:{" "}
                                  <span className="font-bold text-ink">
                                    {appointment.one_hour_reminder_sent
                                      ? "Sent"
                                      : "Scheduled"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-line bg-canvas/30 p-8 text-center">
                        <CalendarDays
                          size={28}
                          className="mx-auto text-teal-500"
                        />
                        <p className="mt-3 text-[14px] font-bold text-ink">
                          No appointments saved
                        </p>
                        <p className="mt-1 text-[13px] text-muted">
                          Choose a doctor or add appointment details manually.
                        </p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}

              {activeTab === "medications" && (
                <motion.div
                  key="medications"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <Card className="p-6 bg-white shadow-card">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <Pill size={18} className="text-teal-500" />
                        <h3 className="text-[16px] font-extrabold text-ink">
                          Medication reminders
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={openMedicationForm}
                        className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-teal-600"
                      >
                        <Plus size={14} />
                        Add medication
                      </button>
                    </div>

                    <p className="mb-5 text-[13.5px] leading-relaxed text-muted">
                      Enter the pill name and the times you need to take it. We
                      will text you an SMS reminder at each scheduled dose time
                      for the length of the course.
                    </p>

                    {medications.length > 0 ? (
                      <div className="space-y-4">
                        {medications.map((medication) => (
                          <div
                            key={medication.id}
                            className={`rounded-2xl border p-5 ${
                              medication.status === "cancelled"
                                ? "border-line bg-canvas/40 opacity-60"
                                : medication.status === "completed"
                                ? "border-line bg-canvas/40"
                                : "border-teal-200 bg-teal-50/30"
                            }`}
                          >
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                              <div>
                                <p className="text-[15px] font-extrabold text-ink">
                                  {medication.medicine_name}
                                  {medication.dosage && (
                                    <span className="ml-2 text-[13px] font-semibold text-teal-600">
                                      {medication.dosage}
                                    </span>
                                  )}
                                </p>

                                <p className="mt-2 flex flex-wrap gap-1.5">
                                  {medication.times.map((slot) => (
                                    <span
                                      key={slot}
                                      className="rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-teal-700 border border-teal-200"
                                    >
                                      {slot}
                                    </span>
                                  ))}
                                </p>

                                <p className="mt-3 text-[13px] text-muted">
                                  Starts {medication.start_date} · {medication.duration_days} day
                                  {medication.duration_days === 1 ? "" : "s"}
                                </p>

                                {medication.instructions && (
                                  <p className="mt-1 text-[12.5px] text-muted italic">
                                    {medication.instructions}
                                  </p>
                                )}

                                <p className="mt-1 text-[12.5px] text-muted">
                                  SMS: {medication.phone_number}
                                </p>
                              </div>

                              <div className="flex flex-col items-start gap-2 sm:items-end">
                                <span
                                  className={`rounded-full px-3 py-1 text-[11.5px] font-bold uppercase ${
                                    medication.status === "active"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : medication.status === "completed"
                                      ? "bg-teal-100 text-teal-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {medication.status}
                                </span>

                                {medication.status === "active" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      cancelMedication(medication.id)
                                    }
                                    className="text-[12px] font-bold text-red-600 hover:underline"
                                  >
                                    Stop reminders
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-line bg-canvas/30 p-8 text-center">
                        <Pill size={28} className="mx-auto text-teal-500" />
                        <p className="mt-3 text-[14px] font-bold text-ink">
                          No medication reminders yet
                        </p>
                        <p className="mt-1 text-[13px] text-muted">
                          Add a pill name, dosage, and dose times to get SMS
                          reminders.
                        </p>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div key="history" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <Card className="p-6 bg-white shadow-card">
                    <div className="mb-4 flex items-center gap-2.5">
                      <Clock size={18} className="text-teal-500" />
                      <h3 className="text-[16px] font-extrabold text-ink">Report history</h3>
                    </div>

                    {history.length > 0 ? (
                      <div className="space-y-3">
                        {history.map((item, index) => {
                          const reportId = item.id ?? "";
                          return (
                            <button
                              key={item.id || index}
                              onClick={() => {
                                setResult(item);
                                router.push(`/dashboard/results?reportId=${encodeURIComponent(reportId)}`);
                              }}
                              className={`w-full text-left rounded-3xl border px-5 py-4 transition hover:border-teal-300/70 hover:bg-white ${
                                result?.id === item.id ? "border-teal-400 bg-teal-50/40" : "border-line"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-bold text-ink text-sm">{item.file_name || "Lab Report"}</p>
                                  <p className="text-xs text-muted mt-0.5">
                                    {item.patient_name || "Unknown Patient"} · {item.report_date || "Unknown Date"}
                                  </p>
                                </div>
                                <span className="text-sm font-extrabold text-teal-600">
                                  {item.health_score ?? 75}%
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[14px] text-muted text-center py-6">No historical records available.</p>
                    )}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showBookingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
            onClick={() => setShowBookingModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/70 bg-white p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[20px] font-extrabold text-ink">
                    Save appointment
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    Enter the confirmed appointment details. The phone number
                    must include the country code.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="rounded-full border border-line p-2 text-muted transition hover:bg-canvas"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={saveAppointment} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                    Doctor name
                  </span>
                  <input
                    required
                    value={appointmentForm.doctor_name}
                    onChange={(event) =>
                      setAppointmentForm((current) => ({
                        ...current,
                        doctor_name: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    placeholder="Dr. Sharma"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                    Hospital or clinic
                  </span>
                  <input
                    required
                    value={appointmentForm.hospital}
                    onChange={(event) =>
                      setAppointmentForm((current) => ({
                        ...current,
                        hospital: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    placeholder="Hospital name and address"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                      Date
                    </span>
                    <input
                      required
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={appointmentForm.appointment_date}
                      onChange={(event) =>
                        setAppointmentForm((current) => ({
                          ...current,
                          appointment_date: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                      Time
                    </span>
                    <input
                      required
                      type="time"
                      value={appointmentForm.appointment_time}
                      onChange={(event) =>
                        setAppointmentForm((current) => ({
                          ...current,
                          appointment_time: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                    Patient phone number
                  </span>
                  <input
                    required
                    type="tel"
                    value={appointmentForm.phone_number}
                    onChange={(event) =>
                      setAppointmentForm((current) => ({
                        ...current,
                        phone_number: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    placeholder="+919876543210"
                  />
                  <span className="mt-1 block text-[11.5px] text-muted">
                    Use E.164 format, for example +919876543210.
                  </span>
                </label>

                {appointmentMessage && (
                  <div className="rounded-xl border border-line bg-canvas/50 p-3 text-[13px] font-medium text-ink">
                    {appointmentMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={appointmentSaving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-[14px] font-bold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={16} />
                  {appointmentSaving
                    ? "Saving appointment..."
                    : "Save and schedule SMS reminders"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMedicationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
            onClick={() => setShowMedicationModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/70 bg-white p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[20px] font-extrabold text-ink">
                    Add medication reminder
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    Enter the pill details exactly as your doctor prescribed
                    them. The phone number must include the country code.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMedicationModal(false)}
                  className="rounded-full border border-line p-2 text-muted transition hover:bg-canvas"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={saveMedication} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                    Medicine name
                  </span>
                  <input
                    required
                    value={medicationForm.medicine_name}
                    onChange={(event) =>
                      setMedicationForm((current) => ({
                        ...current,
                        medicine_name: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    placeholder="Metformin"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                    Dosage (optional)
                  </span>
                  <input
                    value={medicationForm.dosage}
                    onChange={(event) =>
                      setMedicationForm((current) => ({
                        ...current,
                        dosage: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    placeholder="500mg, 1 tablet"
                  />
                </label>

                <div>
                  <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                    Reminder times
                  </span>

                  <div className="space-y-2">
                    {medicationForm.times.map((slot, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          required
                          type="time"
                          value={slot}
                          onChange={(event) =>
                            updateMedicationTime(index, event.target.value)
                          }
                          className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                        />

                        {medicationForm.times.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMedicationTimeSlot(index)}
                            className="flex-shrink-0 rounded-xl border border-line p-3 text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addMedicationTimeSlot}
                    className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-teal-700 hover:underline"
                  >
                    <Plus size={13} /> Add another time
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                      Start date
                    </span>
                    <input
                      required
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={medicationForm.start_date}
                      onChange={(event) =>
                        setMedicationForm((current) => ({
                          ...current,
                          start_date: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                      Duration (days)
                    </span>
                    <input
                      required
                      type="number"
                      min={1}
                      value={medicationForm.duration_days}
                      onChange={(event) =>
                        setMedicationForm((current) => ({
                          ...current,
                          duration_days: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                    Instructions (optional)
                  </span>
                  <input
                    value={medicationForm.instructions}
                    onChange={(event) =>
                      setMedicationForm((current) => ({
                        ...current,
                        instructions: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    placeholder="Take after food"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-bold text-ink">
                    Patient phone number
                  </span>
                  <input
                    required
                    type="tel"
                    value={medicationForm.phone_number}
                    onChange={(event) =>
                      setMedicationForm((current) => ({
                        ...current,
                        phone_number: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-line bg-canvas/30 px-4 py-3 text-[14px] outline-none transition focus:border-teal-400"
                    placeholder="+919876543210"
                  />
                  <span className="mt-1 block text-[11.5px] text-muted">
                    Use E.164 format, for example +919876543210.
                  </span>
                </label>

                {medicationMessage && (
                  <div className="rounded-xl border border-line bg-canvas/50 p-3 text-[13px] font-medium text-ink">
                    {medicationMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={medicationSaving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-[14px] font-bold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={16} />
                  {medicationSaving
                    ? "Saving reminder..."
                    : "Save and schedule SMS reminders"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
