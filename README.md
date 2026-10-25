# HireAI — Autonomous AI Video Interviewer & Dual-Camera Proctoring Suite

A production-grade, full-stack AI interview platform with real-time proctoring, Gemini AI question generation, dual-camera WebRTC streaming, and a full HR recruiter dashboard.

---

## 🚀 Quick Start (Development)

```bash
# 1. Install all dependencies (only needed once)
npm run install:all

# 2. Start both servers simultaneously
npm run dev
```

- **Candidate / HR Frontend** → http://localhost:5173
- **Backend API** → http://localhost:5000
- **Health check** → http://localhost:5000/health

---

## 🏗️ Project Structure

```
kodekurrent/
├── server/                    # Express backend (port 5000)
│   ├── index.js               # Main server: Express + Socket.IO + WebRTC signaling
│   ├── routes/
│   │   ├── auth.js            # POST /api/send-otp, /api/verify-otp
│   │   ├── assessment.js      # Resume parse, generate-questions, evaluate-answer, submit
│   │   ├── candidates.js      # GET/PATCH/DELETE candidates
│   │   └── session.js         # Session CRUD
│   └── utils/
│       └── gemini.js          # Gemini AI wrappers (questions, evaluation, reports)
│
├── client/                    # React + Vite frontend (port 5173)
│   └── src/
│       ├── App.jsx            # Router: main layout + /mobile-cam route
│       ├── lib/
│       │   ├── store.js       # Zustand global state
│       │   ├── api.js         # Axios API calls
│       │   └── socket.js      # Socket.IO singleton
│       ├── hooks/
│       │   ├── useSpeech.js       # Web Speech API TTS + STT
│       │   ├── useWebRTC.js       # WebRTC peer connection
│       │   ├── useProctoring.js   # Tab/focus/copy-paste detection
│       │   └── useMotionAnalysis.js # Canvas frame analysis
│       ├── components/
│       │   ├── layout/Header.jsx  # Portal switcher + live badge
│       │   ├── candidate/         # Full candidate interview flow
│       │   ├── hr/                # HR dashboard + reports
│       │   └── shared/            # TrustScoreMeter, HeatmapVisualizer, etc.
│       └── pages/MobileCamera.jsx # Smartphone secondary cam page
│
├── .env                       # Environment variables (Gemini key, SMTP, etc.)
└── package.json               # Root scripts: dev, build, start
```

---

## 🌟 Feature Overview

| Feature | Details |
|---|---|
| **Email OTP Auth** | Nodemailer + Ethereal fallback; 6-digit code auto-fills |
| **Resume Parser** | Drag-drop PDF/DOCX/TXT → extracts skills, experience, education |
| **Gemini AI Questions** | 10 tailored technical + behavioral + scenario questions per JD+Resume |
| **TTS / STT** | Web Speech API reads questions aloud; transcribes candidate voice answers |
| **Adaptive Difficulty** | Easy → Medium → Hard based on answer scoring |
| **AI Follow-up** | Vague/brief answers trigger AI cross-examination |
| **AI Trust Score (0–100%)** | Deducts for tab switches, focus loss, AI-speech detection |
| **Canvas Motion Analysis** | HTML5 canvas frame diff → detects rapid head/neck movement |
| **Dual-Camera WebRTC** | QR code → smartphone camera streams as secondary proctoring view |
| **HR Dashboard** | Real-time candidate list via Socket.IO with live stats |
| **Candidate Reports** | 5-tab deep report: Q&A, Proctoring, Audit Log, Skill Radar, AI Report |
| **PDF Export** | jsPDF multi-page printable report |
| **Human Override** | Recruiters can manually adjust scores and leave notes |

---

## 🔧 Environment Variables (.env)

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# SMTP — leave blank to use Ethereal (dev auto-email)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@hireai.dev
```

> **Dev tip**: When SMTP fields are blank, the server auto-creates an Ethereal test account.
> The OTP preview URL + the raw OTP code are returned in the API response and shown on screen.

---

## 🌐 Production Deploy (Render / Railway)

1. **Build command**: `npm run build`  
2. **Start command**: `npm start`  
3. **Set env vars**: `GEMINI_API_KEY`, `NODE_ENV=production`, `CLIENT_URL=https://your-domain.com`

In production, Express serves the React `client/dist` build directly — only one server needed.

---

## 📱 Secondary Smartphone Camera

During onboarding, a QR code appears. Scan it with a smartphone — it opens `/mobile-cam?session=<ID>`, which starts the phone camera and streams it via WebRTC back to the interview room as the secondary workspace surveillance feed.

---

## 🛠️ Tech Stack

**Frontend**: React 18 · Vite · TailwindCSS v4 · Framer Motion · Zustand · Socket.IO-client · Recharts · Monaco Editor · jsPDF · QRCode.react

**Backend**: Node.js · Express · Socket.IO · Multer · pdf-parse · mammoth · Nodemailer · @google/generative-ai · uuid
