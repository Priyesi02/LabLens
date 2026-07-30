<div align="center">

# 🔬 LabLens

### AI-Powered Medical Lab Report Interpreter

Transform complex laboratory reports into clear, personalized, and actionable health insights using Large Language Models.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi)
![LangChain](https://img.shields.io/badge/LangChain-AI-green)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?logo=openai)
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

Instead of forcing patients to interpret unfamiliar biomarkers and medical terminology, LabLens extracts report data, analyzes it using LLMs, visualizes health trends, and recommends appropriate specialists—all through a modern, interactive interface.

---

# 🚀 Features

### 📄 Smart PDF Processing

- Upload laboratory reports
- Automatic PDF text extraction
- Structured biomarker parsing

### 🤖 AI Medical Interpretation

- Plain-language explanations
- Personalized health summaries
- Context-aware recommendations
- Multilingual report generation

### 📊 Interactive Analytics

- Health score visualization
- Biomarker trend charts
- Risk distribution
- Historical comparison

### 🩺 Healthcare Assistance

- Nearby doctor recommendations
- Appointment reminders
- Medication reminders
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
      └──────────► GPT-4o ◄─────────┘
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
- OpenAI GPT-4o
- pdfplumber
- Uvicorn

## Authentication

- AWS Cognito
- JWT Verification

## Integrations

- Google Places API
- Twilio SMS

## Cloud

- AWS Services
- Amazon Cognito

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
│   ├── components/
│   ├── utils/
│   └── public/
│
├── backend/
│   ├── auth/
│   ├── services/
│   ├── main.py
│   └── doctor_search.py
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

- OCR support with Amazon Textract
- Patient history persistence
- Biomarker trend engine
- Voice assistant
- Doctor portal
- RAG-powered medical knowledge base
- Wearable device integrations

---

# ⚠️ Disclaimer

LabLens is designed for educational and informational purposes only.

The application does **not** replace licensed healthcare professionals or clinical diagnosis. Always consult a qualified medical practitioner for medical advice.

---

# 👩‍💻 Author

**Amna Sehgal**

Built with ❤️ using Next.js, FastAPI, LangChain, OpenAI, and AWS.