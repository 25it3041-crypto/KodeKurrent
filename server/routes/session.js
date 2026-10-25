const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Create a new interview session
router.post('/session/create', (req, res) => {
  const { jobTitle, jobDescription, requiredSkills, experienceLevel, interviewDuration, questionCount, customQuestions } = req.body;
  const sessionId = uuidv4();
  
  const session = {
    sessionId,
    jobTitle,
    jobDescription,
    requiredSkills,
    experienceLevel,
    interviewDuration: interviewDuration || 30,
    questionCount: questionCount || 10,
    customQuestions: Array.isArray(customQuestions) ? customQuestions : [],
    mobileConnected: false,
    createdAt: new Date().toISOString(),
    status: 'waiting',
    mobileUrl: `/mobile-cam?session=${sessionId}`,
  };

  req.app.locals.sessions.set(sessionId, session);
  res.json({ success: true, session });
});

// Get session info
router.get('/session/:id', (req, res) => {
  const session = req.app.locals.sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ success: true, session });
});

// Update session status
router.patch('/session/:id', (req, res) => {
  const session = req.app.locals.sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  
  Object.assign(session, req.body);
  req.app.locals.sessions.set(req.params.id, session);
  res.json({ success: true, session });
});

module.exports = router;
