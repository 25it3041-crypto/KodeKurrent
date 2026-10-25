const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const {
  generateInterviewQuestions,
  evaluateAnswer,
  generateFinalReport,
  analyzeMotionReport,
  generateFollowUpQuestion,
  normalizeEvaluation,
} = require('../utils/gemini');

// ── Dynamic Confidence Score Helper ─────────────────────────────────────────
function calculateConfidenceIndex(avgScore, trustScore, proctorEvents = [], motionEvents = []) {
  const numericAvg = Number(avgScore) || 0; // Range: 0 - 5
  const numericTrust = Number(trustScore) ?? 100; // Range: 0 - 100

  // 1. Performance weight (60%) + Integrity weight (40%)
  const scoreComponent = (numericAvg / 5) * 60;
  const trustComponent = (numericTrust / 100) * 40;

  // 2. Penalty deduction based on violations
  const highSeverityCount = proctorEvents.filter(e => 
    e.type === 'MULTIPLE_PERSONS' || e.type === 'MULTIPLE_FACES_DETECTED' || e.severity === 'critical'
  ).length;

  const flagPenalty = (proctorEvents.length * 3) + (highSeverityCount * 7) + (motionEvents.length * 2);

  // 3. Final bounded confidence score
  const rawConfidence = scoreComponent + trustComponent - flagPenalty;
  return Math.max(0, Math.min(100, Math.round(rawConfidence)));
}

module.exports = (upload) => {
  // ── POST /api/parse-resume ──────────────────────────────────────────────────
  router.post('/parse-resume', upload.single('resume'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      let text = '';
      const mime = req.file.mimetype;

      if (mime === 'application/pdf') {
        const data = await pdf(req.file.buffer);
        text = data.text;
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'application/msword'
      ) {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        text = result.value;
      } else {
        text = req.file.buffer.toString('utf-8');
      }

      const skills     = extractSkills(text);
      const experience = extractExperience(text);
      const education  = extractEducation(text);

      res.json({ success: true, text: text.substring(0, 5000), skills, experience, education });
    } catch (err) {
      console.error('[Resume Parse]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/generate-questions ───────────────────────────────────────────
  router.post('/generate-questions', async (req, res) => {
    try {
      const body = req.body || {};
      const requested = parseInt(body.questionCount, 10);
      body.questionCount = Number.isFinite(requested) && requested > 0 ? requested : 10;
      const questions = await generateInterviewQuestions(body);
      const list = Array.isArray(questions) ? questions : [];
      res.json({ success: true, questions: list, count: list.length });
    } catch (err) {
      console.error('[Generate Questions]', err);
      res.status(500).json({ error: err.message || 'Failed to generate questions' });
    }
  });

  // ── POST /api/generate-followup ──────────────────────────────────────────
  router.post('/generate-followup', async (req, res) => {
    try {
      const { previousQuestion, question, answer, skill, targetSkill } = req.body || {};
      const result = await generateFollowUpQuestion({
        previousQuestion: previousQuestion || question,
        candidateAnswer: answer,
        targetSkill: targetSkill || skill,
      });
      res.json({
        success: true,
        needsFollowUp: Boolean(result?.needsFollowUp && result?.followUpQuestion),
        followUpQuestion: result?.followUpQuestion || '',
      });
    } catch (err) {
      console.error('[Generate FollowUp Error]:', err);
      res.status(500).json({ error: err.message, needsFollowUp: false });
    }
  });

  // ── POST /api/evaluate-answer ──────────────────────────────────────────────
  router.post('/evaluate-answer', async (req, res) => {
    try {
      const { answer, question } = req.body;
      const cleanAnswer = answer ? answer.trim() : '';

      // Blank or invalid answers default directly to score 0
      if (!cleanAnswer || cleanAnswer.length < 5 || ['no', 'none', 'idk', 'na', 'skip'].includes(cleanAnswer.toLowerCase())) {
        return res.json({
          success: true,
          evaluation: {
            score: 0,
            feedback: "No valid or meaningful answer was provided by the candidate.",
            keyPointsMissed: ["Question was left blank, skipped, or answered with invalid input."]
          }
        });
      }

      const evaluation = normalizeEvaluation(await evaluateAnswer(req.body));

      res.json({
        success: true,
        evaluation,
      });
    } catch (err) {
      console.error('[Evaluate Answer]', err);
      res.status(500).json({ 
        error: err.message,
        evaluation: {
          score: 0,
          feedback: "Evaluation failed due to system error.",
          keyPointsMissed: ["System error during evaluation."]
        }
      });
    }
  });

  // ── POST /api/submit-assessment ────────────────────────────────────────────
  router.post('/submit-assessment', async (req, res) => {
    try {
      const {
        candidateId,
        sessionId,
        name,
        email,
        jobTitle,
        experienceLevel,
        questions,
        answers,
        evaluations,
        trustScore: inputTrustScore,
        proctorEvents = [],
        transcript,
        codingAnswers,
        motionEvents = [],
        questionStatuses = {},
        resumeSkills = [],
        jobConfig = {},
      } = req.body;

      // Extract valid scores
      const scores = (evaluations || []).map(e => {
        const val = Number(e?.score);
        return (!isNaN(val) && val >= 0) ? val : 0;
      });

      const avgScore = scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

      // Dynamic Trust Score Calculation
      let calculatedTrust = inputTrustScore ?? 100;
      proctorEvents.forEach(evt => {
        if (evt.type === 'MULTIPLE_FACES_DETECTED' || evt.type === 'MULTIPLE_PERSONS') {
          calculatedTrust -= 20;
        } else if (evt.type === 'NO_FACE_DETECTED') {
          calculatedTrust -= 10;
        } else if (evt.type === 'BACKGROUND_NOISE_DETECTED' || evt.type === 'MULTIPLE_VOICES') {
          calculatedTrust -= 10;
        } else if (evt.type === 'TAB_SWITCH') {
          calculatedTrust -= 15;
        }
      });
      calculatedTrust = Math.max(0, Math.min(100, calculatedTrust));

      // Calculate Dynamic Confidence Index
      const confidenceIndex = calculateConfidenceIndex(avgScore, calculatedTrust, proctorEvents, motionEvents);

      // Generate AI hiring report
      let aiReport = null;
      try {
        aiReport = await generateFinalReport({
          candidate: { name, jobTitle },
          questions,
          answers,
          scores,
          proctorEvents,
          confidenceIndex,
        });
      } catch (e) {
        console.warn('[Final Report AI]', e.message);
      }

      if (aiReport && (!Array.isArray(aiReport.knowledgeGaps) || aiReport.knowledgeGaps.length === 0)) {
        aiReport.knowledgeGaps = (questions || [])
          .map((q, i) => ({ text: q?.text || q, score: scores[i] || 0 }))
          .filter(item => item.score > 0 && item.score < 3)
          .map(item => item.text)
          .slice(0, 4);
      }

      // Analyze motion events if present
      let motionAnalysis = null;
      if (motionEvents && motionEvents.length > 0) {
        try {
          motionAnalysis = await analyzeMotionReport(motionEvents);
        } catch (e) {
          console.warn('[Motion Analysis]', e.message);
        }
      }

      const finalCandidateId = candidateId || uuidv4();

      const assessment = {
        id: uuidv4(),
        candidateId: finalCandidateId,
        sessionId,
        name,
        email,
        jobTitle,
        experienceLevel,
        questions,
        answers,
        evaluations,
        scores,
        avgScore: avgScore.toFixed(2),
        trustScore: calculatedTrust,
        confidenceIndex, // Saved dynamic confidence value
        proctorEvents,
        motionEvents,
        motionAnalysis,
        transcript: transcript || [],
        codingAnswers: codingAnswers || [],
        questionStatuses,
        resumeSkills,
        jobConfig,
        aiReport,
        submittedAt: new Date().toISOString(),
        status: 'completed',
      };

      req.app.locals.candidates.set(finalCandidateId, assessment);

      // Notify connected HR dashboards with live data
      req.app.locals.io.emit('candidate:submitted', {
        candidateId: finalCandidateId,
        name,
        jobTitle,
        avgScore: assessment.avgScore,
        trustScore: assessment.trustScore,
        confidenceIndex: assessment.confidenceIndex,
        recommendation: aiReport?.recommendation || (avgScore < 2 ? 'REJECT' : 'HOLD'),
      });

      res.json({
        success: true,
        assessmentId: assessment.id,
        candidateId: finalCandidateId,
        confidenceIndex,
        aiReport,
        motionAnalysis,
      });
    } catch (err) {
      console.error('[Submit Assessment]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ── GET /api/stats ─────────────────────────────────────────────────────────
  router.get('/stats', (req, res) => {
    try {
      const all = [...req.app.locals.candidates.values()];
      const totalCandidates = all.length;

      const avgScore = totalCandidates
        ? parseFloat(
            (all.reduce((sum, c) => sum + parseFloat(c.avgScore || 0), 0) / totalCandidates).toFixed(2)
          )
        : 0;

      const avgTrust = totalCandidates
        ? parseFloat(
            (all.reduce((sum, c) => sum + (c.trustScore ?? 100), 0) / totalCandidates).toFixed(1)
          )
        : 100;

      const avgConfidence = totalCandidates
        ? Math.round(all.reduce((sum, c) => sum + (c.confidenceIndex ?? 50), 0) / totalCandidates)
        : 100;

      const hireCount   = all.filter(c => c.aiReport?.recommendation === 'HIRE').length;
      const holdCount   = all.filter(c => c.aiReport?.recommendation === 'HOLD').length;
      const rejectCount = all.filter(c => c.aiReport?.recommendation === 'REJECT').length;

      res.json({
        success: true,
        totalCandidates,
        avgScore,
        avgTrust,
        avgConfidence,
        hireCount,
        holdCount,
        rejectCount,
      });
    } catch (err) {
      console.error('[Stats]', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

// ─── Resume Parsing Helpers ───────────────────────────────────────────────────
function extractSkills(text) {
  const techKeywords = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Swift',
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'FastAPI', 'Spring Boot',
    'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'GraphQL', 'REST', 'gRPC',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Git',
    'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NLP',
    'HTML', 'CSS', 'Tailwind', 'SCSS', 'Webpack', 'Vite',
    'Agile', 'Scrum', 'Linux', 'Microservices', 'System Design',
  ];
  const lower = text.toLowerCase();
  return [...new Set(techKeywords.filter(s => lower.includes(s.toLowerCase())))];
}

function extractExperience(text) {
  const matches = text.match(/(\d+)\s*\+?\s*years?\s+(?:of\s+)?experience/gi) || [];
  return matches.slice(0, 5);
}

function extractEducation(text) {
  const degrees = ['B.Tech', 'B.E.', 'B.Sc', 'M.Tech', 'M.Sc', 'MBA', 'PhD', 'Bachelor', 'Master', 'BE', 'BTech'];
  return degrees.filter(d => text.includes(d));
}