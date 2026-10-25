import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Send, ChevronRight, Brain, Code2, Shield,
  SkipForward, Volume2, VolumeX, AlertTriangle, Activity,
  Eye, Wifi, WifiOff, Clock, CheckCircle2, XCircle
} from 'lucide-react';
import useStore from '../../lib/store';
import { useVoiceAgent } from '../../hooks/useVoiceAgent';
import { useProctoring } from '../../hooks/useProctoring';
import { useMotionAnalysis } from '../../hooks/useMotionAnalysis';
import { evaluateAnswer, generateFollowUp, submitAssessment } from '../../lib/api';
import TrustScoreMeter from '../shared/TrustScoreMeter';
import TranscriptTimeline from './TranscriptTimeline';
import CodingEditor from './CodingEditor';
import HeatmapVisualizer from '../shared/HeatmapVisualizer';
import MotionOverlay from '../shared/MotionOverlay';
import QRCodePanel from './QRCodePanel';

export default function InterviewRoom() {
  const {
    questions, currentQuestionIndex, setCurrentQuestionIndex,
    addAnswer, addTranscriptEntry, setInterviewPhase,
    trustScore, proctorEvents, session, candidate, jobConfig,
    evaluations, answers, transcript, codingCode,
    aiGeneratedProbability, setAiGeneratedProbability,
    sentimentScore, setSentimentScore,
    currentDifficulty, setCurrentDifficulty,
    addProctorEvent, deductTrust, motionEvents,
    questionStatuses, setQuestionStatus, resumeData,
  } = useStore();

  const { speak, stopSpeaking, startListening, stopListening, isListening, isSpeaking } = useVoiceAgent();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const lastAnswerRef = useRef('');
  const followUpUsedRef = useRef({});
  const handleAnswerRef = useRef(null);
  const answeringRef = useRef(false);
  const { analyzeFrame } = useProctoring(videoRef, true);
  const { getMotionScore } = useMotionAnalysis(videoRef, true);

  const [phase, setPhase] = useState('intro'); // intro | speaking | listening | evaluating | done
  const [liveTranscript, setLiveTranscript] = useState('');
  const [currentEval, setCurrentEval] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpActive, setFollowUpActive] = useState(false);
  const [muteAI, setMuteAI] = useState(false);
  const [timer, setTimer] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);

  const currentQ = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex >= questions.length - 1;
  const progress = ((currentQuestionIndex + (phase === 'done' ? 1 : 0)) / questions.length) * 100;

  // Interview timer
  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Start webcam
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {});
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => {
    const id = setInterval(() => analyzeFrame?.(), 1500);
    return () => clearInterval(id);
  }, [analyzeFrame]);

  const askQuestion = useCallback((questionText) => {
    setPhase('speaking');
    setLiveTranscript('');
    setCurrentEval(null);
    setShowFollowUp(false);
    addTranscriptEntry({ role: 'ai', text: questionText });

    if (muteAI) {
      setTimeout(() => { setPhase('listening'); startListeningForAnswer(); }, 500);
      return;
    }
    speak(questionText, () => {
      setPhase('listening');
      startListeningForAnswer();
    });
  }, [muteAI, speak, addTranscriptEntry]);

  const startListeningForAnswer = useCallback(() => {
    setPhase('listening');
    startListening(
      (interim) => setLiveTranscript(interim),
      (finalText) => {
        const text = (finalText || lastAnswerRef.current || '').trim();
        if (answeringRef.current) return;
        if (text.length > 3 && handleAnswerRef.current) handleAnswerRef.current(text);
        else startListeningForAnswer();
      }
    );
  }, [startListening]);

  useEffect(() => {
    if (currentQ && phase === 'intro') {
      setTimeout(() => askQuestion(currentQ.text), 1000);
    }
  }, []);

  const handleAnswerComplete = async (answerText) => {
    if (answeringRef.current) return;
    answeringRef.current = true;
    stopListening();
    setPhase('evaluating');
    addTranscriptEntry({ role: 'candidate', text: answerText });

    let evalResult = {
      score: 3, technicalScore: 3, completenessScore: 3, clarityScore: 3,
      feedback: 'Evaluating...', keywordsHit: [], isVague: false,
      aiGeneratedProbability: 0, sentimentScore: 50, shouldAskFollowUp: false,
    };

    try {
      const res = await evaluateAnswer({
        question: currentQ, answer: answerText,
        jobTitle: jobConfig.jobTitle, experienceLevel: jobConfig.experienceLevel,
      });
      evalResult = res.data.evaluation;
    } catch { /* use defaults */ }

    setCurrentEval(evalResult);
    setAiGeneratedProbability(evalResult.aiGeneratedProbability || 0);
    setSentimentScore(evalResult.sentimentScore || 50);

    if (evalResult.score >= 4) setCurrentDifficulty('hard');
    else if (evalResult.score >= 3) setCurrentDifficulty('medium');
    else setCurrentDifficulty('easy');

    if ((evalResult.aiGeneratedProbability || 0) > 70) {
      deductTrust(10, 'AI-generated response detected');
      addProctorEvent({ type: 'ai_response_detected', probability: evalResult.aiGeneratedProbability, severity: 'high' });
    }

    lastAnswerRef.current = answerText;
    setLiveTranscript(answerText);

    try {
      const configuredMax = jobConfig.questionCount || questions.length || 10;
      const followUpsUsed = Object.keys(followUpUsedRef.current).length;
      const canFollowUp = !followUpUsedRef.current[currentQuestionIndex]
        && followUpsUsed < Math.max(1, Math.min(3, Math.floor(configuredMax / 3) || 1));

      const brief = evalResult.isVague
        || evalResult.shouldAskFollowUp
        || (evalResult.completenessScore || 5) <= 2
        || answerText.split(/\s+/).length < 18;

      if (brief && canFollowUp) {
        try {
          const fu = await generateFollowUp({
            previousQuestion: currentQ?.text,
            answer: answerText,
            skill: jobConfig.requiredSkills,
          });
          if (fu.data?.needsFollowUp && fu.data.followUpQuestion) {
            followUpUsedRef.current[currentQuestionIndex] = true;
            setShowFollowUp(false);
            setFollowUpActive(true);
            const fq = fu.data.followUpQuestion;
            addTranscriptEntry({ role: 'ai', text: fq });
            answeringRef.current = false;
            speak(fq, () => { setPhase('listening'); startListeningForAnswer(); });
            return;
          }
        } catch { /* continue without follow-up */ }
      }

      setQuestionStatus(currentQuestionIndex, answerText ? 'completed' : 'unanswered');
      setPhase('done');
    } finally {
      if (answeringRef.current) answeringRef.current = false;
    }
  };

  handleAnswerRef.current = handleAnswerComplete;

  const handleFollowUp = () => {
    setShowFollowUp(false);
    setFollowUpActive(true);
    const fq = currentQ?.followUp || 'Could you elaborate with a specific example?';
    addTranscriptEntry({ role: 'ai', text: fq });
    speak(fq, () => { setPhase('listening'); startListeningForAnswer(); });
  };

  const persistCurrentAnswer = (status = 'completed') => {
    const text = lastAnswerRef.current || liveTranscript || (status === 'skipped' ? '[Skipped]' : '[Unanswered]');
    addAnswer(text, currentEval || {
      score: 0,
      technicalScore: 1,
      completenessScore: 1,
      clarityScore: 1,
      feedback: status === 'skipped' ? 'Question skipped by candidate.' : 'No valid answer captured.',
    });
    setQuestionStatus(currentQuestionIndex, status);
  };

  const handleNextQuestion = () => {
    persistCurrentAnswer(lastAnswerRef.current ? 'completed' : 'unanswered');
    lastAnswerRef.current = '';
    if (isLastQuestion) {
      handleSubmitInterview();
    } else {
      const next = currentQuestionIndex + 1;
      setCurrentQuestionIndex(next);
      setFollowUpActive(false);
      setShowFollowUp(false);
      setTimeout(() => askQuestion(questions[next].text), 300);
    }
  };

  const handleSkipQuestion = () => {
    stopListening();
    stopSpeaking();
    lastAnswerRef.current = '';
    persistCurrentAnswer('skipped');
    if (isLastQuestion) {
      handleSubmitInterview();
    } else {
      const next = currentQuestionIndex + 1;
      setCurrentQuestionIndex(next);
      setFollowUpActive(false);
      setShowFollowUp(false);
      setTimeout(() => askQuestion(questions[next].text), 300);
    }
  };

  const handleSubmitInterview = async () => {
    setSubmitting(true);
    try {
      await submitAssessment({
        sessionId: session?.sessionId,
        name: candidate.name, email: candidate.email,
        jobTitle: jobConfig.jobTitle, experienceLevel: jobConfig.experienceLevel,
        questions,
        answers: useStore.getState().answers,
        evaluations: useStore.getState().evaluations,
        trustScore, proctorEvents,
        motionEvents: useStore.getState().motionEvents,
        transcript: useStore.getState().transcript,
        questionStatuses: useStore.getState().questionStatuses,
        resumeSkills: resumeData?.skills || [],
        jobConfig,
        codingAnswers: [{ code: codingCode }],
      });
    } catch (e) { console.error(e); }
    setInterviewPhase('completed');
  };

  const diffTag = { easy: { label: 'Easy', cls: 'bg-emerald-100 text-emerald-700' }, medium: { label: 'Medium', cls: 'bg-amber-100 text-amber-700' }, hard: { label: 'Hard', cls: 'bg-rose-100 text-rose-700' } };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Top progress bar */}
      <div className="h-1 bg-slate-200 flex-shrink-0">
        <motion.div className="h-full gradient-indigo" style={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
      </div>

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Question</span>
            <span className="font-bold text-indigo-700">{currentQuestionIndex + 1}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">{questions.length}</span>
            <span className="text-[10px] text-slate-400 font-medium">
              {Object.values(questionStatuses).filter(s => s === 'completed').length} done ·{' '}
              {Object.values(questionStatuses).filter(s => s === 'skipped').length} skipped ·{' '}
              {Object.values(questionStatuses).filter(s => s === 'unanswered').length} unanswered
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${diffTag[currentDifficulty]?.cls}`}>
            {diffTag[currentDifficulty]?.label}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 capitalize">
            {currentQ?.type}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            {formatTime(timer)}
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            trustScore >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            trustScore >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <Shield className="w-3 h-3" /> {trustScore}%
          </span>
          <button onClick={() => setMuteAI(!muteAI)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            {muteAI ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowCode(!showCode)} className={`p-1.5 rounded-lg transition-colors ${showCode ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-400'}`}>
            <Code2 className="w-4 h-4" />
          </button>
          <button onClick={() => setShowSidebar(!showSidebar)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors xl:hidden">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Main interview area */}
        <div className="flex-1 overflow-auto p-4 space-y-4 min-w-0">
          {/* Question card */}
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 rounded-2xl p-5 card-shadow"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex-shrink-0 w-10 h-10 gradient-indigo rounded-xl flex items-center justify-center shadow-md">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                {followUpActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 mb-2">
                    🔍 Cross-Examination Follow-up
                  </span>
                )}
                <p className="text-slate-900 font-medium text-base leading-relaxed">{currentQ?.text}</p>
                {isSpeaking && (
                  <div className="flex items-center gap-1.5 mt-3">
                    {[...Array(5)].map((_, i) => (
                      <motion.div key={i} className="w-1 rounded-full bg-indigo-400"
                        animate={{ height: [3, 14, 3] }}
                        transition={{ duration: 0.5, delay: i * 0.08, repeat: Infinity }} />
                    ))}
                    <span className="text-xs text-indigo-500 ml-1 font-medium">AI Interviewer speaking...</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Answer recording area */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 card-shadow space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isListening ? 'bg-rose-100 pulse-ring' :
                phase === 'evaluating' ? 'bg-amber-100' :
                phase === 'done' ? 'bg-emerald-100' : 'bg-slate-100'
              }`}>
                {phase === 'done' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                 isListening ? <Mic className="w-4 h-4 text-rose-600" /> :
                 <MicOff className="w-4 h-4 text-slate-400" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {isListening ? '🎙️ Recording your answer...' :
                   phase === 'speaking' ? 'Please listen to the question' :
                   phase === 'evaluating' ? '⚡ AI evaluating your response...' :
                   phase === 'done' ? 'Answer captured & evaluated' :
                   'Waiting...'}
                </p>
                {isListening && (
                  <p className="text-xs text-slate-400 mt-0.5">Speak clearly • Auto-submits after 3s silence</p>
                )}
              </div>
              {isListening && (
                <div className="ml-auto flex gap-1 items-center">
                  {[...Array(3)].map((_, i) => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-rose-500"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }} />
                  ))}
                </div>
              )}
            </div>

            {/* Live transcript */}
            <div className={`min-h-[90px] p-4 rounded-xl border text-sm leading-relaxed transition-all ${
              isListening ? 'border-rose-200 bg-rose-50/50' :
              liveTranscript ? 'border-slate-200 bg-slate-50' :
              'border-dashed border-slate-200 bg-slate-50/50'
            }`}>
              {liveTranscript ? (
                <p className="text-slate-800">{liveTranscript}</p>
              ) : (
                <p className="text-slate-400 italic text-sm">
                  {isListening ? 'Start speaking now — transcript appears here in real-time...' :
                   phase === 'evaluating' ? 'Processing...' :
                   'Your spoken answer will appear here'}
                </p>
              )}
            </div>

            {/* Evaluation results */}
            <AnimatePresence>
              {currentEval && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <EvalChip label="Overall" value={`${currentEval.score}/5`}
                      color={currentEval.score >= 4 ? 'emerald' : currentEval.score >= 3 ? 'amber' : 'rose'} />
                    <EvalChip label="Technical" value={`${currentEval.technicalScore || '—'}/5`} color="indigo" />
                    <EvalChip label="Complete" value={`${currentEval.completenessScore || '—'}/5`} color="indigo" />
                    <EvalChip label="Clarity" value={`${currentEval.clarityScore || currentEval.communicationScore || '—'}/5`} color="indigo" />
                    <EvalChip label="AI Detect" value={`${currentEval.aiGeneratedProbability || 0}%`}
                      color={(currentEval.aiGeneratedProbability || 0) > 60 ? 'rose' : 'emerald'} />
                    <EvalChip label="Confidence" value={`${currentEval.sentimentScore || 50}%`}
                      color={currentEval.sentimentScore > 60 ? 'emerald' : 'amber'} />
                  </div>
                  {currentEval.feedback && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800">
                      <Brain className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-500" />
                      <span><strong>AI Feedback:</strong> {currentEval.feedback}</span>
                    </div>
                  )}
                  {currentEval.keywordsHit?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {currentEval.keywordsHit.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-medium">
                          ✓ {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Follow-up alert */}
            <AnimatePresence>
              {showFollowUp && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-800 flex-1">Answer seems brief. AI Cross-Examiner will probe deeper.</p>
                  <button onClick={handleFollowUp} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors">Ask Follow-up</button>
                  <button onClick={() => { setShowFollowUp(false); setPhase('done'); }} className="px-3 py-1.5 border border-amber-300 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors">Skip</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {isListening ? (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <button onClick={() => handleAnswerComplete(liveTranscript)}
                  className="sm:col-span-4 py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-rose-100">
                  <Send className="w-4 h-4" /> Submit Answer Now
                </button>
                <button onClick={handleSkipQuestion}
                  className="py-3.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm">
                  Skip
                </button>
              </div>
            ) : phase === 'done' ? (
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleNextQuestion}
                disabled={submitting}
                className="w-full py-4 gradient-indigo text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-60 transition-all text-base">
                {submitting ? (
                  <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Submitting Interview...</>
                ) : isLastQuestion ? (
                  <><Shield className="w-5 h-5" /> Complete Interview & Submit</>
                ) : (
                  <><ChevronRight className="w-5 h-5" /> Next Question ({currentQuestionIndex + 2}/{questions.length})</>
                )}
              </motion.button>
            ) : phase === 'evaluating' ? (
              <div className="w-full py-3.5 bg-slate-100 text-slate-400 font-medium rounded-xl flex items-center justify-center gap-2 text-sm">
                <span className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                AI evaluating your response...
              </div>
            ) : phase === 'speaking' ? (
              <button onClick={() => { stopSpeaking(); setPhase('listening'); startListeningForAnswer(); }}
                className="w-full py-3 border-2 border-indigo-200 text-indigo-600 font-medium rounded-xl hover:bg-indigo-50 flex items-center justify-center gap-2 text-sm transition-colors">
                <SkipForward className="w-4 h-4" /> Skip & Answer Now
              </button>
            ) : null}
          </div>

          {/* Coding editor */}
          <AnimatePresence>{showCode && <CodingEditor key="editor" />}</AnimatePresence>
        </div>

        {/* Right sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="hidden xl:flex flex-col w-72 border-l border-slate-100 bg-white/80 backdrop-blur overflow-auto p-3 gap-3 flex-shrink-0"
            >
              {/* Webcam + motion overlay */}
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video flex-shrink-0 shadow-md">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 recording-dot" />
                  Primary Cam
                </div>
                <MotionOverlay getMotionScore={getMotionScore} />
              </div>

              {/* Secondary cam / QR */}
              {session?.sessionId && (
                <div className="flex-shrink-0">
                  <QRCodePanel sessionId={session.sessionId} compact />
                </div>
              )}

              <TrustScoreMeter />

              {/* Live AI metrics */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live AI Metrics</p>
                <MiniBar label="AI Response Probability" value={aiGeneratedProbability}
                  color={aiGeneratedProbability > 70 ? '#F43F5E' : aiGeneratedProbability > 40 ? '#F59E0B' : '#10B981'} />
                <MiniBar label="Confidence Index" value={sentimentScore}
                  color={sentimentScore > 60 ? '#10B981' : sentimentScore > 40 ? '#F59E0B' : '#F43F5E'} />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Difficulty</span>
                  <span className={`font-bold capitalize ${
                    currentDifficulty === 'hard' ? 'text-rose-600' :
                    currentDifficulty === 'medium' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>{currentDifficulty} ↑</span>
                </div>
              </div>

              <HeatmapVisualizer />
              <TranscriptTimeline />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EvalChip({ label, value, color }) {
  const c = { emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100', amber: 'bg-amber-50 text-amber-800 border-amber-100', rose: 'bg-rose-50 text-rose-800 border-rose-100', indigo: 'bg-indigo-50 text-indigo-800 border-indigo-100' };
  return (
    <div className={`border rounded-xl p-2.5 text-center ${c[color] || c.indigo}`}>
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] font-medium opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

function MiniBar({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold" style={{ color }}>{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${value}%` }} transition={{ duration: 0.4 }} />
      </div>
    </div>
  );
}
