const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

// ─── Gemini Client ────────────────────────────────────────────────────────────
function getGemini() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY not configured in .env');
    }
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

// ─── Helper: strip markdown fences and parse JSON ─────────────────────────────
function parseJSON(raw) {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse Gemini response as JSON');
  }
}

// ─── Generate Interview Questions ─────────────────────────────────────────────
/**
 * Returns EXACTLY `questionCount` (default 10) interview questions as a JSON array.
 * Each question has: id, text, type, difficulty, expectedKeywords, followUp, rubric
 */
async function generateInterviewQuestions({
  jobTitle,
  jobDescription,
  requiredSkills,
  experienceLevel,
  questionCount,
  resumeText,
}) {
  const count = parseInt(questionCount, 10) || 10;
  const ai = getGemini();
  const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

  // Distribute question types to fill exactly `count` questions
  const technical  = Math.round(count * 0.40);
  const behavioral = Math.round(count * 0.30);
  const scenario   = count - technical - behavioral; // absorbs rounding remainder

  const prompt = `You are a world-class technical interviewer. Your task is to generate EXACTLY ${count} interview questions for this role.

## Role Details
- Job Title: ${jobTitle}
- Job Description: ${jobDescription}
- Required Skills: ${requiredSkills}
- Experience Level: ${experienceLevel}
- Candidate Resume: ${resumeText || 'Not provided'}

## Instructions
1. Generate EXACTLY ${count} questions — not one more, not one fewer.
2. Distribution: ${technical} technical, ${behavioral} behavioral, ${scenario} scenario-based.
3. Sort from easier to harder within each type (warm-up → deep dive).
4. Cross-reference the resume against JD requirements when shaping questions.
5. Each question must have all required fields.

## Output Format
Return a JSON array of EXACTLY ${count} objects. Each object must have:
- "id": integer from 1 to ${count}
- "text": full question text (clear and specific)
- "type": exactly one of "technical" | "behavioral" | "scenario"
- "difficulty": exactly one of "easy" | "medium" | "hard"
- "expectedKeywords": array of 3–5 key concepts expected in a strong answer
- "followUp": a probing follow-up if the candidate gives a vague or surface answer
- "rubric": concise 1–5 scoring guide (e.g. "1=no understanding … 5=expert-level depth")

Return ONLY the raw JSON array. No markdown, no prose, no explanation.`;

  const parsed = parseJSON(await safeGeminiText(model, prompt));

  // Guarantee exactly `count` questions are returned
  if (!Array.isArray(parsed)) throw new Error('Gemini did not return an array');
  const questions = parsed.slice(0, count);
  // If Gemini returned fewer than expected, pad with generic questions
  while (questions.length < count) {
    const idx = questions.length + 1;
    questions.push({
      id: idx,
      text: `Tell me about a challenging project you worked on as a ${jobTitle}.`,
      type: 'behavioral',
      difficulty: 'medium',
      expectedKeywords: ['problem-solving', 'teamwork', 'outcome'],
      followUp: 'What would you do differently if you faced the same challenge today?',
      rubric: '1=vague 2=basic 3=clear 4=detailed 5=exceptional insight',
    });
  }

  // Re-index ids in case they were off
  return questions.map((q, i) => ({ ...q, id: i + 1 }));
}

// ─── Evaluate a Single Answer ─────────────────────────────────────────────────
async function evaluateAnswer({ question, answer, jobTitle, experienceLevel }) {
  const ai = getGemini();
  const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are a senior ${jobTitle} interviewer evaluating a candidate's answer.

## Context
- Job Title: ${jobTitle}
- Experience Level: ${experienceLevel}
- Question: ${question.text}
- Question Type: ${question.type || 'general'}
- Expected Keywords/Concepts: ${(question.expectedKeywords || []).join(', ')}
- Scoring Rubric: ${question.rubric || '1=poor 3=acceptable 5=excellent'}

## Candidate's Answer
"${answer}"

## Evaluation Task
Score the answer holistically, accounting for the experience level expected. A junior candidate is held to a lower bar than a senior one.

Return a JSON object with EXACTLY these fields:
- "score": integer 1–5 overall score
- "technicalScore": integer 1–5 (accuracy and depth of technical content)
- "completenessScore": integer 1–5 (did they address all parts of the question?)
- "clarityScore": integer 1–5 (communication quality and structure)
- "feedback": string (2–3 constructive sentences — what was good and what was missing)
- "keywordsHit": array of strings (expected keywords that were actually mentioned)
- "isVague": boolean (true if answer is <20 words OR lacks any substance)
- "aiGeneratedProbability": integer 0–100 (likelihood of AI/ChatGPT-generated text based on phrasing patterns)
- "sentimentScore": integer 0–100 (candidate confidence and enthusiasm from word choice)
- "shouldAskFollowUp": boolean (true if a follow-up would yield meaningful extra information)

Return ONLY the raw JSON object. No markdown, no explanation.`;

  try {
    const parsed = parseJSON(await safeGeminiText(model, prompt));
    return normalizeEvaluation(parsed);
  } catch {
    return normalizeEvaluation({
      score: 3, technicalScore: 3, completenessScore: 3, clarityScore: 3,
      feedback: 'Unable to auto-evaluate. Manual review required.',
      keywordsHit: [], isVague: false, aiGeneratedProbability: 0,
      sentimentScore: 50, shouldAskFollowUp: false,
    });
  }
}

// ─── Generate Final Hiring Report ────────────────────────────────────────────
async function generateFinalReport({ candidate, questions, answers, scores, proctorEvents, confidenceIndex }) {
  const ai = getGemini();
  const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const avgScore = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
    : '0.00';

  const questionSummary = (questions || []).slice(0, 15).map((q, i) => ({
    q: q.text,
    type: q.type,
    score: scores[i] ?? 'N/A',
  }));

  const prompt = `You are a senior hiring manager writing a final evaluation report.

## Candidate
- Name: ${candidate.name}
- Job: ${candidate.jobTitle}
- Average Score: ${avgScore}/5
- Confidence Index: ${confidenceIndex ?? 'N/A'}%

## Interview Summary (first 15 Q&A pairs)
${JSON.stringify(questionSummary, null, 2)}

## Proctoring Events
${JSON.stringify((proctorEvents || []).slice(0, 20))}

## Report Task
Based on the above data, write a comprehensive and actionable hiring recommendation.

Return a JSON object with EXACTLY these fields:
- "recommendation": exactly "HIRE" | "HOLD" | "REJECT"
- "confidence": exactly "High" | "Medium" | "Low"
- "executiveSummary": string (3–4 sentences summarizing overall performance and fit)
- "strengths": array of 3–5 specific strength bullet points
- "knowledgeGaps": array of 2–4 specific knowledge gaps or missing skills
- "concerns": array of 2–4 specific concern bullet points
- "integrityAssessment": string (brief note on proctoring anomalies or lack thereof)
- "nextSteps": array of 2–3 recommended concrete next steps

Return ONLY the raw JSON object. No markdown, no explanation.`;

  const fallbackGaps = (questions || [])
    .map((q, i) => ({ q, score: Number(scores[i]) || 0 }))
    .filter(item => item.score > 0 && item.score < 3)
    .slice(0, 4)
    .map(item => item.q?.text || 'Low-scoring topic');

  try {
    const parsed = parseJSON(await safeGeminiText(model, prompt));
    if (!Array.isArray(parsed.knowledgeGaps) || parsed.knowledgeGaps.length === 0) {
      parsed.knowledgeGaps = fallbackGaps;
    }
    return parsed;
  } catch {
    return {
      recommendation: parseFloat(avgScore) >= 3.5 ? 'HIRE' : parseFloat(avgScore) >= 2.5 ? 'HOLD' : 'REJECT',
      confidence: 'Medium',
      executiveSummary: `Candidate scored ${avgScore}/5 overall.`,
      strengths: ['Completed interview'],
      knowledgeGaps: fallbackGaps,
      concerns: [],
      integrityAssessment: 'Normal',
      nextSteps: ['Manual review recommended'],
    };
  }
}

// ─── Analyze Motion / Proctoring Events ──────────────────────────────────────
/**
 * Takes an array of motion events (from mobile camera) and returns a JSON
 * integrity summary with risk flags.
 *
 * @param {Array} events - Array of motion event objects
 * @returns {Promise<Object>} integrity summary
 */
async function analyzeMotionReport(events) {
  if (!events || events.length === 0) {
    return {
      riskLevel: 'LOW',
      riskScore: 0,
      totalEvents: 0,
      summary: 'No motion events recorded. Clean proctoring session.',
      flags: [],
      recommendation: 'No integrity concerns detected.',
    };
  }

  const ai = getGemini();
  const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are an AI proctoring analyst reviewing motion/behavior events from a remote interview session.

## Motion Events (${events.length} total)
${JSON.stringify(events.slice(0, 50), null, 2)}

## Analysis Task
Analyze these events for potential integrity violations. Common flags: excessive movement, looking away frequently, secondary person presence, device usage, suspicious pauses.

Return a JSON object with EXACTLY these fields:
- "riskLevel": exactly "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
- "riskScore": integer 0–100 (0=clean, 100=definite cheating)
- "totalEvents": integer (total number of events analyzed)
- "suspiciousEventCount": integer (number of events that are suspicious)
- "summary": string (2–3 sentences describing overall behavior)
- "flags": array of objects, each with { "type": string, "severity": "low"|"medium"|"high", "description": string, "count": integer }
- "timelineInsights": string (any patterns detected over time — e.g. "heavy movement in first 5 minutes")
- "recommendation": string (1 sentence: what the HR reviewer should do with this data)

Return ONLY the raw JSON object. No markdown, no explanation.`;

  try {
    return parseJSON(await safeGeminiText(model, prompt));
  } catch {
    return {
      riskLevel: 'LOW',
      riskScore: 0,
      totalEvents: events.length,
      suspiciousEventCount: 0,
      summary: 'Motion analysis could not be completed automatically. Manual review recommended.',
      flags: [],
      timelineInsights: 'N/A',
      recommendation: 'Manual proctor review required.',
    };
  }
}

function clampRubric(n, fallback = 3) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(1, Math.min(5, Math.round(v)));
}

function normalizeEvaluation(parsed) {
  const score = clampRubric(parsed?.score, 3);
  return {
    score,
    technicalScore: clampRubric(parsed?.technicalScore, score),
    completenessScore: clampRubric(parsed?.completenessScore, score),
    clarityScore: clampRubric(parsed?.clarityScore ?? parsed?.communicationScore, score),
    communicationScore: clampRubric(parsed?.communicationScore ?? parsed?.clarityScore, score),
    feedback: parsed?.feedback || 'Unable to auto-evaluate. Manual review required.',
    keywordsHit: Array.isArray(parsed?.keywordsHit) ? parsed.keywordsHit : [],
    isVague: Boolean(parsed?.isVague),
    aiGeneratedProbability: Number.isFinite(Number(parsed?.aiGeneratedProbability))
      ? Math.max(0, Math.min(100, Number(parsed.aiGeneratedProbability)))
      : 0,
    sentimentScore: Number.isFinite(Number(parsed?.sentimentScore))
      ? Math.max(0, Math.min(100, Number(parsed.sentimentScore)))
      : 50,
    shouldAskFollowUp: Boolean(parsed?.shouldAskFollowUp || parsed?.isVague),
    keyPointsMissed: Array.isArray(parsed?.keyPointsMissed) ? parsed.keyPointsMissed : [],
  };
}

async function safeGeminiText(model, prompt) {
  const result = await model.generateContent(prompt);
  const response = result?.response;
  if (!response) throw new Error('Empty Gemini response');
  const text = typeof response.text === 'function' ? response.text() : '';
  if (!text || !String(text).trim()) throw new Error('Empty Gemini response text');
  return String(text);
}

// ─── Dynamic Follow-up Question ───────────────────────────────────────────────
async function generateFollowUpQuestion(input = {}, maybeAnswer, maybeSkill) {
  const payload = typeof input === 'object' && input !== null && !Array.isArray(input)
    ? input
    : { previousQuestion: input, candidateAnswer: maybeAnswer, targetSkill: maybeSkill };

  const previousQuestion = payload.previousQuestion
    || payload.question
    || '';
  const questionText = typeof previousQuestion === 'string'
    ? previousQuestion
    : (previousQuestion.text || '');
  const candidateAnswer = (payload.candidateAnswer || payload.answer || '').trim();
  const targetSkill = payload.targetSkill || payload.skill || 'General';

  if (!candidateAnswer || candidateAnswer.length < 8) {
    return {
      needsFollowUp: true,
      followUpQuestion: questionText
        ? `Could you expand on that with a concrete example related to ${targetSkill}?`
        : 'Could you elaborate with a specific example?',
    };
  }

  try {
    const ai = getGemini();
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `You are an AI interviewer conducting a technical assessment.
Question Asked: "${questionText}"
Candidate Answer: "${candidateAnswer}"
Target Skill: "${targetSkill}"

Evaluate if the candidate's answer was incomplete, ambiguous, or needs deeper probing.
If the answer was completely blank or skipped, set needsFollowUp to false and followUpQuestion to "".
Otherwise, if probing would help, generate 1 short, direct follow-up question (max 20 words).

Return ONLY a JSON object:
{"needsFollowUp": true, "followUpQuestion": "<question or empty>"}`;

    const parsed = parseJSON(await safeGeminiText(model, prompt));
    return {
      needsFollowUp: Boolean(parsed.needsFollowUp && parsed.followUpQuestion),
      followUpQuestion: parsed.followUpQuestion || '',
    };
  } catch (err) {
    console.warn('[FollowUp Gen Error]:', err.message);
    return { needsFollowUp: false, followUpQuestion: '' };
  }
}

module.exports = {
  generateInterviewQuestions,
  evaluateAnswer,
  generateFinalReport,
  analyzeMotionReport,
  generateFollowUpQuestion,
  parseJSON,
  clampRubric,
  normalizeEvaluation,
};