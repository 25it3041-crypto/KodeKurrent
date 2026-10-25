import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Camera, Mic, Shield, CheckCircle, XCircle, ChevronRight,
  User, Mail, Phone, Loader2
} from 'lucide-react';
import ResumeUploader from './ResumeUploader';
import QRCodePanel from './QRCodePanel';
import useStore from '../../lib/store';
import { generateQuestions } from '../../lib/api';

export default function OnboardingScreen() {
  const { candidate, setCandidate, session, resumeData, jobConfig, setQuestions, setInterviewPhase } = useStore();
  const [permissions, setPermissions] = useState({ camera: null, mic: null });
  const [consent, setConsent] = useState(false);
  const [rules, setRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPermissions({ camera: true, mic: true });
    } catch (e) {
      setPermissions({ camera: false, mic: false });
    }
  };

  useEffect(() => {
    requestPermissions();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const canProceed =
    permissions.camera && permissions.mic && consent && rules &&
    candidate.name.trim() && candidate.email.trim();

  const handleStartInterview = async () => {
    if (!canProceed) return;
    setLoading(true);
    setError('');
    try {
      const targetCount = jobConfig.questionCount || 10;
      const custom = normalizeCustomQuestions(jobConfig.customQuestions);
      const aiNeeded = Math.max(0, targetCount - custom.length);
      let aiQuestions = [];
      if (aiNeeded > 0) {
        const res = await generateQuestions({
          jobTitle: jobConfig.jobTitle,
          jobDescription: jobConfig.jobDescription,
          requiredSkills: jobConfig.requiredSkills,
          experienceLevel: jobConfig.experienceLevel,
          questionCount: aiNeeded,
          resumeText: resumeData?.text || '',
        });
        aiQuestions = Array.isArray(res.data?.questions) ? res.data.questions : [];
      }
      const merged = mergeQuestionBank(custom, aiQuestions, targetCount, jobConfig);
      setQuestions(merged);
      setInterviewPhase('interview');
    } catch (e) {
      const targetCount = jobConfig.questionCount || 10;
      const custom = normalizeCustomQuestions(jobConfig.customQuestions);
      setQuestions(mergeQuestionBank(custom, generateFallbackQuestions(jobConfig), targetCount, jobConfig));
      setInterviewPhase('interview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left — candidate form */}
      <div className="lg:col-span-2 space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Candidate Onboarding</h2>
          <p className="text-slate-500 text-sm">Complete setup to begin your AI-powered interview</p>
        </div>

        {/* Personal info */}
        <Card title="Personal Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputRow icon={<User className="w-4 h-4" />} label="Full Name" placeholder="Your full name"
              value={candidate.name} onChange={v => setCandidate({ name: v })} />
            <InputRow icon={<Mail className="w-4 h-4" />} label="Email" placeholder="email@example.com"
              value={candidate.email} onChange={v => setCandidate({ email: v })} type="email" />
            <InputRow icon={<Phone className="w-4 h-4" />} label="Phone (optional)" placeholder="+1 234 567 8900"
              value={candidate.phone} onChange={v => setCandidate({ phone: v })} />
          </div>
        </Card>

        {/* Resume */}
        <Card title="Resume Upload (Optional but Recommended)">
          <ResumeUploader />
        </Card>

        {/* Permissions */}
        <Card title="System Permissions">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PermissionRow label="Webcam" granted={permissions.camera} />
            <PermissionRow label="Microphone" granted={permissions.mic} />
          </div>
          {(permissions.camera === false || permissions.mic === false) && (
            <button
              onClick={requestPermissions}
              className="mt-3 text-sm text-indigo-600 underline"
            >
              Retry Permissions
            </button>
          )}
          {/* Live preview */}
          <div className="mt-4 relative rounded-xl overflow-hidden bg-slate-900 aspect-video">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10px] text-white bg-black/50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 recording-dot" />
              Primary Camera Preview
            </div>
          </div>
        </Card>

        {/* Rules & Consent */}
        <Card title="Interview Rules & Privacy">
          <div className="space-y-3 text-sm text-slate-600 mb-4">
            {[
              'No tab switching or window minimization during the interview',
              'No copy-pasting from external sources',
              'Ensure you are alone in a well-lit, quiet environment',
              'Your screen, camera, and microphone activity will be recorded for integrity analysis',
              'A secondary smartphone camera is required for 360° workspace monitoring',
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                {rule}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={rules} onChange={e => setRules(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600" />
              <span className="text-sm text-slate-700">I have read and agree to the interview rules</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-600" />
              <span className="text-sm text-slate-700">I consent to AI-powered proctoring and data processing</span>
            </label>
          </div>
        </Card>

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStartInterview}
          disabled={!canProceed || loading}
          className="w-full py-4 gradient-indigo text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating AI Questions...</>
          ) : (
            <><ChevronRight className="w-5 h-5" /> Start AI Interview</>
          )}
        </motion.button>
      </div>

      {/* Right — QR panel + session info */}
      <div className="space-y-4">
        <QRCodePanel sessionId={session?.sessionId} />

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Session Details</p>
          <div className="space-y-2 text-sm">
            <InfoRow label="Role" value={jobConfig.jobTitle || '—'} />
            <InfoRow label="Level" value={jobConfig.experienceLevel} />
            <InfoRow label="Questions" value={jobConfig.questionCount || 10} />
            <InfoRow label="Duration" value={`${jobConfig.interviewDuration} mins`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 card-shadow">
      <h3 className="font-semibold text-slate-800 mb-4 text-sm">{title}</h3>
      {children}
    </div>
  );
}

function InputRow({ icon, label, placeholder, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
        <span className="text-indigo-500">{icon}</span>{label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 bg-slate-50 text-slate-900 placeholder:text-slate-400"
      />
    </div>
  );
}

function PermissionRow({ label, granted }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg border ${
      granted === null ? 'border-slate-200 bg-slate-50' :
      granted ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
    }`}>
      {granted === null ? <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-indigo-500 animate-spin" /> :
       granted ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
       <XCircle className="w-4 h-4 text-rose-500" />}
      <span className={`text-sm font-medium ${
        granted === null ? 'text-slate-500' :
        granted ? 'text-emerald-700' : 'text-rose-700'
      }`}>{label}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

function normalizeCustomQuestions(list = []) {
  return (list || []).map((q, i) => {
    const text = typeof q === 'string' ? q : (q?.text || '');
    if (!text.trim()) return null;
    return {
      id: `custom-${i + 1}`,
      text: text.trim(),
      type: 'custom',
      difficulty: 'medium',
      expectedKeywords: [],
      followUp: 'Please share a specific example.',
      rubric: '1=vague 2=basic 3=clear 4=detailed 5=expert',
      source: 'recruiter',
    };
  }).filter(Boolean);
}

function mergeQuestionBank(custom, generated, targetCount, cfg) {
  const count = targetCount || 10;
  const generatedSafe = (generated || []).filter(q => q && (q.text || typeof q === 'string'));
  const combined = [...custom, ...generatedSafe].map((q, i) => ({
    ...q,
    id: i + 1,
    text: typeof q === 'string' ? q : q.text,
  }));
  if (combined.length >= count) return combined.slice(0, count);
  const fallback = generateFallbackQuestions({ ...cfg, questionCount: count });
  return [...combined, ...fallback.slice(combined.length)].slice(0, count);
}

function generateFallbackQuestions(cfg) {
  const base = [
    { id: 1, text: `Tell me about yourself and your experience relevant to the ${cfg.jobTitle} role.`, type: 'behavioral', difficulty: 'easy', expectedKeywords: ['experience', 'skills', 'background'], followUp: 'Can you elaborate on a specific project?', rubric: 'Clarity and relevance of background' },
    { id: 2, text: `What are your key technical strengths for this ${cfg.jobTitle} position?`, type: 'technical', difficulty: 'easy', expectedKeywords: cfg.requiredSkills?.split(',').slice(0, 3) || ['technical', 'skills'], followUp: 'Give a concrete example.', rubric: 'Alignment with required skills' },
    { id: 3, text: 'Describe the most complex technical problem you have solved in your career.', type: 'scenario', difficulty: 'medium', expectedKeywords: ['problem', 'solution', 'approach', 'result'], followUp: 'What would you do differently?', rubric: 'Problem-solving depth' },
    { id: 4, text: 'How do you ensure code quality in a team environment?', type: 'technical', difficulty: 'medium', expectedKeywords: ['review', 'testing', 'CI/CD', 'standards'], followUp: 'What metrics do you track?', rubric: 'Quality practices knowledge' },
    { id: 5, text: 'Walk me through your approach to system design for a high-traffic application.', type: 'technical', difficulty: 'hard', expectedKeywords: ['scalability', 'load balancing', 'caching', 'database'], followUp: 'How would you handle 10x traffic growth?', rubric: 'System design depth' },
    { id: 6, text: 'Describe a time you disagreed with a technical decision. How did you handle it?', type: 'behavioral', difficulty: 'medium', expectedKeywords: ['communication', 'compromise', 'data', 'outcome'], followUp: 'What was the final outcome?', rubric: 'Conflict resolution and communication' },
    { id: 7, text: 'How do you stay current with evolving technologies in your field?', type: 'behavioral', difficulty: 'easy', expectedKeywords: ['learning', 'courses', 'community', 'practice'], followUp: 'What did you learn recently?', rubric: 'Growth mindset' },
    { id: 8, text: 'Explain how you would debug a production issue affecting thousands of users.', type: 'scenario', difficulty: 'hard', expectedKeywords: ['logs', 'monitoring', 'rollback', 'root cause'], followUp: 'How do you prevent recurrence?', rubric: 'Incident response methodology' },
    { id: 9, text: 'What is your approach to writing maintainable, clean code?', type: 'technical', difficulty: 'medium', expectedKeywords: ['naming', 'comments', 'patterns', 'refactoring'], followUp: 'Show an example pattern you use.', rubric: 'Code quality philosophy' },
    { id: 10, text: 'Where do you see yourself in 3 years and how does this role fit your plan?', type: 'behavioral', difficulty: 'easy', expectedKeywords: ['growth', 'leadership', 'skills', 'contribution'], followUp: 'What is your first 90-day plan?', rubric: 'Career alignment and ambition' },
  ];
  return base.slice(0, cfg.questionCount || 10);
}
