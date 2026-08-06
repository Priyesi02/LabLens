<div align="center">

# 🔬 LabLens

### AI-Powered Medical Lab Report Interpreter

Transform complex laboratory reports into clear, personalized, and actionable health insights using Large Language Models.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi)
![LangChain](https://img.shields.io/badge/LangChain-AI-green)
![OpenRouter](https://img.shields.io/badge/OpenRouter-Llama_3.1-412991)
![AWS Cognito](https://img.shields.io/badge/AWS-Cognito-orange?logo=amazonaws)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![License](https://img.shields.io/badge/License-MIT-blue)

---

**Making medical reports understandable for everyone.**

</div>

---

# ✨ Overview

LabLens is a full-stack AI healthcare application that converts complex laboratory reports into easy-to-understand health insights.

Instead of forcing patients to interpret unfamiliar biomarkers and medical terminology, LabLens extracts report data, analyzes it using LLMs, and recommends appropriate specialists—all through a modern, interactive interface.

---

# 🚀 Features

### 📄 Smart PDF Processing

- Upload laboratory reports
- Automatic PDF text extraction
- Structured biomarker parsing

### 🤖 AI Medical Interpretation

- Plain-language explanations
- Personalized health summaries
- Context-aware specialist recommendations
- Doctor-prep question generation
- Hindi translation toggle for AI-generated content
- Text-to-speech voice summary of results
- Verified reference links (MedlinePlus) for flagged lab values — matched via a static lookup table, never LLM-generated, so it can't hallucinate a link

### 📊 Interactive Analytics

- Health score visualization
- Risk distribution (normal vs. abnormal breakdown)

### 🩺 Healthcare Assistance

- Nearby doctor recommendations
- Appointment reminders (SMS via Twilio)
- Medication reminders (SMS via Twilio)
- Personalized consultation guidance

### 🔐 Secure Authentication

- AWS Cognito authentication
- JWT verification
- Protected API routes

---

# 🏗️ System Architecture

```text
                Next.js Frontend
                       │
                       ▼
                FastAPI Backend
                       │
      ┌────────────────┼────────────────┐
      │                │                │
      ▼                ▼                ▼
 PDF Parsing      LangChain       AWS Cognito
(pdfplumber)      AI Pipeline      Authentication
      │                │
      └──────────► OpenRouter ◄─────────┘
                (Llama 3.1 8B)
                       │
        ┌──────────────┴─────────────┐
        │                            │
        ▼                            ▼
 Google Places API             Health Analytics
        │                            │
        └──────────────┬─────────────┘
                       ▼
              Interactive Dashboard
```

---

# 🛠️ Tech Stack

## Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion
- Recharts
- Lucide React

## Backend

- FastAPI
- Python
- LangChain
- OpenRouter (Llama 3.1 8B Instruct)
- pdfplumber
- Uvicorn

## Authentication

- AWS Cognito
- JWT Verification

## Integrations

- Google Places API
- Twilio SMS

## Cloud

- AWS Cognito (authentication)
- AWS S3 

## Data Storage

- No database currently — analyzed reports live in an in-memory store, appointments/medications are saved to local JSON files. Both reset on a backend restart/redeploy. See "Future Improvements."

---

# 🧠 AI Pipeline

```
Upload Report
      │
      ▼
PDF Extraction
      │
      ▼
Biomarker Parsing
      │
      ▼
LLM Analysis
      │
      ▼
Medical Interpretation
      │
      ▼
Risk Assessment
      │
      ▼
Health Dashboard
```

---

# 📂 Project Structure

```
LabLens
│
├── frontend/
│   ├── app/
│   │   ├── components/
│   │   ├── dashboard/
│   │   └── auth/
│   ├── utils/
│   └── public/
│
├── backend/
│   ├── auth/                # Cognito JWT verification
│   ├── main.py               # FastAPI app & all API routes
│   ├── parser.py             # PDF text -> structured lab values (LLM)
│   ├── pipeline.py           # Abnormal values -> explanations/specialist (LLM)
│   ├── translation.py        # Hindi translation of AI-generated content (LLM)
│   ├── reference_links.py    # Static MedlinePlus link lookup (no LLM)
│   ├── doctor_search.py      # Google Places nearby-doctor search
│   ├── knowledge_base.py     # Keyword-scored medical knowledge lookup
│   ├── database.py           # Dormant DynamoDB persistence (not wired in)
│   └── extractor.py          # Dormant AWS Textract OCR path (not wired in)
│
├── knowledge_base/
│   └── medical_data.py       # Hardcoded medical reference data
│
└── README.md
```

---

# 📈 Key Highlights

- AI-powered lab report interpretation
- Secure authentication with AWS Cognito
- Interactive health analytics
- Nearby doctor recommendations
- Appointment & medication reminders
- Modern responsive dashboard
- Modular FastAPI architecture

---

# 🔒 Security

- JWT authentication
- Protected API endpoints
- Environment-based secrets
- Secure cloud authentication
- Patient data handled with privacy in mind

---

# 🚧 Future Improvements

- Real database (MongoDB/Postgres) so report history, appointments, and medications survive a restart
- Wire up the existing (currently dormant) Amazon Textract OCR path for scanned/handwritten reports
- Biomarker trend engine — track a value across multiple visits over time, scoped correctly per patient
- Doctor portal
- RAG-powered medical knowledge base (current lookup is a simple keyword-scored match over a hardcoded list, not a vector DB)
- Wearable device integrations

---

# ⚠️ Disclaimer

LabLens is designed for educational and informational purposes only.

The application does **not** replace licensed healthcare professionals or clinical diagnosis. Always consult a qualified medical practitioner for medical advice.

---

# 👩‍💻 Author

**Amna & Priyesi**

Built with ❤️ using Next.js, FastAPI, LangChain, OpenRouter, and AWS.
