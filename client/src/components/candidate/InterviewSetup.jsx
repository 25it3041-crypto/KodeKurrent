import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, FileText, Sliders, ChevronRight, Sparkles,
  Zap, Clock, Hash, Users, Target, Info, Plus, Trash2, HelpCircle
} from 'lucide-react';
import useStore from '../../lib/store';
import { createSession } from '../../lib/api';

const EXPERIENCE_LEVELS = ['Entry-Level', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Principal'];

const DEMO_CONFIG = {
  jobTitle: 'Senior React Developer',
  jobDescription: 'We are looking for a Senior React Developer with 5+ years of experience building scalable, high-performance web applications. You will be responsible for architecting complex frontend solutions, mentoring junior engineers, and driving technical decisions. Strong knowledge of TypeScript, state management, system design, and API integration is required.',
  requiredSkills: 'React, TypeScript, Node.js, System Design, PostgreSQL, Redis, AWS, CI/CD',
  experienceLevel: 'Senior',
  interviewDuration: 30,
  questionCount: 10,
  customQuestions: [],
};

export default function InterviewSetup() {
  const { jobConfig, setJobConfig, setInterviewPhase, setSession } = useStore();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [skillInput, setSkillInput] = useState('');
  const [customInput, setCustomInput] = useState('');

  const skills = jobConfig.requiredSkills
    ? jobConfig.requiredSkills.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const customQuestions = jobConfig.customQuestions || [];

  const addSkill = (val) => {
    const trimmed = val.trim().replace(/,$/, '');
    if (!trimmed) return;
    const newSkills = [...new Set([...skills, trimmed])];
    setJobConfig({ requiredSkills: newSkills.join(', ') });
    setSkillInput('');
  };

  const removeSkill = (s) => {
    const newSkills = skills.filter(x => x !== s);
    setJobConfig({ requiredSkills: newSkills.join(', ') });
  };

  const addCustomQuestion = () => {
    if (!customInput.trim()) return;
    const newQuestions = [...customQuestions, { text: customInput.trim(), type: 'custom' }];
    setJobConfig({ customQuestions: newQuestions });
    setCustomInput('');
  };

  const removeCustomQuestion = (index) => {
    const newQuestions = customQuestions.filter((_, i) => i !== index);
    setJobConfig({ customQuestions: newQuestions });
  };

  const validate = () => {
    const e = {};
    if (!jobConfig.jobTitle?.trim()) e.jobTitle = 'Required';
    if (!jobConfig.jobDescription?.trim()) e.jobDescription = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleStart = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const questionCount = jobConfig.questionCount || 10;
      const payload = {
        ...jobConfig,
        questionCount,
        customQuestions: jobConfig.customQuestions || [],
      };
      setJobConfig(payload);
      const res = await createSession(payload);
      setSession(res.data.session);
      setInterviewPhase('onboarding');
    } catch {
      const questionCount = jobConfig.questionCount || 10;
      const payload = { ...jobConfig, questionCount };
      setJobConfig(payload);
      setSession({ sessionId: crypto.randomUUID(), ...payload });
      setInterviewPhase('onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    setJobConfig(DEMO_CONFIG);
    setSkillInput('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" /> Recruiter Configuration Panel
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Configure AI Interview Session</h1>
        <p className="text-slate-500">Define the role — Gemini AI generates 10 tailored questions from JD + Resume</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Form — 3 cols */}
        <div className="lg:col-span-3 space-y-5">
          {/* Demo config banner */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-indigo-900">Quick Demo Mode</p>
              <p className="text-xs text-indigo-600">Pre-fill with Senior React Developer role configuration</p>
            </div>
            <button onClick={handleDemo}
              className="flex-shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm">
              Use Demo
            </button>
          </motion.div>

          {/* Job Title & Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Job Title" icon={<Briefcase className="w-4 h-4" />} error={errors.jobTitle}>
              <input className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 bg-white text-slate-900 placeholder:text-slate-400 transition-all"
                placeholder="e.g. Senior React Developer"
                value={jobConfig.jobTitle || ''} onChange={e => setJobConfig({ jobTitle: e.target.value })} />
            </FormField>
            <FormField label="Experience Level" icon={<Users className="w-4 h-4" />}>
              <div className="flex flex-wrap gap-1.5">
                {EXPERIENCE_LEVELS.map(l => (
                  <button key={l} onClick={() => setJobConfig({ experienceLevel: l })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      jobConfig.experienceLevel === l
                        ? 'gradient-indigo text-white border-transparent shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            </FormField>
          </div>

          {/* Skills tag input */}
          <FormField label="Required Skills" icon={<Target className="w-4 h-4" />}>
            <div className="border border-slate-200 rounded-xl bg-white p-2.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-50 transition-all">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {skills.map(s => (
                  <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                    {s}
                    <button onClick={() => removeSkill(s)} className="hover:text-rose-600 transition-colors">×</button>
                  </span>
                ))}
              </div>
              <input className="w-full text-sm outline-none text-slate-800 placeholder:text-slate-400"
                placeholder="Type skill, press Enter or comma..."
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput); } }}
                onBlur={() => addSkill(skillInput)} />
            </div>
          </FormField>

          {/* Recruiter Custom Questions Injection */}
          <FormField label="Mandatory Custom Questions" icon={<HelpCircle className="w-4 h-4 text-indigo-500" />}>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Inject custom recruiter question..."
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomQuestion())}
                />
                <button
                  onClick={addCustomQuestion}
                  type="button"
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {customQuestions.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {customQuestions.map((q, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs">
                      <span className="text-slate-700 font-medium truncate flex-1 pr-2">{i + 1}. {q.text || q}</span>
                      <button
                        onClick={() => removeCustomQuestion(i)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormField>

          {/* Job Description */}
          <FormField label="Job Description" icon={<FileText className="w-4 h-4" />} error={errors.jobDescription}>
            <textarea className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 bg-white text-slate-900 placeholder:text-slate-400 transition-all resize-none"
              rows={4}
              placeholder="Paste the full job description — AI will cross-analyze this with the resume to generate ultra-tailored questions..."
              value={jobConfig.jobDescription || ''} onChange={e => setJobConfig({ jobDescription: e.target.value })} />
          </FormField>

          {/* Duration & Question count */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Duration (minutes)" icon={<Clock className="w-4 h-4" />}>
              <div className="space-y-2">
                <input type="range" min={10} max={120} step={5}
                  value={jobConfig.interviewDuration || 30}
                  onChange={e => setJobConfig({ interviewDuration: Number(e.target.value) })}
                  className="w-full accent-indigo-600" />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>10 min</span>
                  <span className="font-bold text-indigo-600 text-sm">{jobConfig.interviewDuration || 30} min</span>
                  <span>120 min</span>
                </div>
              </div>
            </FormField>
            <FormField label="Questions" icon={<Hash className="w-4 h-4" />}>
              <div className="space-y-2">
                <input type="range" min={3} max={20} step={1}
                  value={jobConfig.questionCount || 10}
                  onChange={e => setJobConfig({ questionCount: Number(e.target.value) })}
                  className="w-full accent-indigo-600" />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>3</span>
                  <span className="font-bold text-indigo-600 text-sm">{jobConfig.questionCount || 10} questions</span>
                  <span>20</span>
                </div>
              </div>
            </FormField>
          </div>

          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleStart} disabled={loading}
            className="w-full py-4 gradient-indigo text-white font-bold rounded-2xl flex items-center justify-center gap-2.5 shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed text-base transition-all">
            {loading ? (
              <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Creating Session...</>
            ) : (
              <><Sparkles className="w-5 h-5" /> Launch AI Interview Session</>
            )}
          </motion.button>
        </div>

        {/* Right: Preview card — 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className="bg-white border border-slate-200 rounded-2xl p-5 card-shadow sticky top-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Session Preview</p>

            <div className="space-y-3">
              <PreviewRow label="Role" value={jobConfig.jobTitle || '—'} />
              <PreviewRow label="Level" value={jobConfig.experienceLevel || 'Mid-Level'} />
              <PreviewRow label="Questions" value={`${jobConfig.questionCount || 10} questions`} />
              <PreviewRow label="Custom Injected" value={`${customQuestions.length} custom`} />
              <PreviewRow label="Duration" value={`${jobConfig.interviewDuration || 30} minutes`} />
              <PreviewRow label="Skills Tracked" value={skills.length > 0 ? `${skills.length} skills` : '—'} />
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-600 mb-2">AI Features Active</p>
              <div className="space-y-1.5">
                {[
                  'Gemini 1.5 Flash question generation',
                  'Adaptive follow-up question engine',
                  'Real-time answer evaluation',
                  'AI speech probability detection',
                  'Frame motion analysis (canvas)',
                  'Dual-camera WebRTC pairing',
                  'Live Trust Score tracking',
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Candidates will need to verify their email via OTP before joining the interview session.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, icon, error, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-2">
        <span className="text-indigo-500">{icon}</span>{label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-500 font-medium">{error?.message || JSON.stringify(error)}</p>}
    </div>
  );
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <span className="text-xs font-bold text-slate-800 text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}