import { create } from 'zustand';

const useStore = create((set, get) => ({
  // ─── Auth ─────────────────────────────────────────────────────────────────
  isAuthenticated: false,
  authEmail: '',
  sessionToken: '',
  setAuthenticated: (email, token) => set({ isAuthenticated: true, authEmail: email, sessionToken: token }),

  // Portal
  activePortal: 'candidate', // 'candidate' | 'hr'
  setPortal: (p) => set({ activePortal: p }),

  // Session
  session: null,
  setSession: (s) => set({ session: s }),

  // Candidate info
  candidate: { name: '', email: '', phone: '' },
  setCandidate: (c) => set({ candidate: { ...get().candidate, ...c } }),

  // Job config (set by recruiter, loaded by candidate)
  jobConfig: {
    jobTitle: '',
    jobDescription: '',
    requiredSkills: '',
    experienceLevel: 'Mid-Level',
    interviewDuration: 30,
    questionCount: 10,
    customQuestions: [],
  },
  setJobConfig: (cfg) => set({
    jobConfig: {
      ...get().jobConfig,
      ...cfg,
      questionCount: Number(cfg.questionCount ?? get().jobConfig.questionCount) || 10,
    },
  }),

  // Resume
  resumeData: null,
  setResumeData: (r) => set({ resumeData: r }),

  // Questions
  questions: [],
  setQuestions: (q) => set({ questions: q }),
  currentQuestionIndex: 0,
  setCurrentQuestionIndex: (i) => set({ currentQuestionIndex: i }),
  questionStatuses: {},
  setQuestionStatus: (index, status) => set((s) => ({
    questionStatuses: { ...s.questionStatuses, [index]: status },
  })),

  // Answers & Evaluations
  answers: [],
  evaluations: [],
  addAnswer: (answer, evaluation) => set((s) => ({
    answers: [...s.answers, answer],
    evaluations: [...s.evaluations, evaluation || {}],
  })),

  // Transcript
  transcript: [],
  addTranscriptEntry: (entry) => set((s) => ({
    transcript: [...s.transcript, { ...entry, timestamp: new Date().toISOString() }],
  })),

  // Trust Score & Proctoring
  trustScore: 100,
  deductTrust: (points, reason) => set((s) => ({
    trustScore: Math.max(0, s.trustScore - points),
    proctorEvents: [...s.proctorEvents, {
      type: 'deduction',
      eventType: 'deduction',
      reason,
      points,
      timestamp: new Date().toISOString(),
      evidence: reason,
    }],
  })),
  proctorEvents: [],
  addProctorEvent: (event) => set((s) => {
    const timestamp = event?.timestamp || new Date().toISOString();
    const eventType = event?.eventType || event?.type || 'unknown';
    const evidence = event?.evidence || event?.label || event?.reason || eventType;
    return {
      proctorEvents: [...s.proctorEvents, { ...event, eventType, type: event?.type || eventType, timestamp, evidence }],
    };
  }),

  // Mobile camera
  mobileConnected: false,
  setMobileConnected: (v) => set({ mobileConnected: v }),
  mobileStream: null,
  setMobileStream: (s) => set({ mobileStream: s }),

  // Interview state
  interviewPhase: 'setup', // setup | onboarding | interview | coding | completed
  setInterviewPhase: (p) => set({ interviewPhase: p }),
  isRecording: false,
  setIsRecording: (v) => set({ isRecording: v }),
  isListening: false,
  setIsListening: (v) => set({ isListening: v }),
  isSpeaking: false,
  setIsSpeaking: (v) => set({ isSpeaking: v }),

  // AI metrics
  aiGeneratedProbability: 0,
  setAiGeneratedProbability: (v) => set({ aiGeneratedProbability: v }),
  sentimentScore: 50,
  setSentimentScore: (v) => set({ sentimentScore: v }),
  currentDifficulty: 'easy',
  setCurrentDifficulty: (d) => set({ currentDifficulty: d }),

  // Heatmap data
  gazePoints: [],
  addGazePoint: (pt) => set((s) => ({
    gazePoints: [...s.gazePoints.slice(-200), { ...pt, t: Date.now() }],
  })),

  // Keystroke replay
  keystrokes: [],
  addKeystroke: (k) => set((s) => ({ keystrokes: [...s.keystrokes, k] })),

  // Coding
  codingCode: '',
  setCodingCode: (c) => set({ codingCode: c }),

  // Reset
  reset: () => set({
    session: null, questions: [], answers: [], evaluations: [],
    transcript: [], trustScore: 100, proctorEvents: [],
    currentQuestionIndex: 0, questionStatuses: {}, interviewPhase: 'setup',
    mobileConnected: false, gazePoints: [], keystrokes: [],
    aiGeneratedProbability: 0, sentimentScore: 50,
    resumeData: null, codingCode: '',
    // Note: auth state intentionally NOT reset (stays logged in)
  }),

  // Motion analysis events (canvas frame analysis)
  motionEvents: [],
  addMotionEvent: (evt) => set((s) => ({
    motionEvents: [...s.motionEvents, { ...evt, timestamp: new Date().toISOString() }],
  })),
}));

export default useStore;
