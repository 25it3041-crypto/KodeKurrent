import axios from 'axios';

// Automatically target Vercel /api routes or fallback to local development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// OTP Authentication
export const sendOTP = (email) => api.post('/send-otp', { email });
export const verifyOTP = (email, otp) => api.post('/verify-otp', { email, otp });

export const parseResume = (formData) => api.post('/parse-resume', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});

export const generateQuestions = (data) => api.post('/generate-questions', data, { timeout: 90000 });
export const generateFollowUp = (data) => api.post('/generate-followup', data, { timeout: 30000 });
export const evaluateAnswer = (data) => api.post('/evaluate-answer', data, { timeout: 45000 });
export const submitAssessment = (data) => api.post('/submit-assessment', data);
export const getCandidates = () => api.get('/candidates');
export const getCandidate = (id) => api.get(`/candidates/${id}`);
export const getStats = () => api.get('/stats');
export const overrideScore = (id, data) => api.patch(`/candidates/${id}/score`, data);
export const createSession = (data) => api.post('/session/create', data);
export const getSession = (id) => api.get(`/session/${id}`);

export default api;git add .