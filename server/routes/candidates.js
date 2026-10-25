const express = require('express');
const router = express.Router();

// ── GET /api/candidates ────────────────────────────────────────────────────────
router.get('/candidates', (req, res) => {
  const candidates = [...req.app.locals.candidates.values()];

  const summary = candidates.map(c => ({
    candidateId:      c.candidateId,
    name:             c.name,
    email:            c.email,
    jobTitle:         c.jobTitle,
    experienceLevel:  c.experienceLevel,
    avgScore:         c.avgScore,
    trustScore:       c.trustScore,
    confidenceIndex:  c.confidenceIndex,
    recommendation:   c.aiReport?.recommendation || 'HOLD',
    submittedAt:      c.submittedAt,
    status:           c.status,
    proctorEventCount: (c.proctorEvents  || []).length,
    motionEventCount:  (c.motionEvents   || []).length,
  }));

  res.json({ success: true, candidates: summary });
});

// ── GET /api/candidates/:id ────────────────────────────────────────────────────
router.get('/candidates/:id', (req, res) => {
  const candidate = req.app.locals.candidates.get(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json({ success: true, candidate });
});

// ── PATCH /api/candidates/:id/score ───────────────────────────────────────────
router.patch('/candidates/:id/score', (req, res) => {
  const candidate = req.app.locals.candidates.get(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  const { questionIndex, newScore, hrNote, hrRecommendation } = req.body;

  if (questionIndex !== undefined && candidate.evaluations?.[questionIndex]) {
    candidate.evaluations[questionIndex].hrOverrideScore = newScore;
    candidate.evaluations[questionIndex].hrNote          = hrNote;
    candidate.evaluations[questionIndex].overriddenAt    = new Date().toISOString();
  }

  if (hrRecommendation) {
    candidate.hrRecommendation = hrRecommendation;
    candidate.hrNotes          = hrNote;
  }

  // Recalculate average score using HR overrides where available
  if (candidate.evaluations && candidate.evaluations.length > 0) {
    const scores = candidate.evaluations.map(e => e.hrOverrideScore ?? e.score ?? 3);
    candidate.avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
  }

  req.app.locals.candidates.set(req.params.id, candidate);
  res.json({ success: true, candidate });
});

// ── DELETE /api/candidates/:id ─────────────────────────────────────────────────
router.delete('/candidates/:id', (req, res) => {
  const deleted = req.app.locals.candidates.delete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Candidate not found' });
  res.json({ success: true });
});

module.exports = router;
