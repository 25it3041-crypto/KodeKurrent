import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Dummy bypass functions so no missing import errors occur
export const sendOTP = async (email) => ({ data: { success: true, message: "Bypassed successfully" } });
export const verifyOTP = async (email, otp) => ({ data: { success: true, token: "mock-token-bypass" } });

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

export default api;