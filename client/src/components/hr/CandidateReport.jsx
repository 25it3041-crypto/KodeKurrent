import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download, Star, Shield, Brain, AlertTriangle, ChevronDown, ChevronUp,
  Edit3, Save, X, CheckCircle, Clock, Loader2, Gauge
} from 'lucide-react';
import { getCandidate, overrideScore } from '../../lib/api';
import SkillRadarChart from './SkillRadarChart';
import SuspicionTimeline from './SuspicionTimeline';
import AuditEventLog from './AuditEventLog';
import PDFReportExport from './PDFReportExport';

export default function CandidateReport({ candidateId, onBack, onUpdate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedQ, setExpandedQ] = useState(null);
  const [editing, setEditing] = useState(null);
  const [overrideVal, setOverrideVal] = useState(3);
  const [overrideNote, setOverrideNote] = useState('');
  const [hrRec, setHrRec] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('evaluation'); // evaluation | proctoring | audit | skills | report

  useEffect(() => {
    loadCandidate();
  }, [candidateId]);

  const loadCandidate = async () => {
    setLoading(true);
    try {
      const res = await getCandidate(candidateId);
      setData(res.data.candidate);
      setHrRec(res.data.candidate.hrRecommendation || '');
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideSave = async (qIdx) => {
    setSaving(true);
    try {
      await overrideScore(candidateId, {
        questionIndex: qIdx,
        newScore: overrideVal,
        hrNote: overrideNote,
        hrRecommendation: hrRec,
      });
      await loadCandidate();
      setEditing(null);
      onUpdate?.();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <p>Failed to load candidate data</p>
    </div>
  );

  const rec = data.hrRecommendation || data.aiReport?.recommendation || 'HOLD';
  const recColors = { HIRE: 'emerald', HOLD: 'amber', REJECT: 'rose' };
  const rc = recColors[rec] || 'amber';

  // Dynamic Confidence Index Fallback Calculation
  const confidence = data.confidenceIndex ?? Math.round(
    (Number(data.avgScore || 0) / 5) * 60 + ((data.trustScore ?? 100) / 100) * 40 - ((data.proctorEvents?.length || 0) * 4)
  );
  const clampedConfidence = Math.max(0, Math.min(100, confidence));

  return (
    <div className="h-full flex flex-col">
      {/* Report header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center gap-4">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 truncate">{data.name}</h3>
          <p className="text-xs text-slate-400">{data.jobTitle} · {data.experienceLevel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* HR Recommendation Override */}
          <select
            value={hrRec || rec}
            onChange={e => setHrRec(e.target.value)}
            className={`text-xs font-bold border-2 rounded-lg px-3 py-1.5 outline-none cursor-pointer
              ${rc === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                rc === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                'border-rose-200 bg-rose-50 text-rose-700'}`}
          >
            <option value="HIRE">✓ HIRE</option>
            <option value="HOLD">⏸ HOLD</option>
            <option value="REJECT">✗ REJECT</option>
          </select>
          <PDFReportExport data={{ ...data, confidenceIndex: clampedConfidence }} recommendation={hrRec || rec} />
        </div>
      </div>

      {/* Dynamic Score summary */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-5 gap-3">
        <SummaryCard label="Avg Score" value={`${data.avgScore}/5`} color="indigo" />
        <SummaryCard label="Trust Score" value={`${data.trustScore}%`}
          color={data.trustScore >= 80 ? 'emerald' : data.trustScore >= 60 ? 'amber' : 'rose'} />
        <SummaryCard label="AI Confidence" value={`${clampedConfidence}%`}
          color={clampedConfidence >= 75 ? 'emerald' : clampedConfidence >= 45 ? 'amber' : 'rose'} />
        <SummaryCard label="Questions" value={data.questions?.length || 0} color="violet" />
        <SummaryCard label="Flags" value={data.proctorEvents?.length || 0}
          color={data.proctorEvents?.length > 5 ? 'rose' : 'slate'} />
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-slate-100 bg-white flex gap-1 overflow-x-auto">
        {[
          { id: 'evaluation', label: 'Q&A Evaluation' },
          { id: 'proctoring', label: 'Proctoring Events' },
          { id: 'audit', label: '🔍 Audit Log' },
          { id: 'skills', label: 'Skill Radar' },
          { id: 'report', label: 'AI Report' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'evaluation' && (
          <div className="space-y-3">
            {(data.questions || []).map((q, i) => {
              const ev = data.evaluations?.[i] || {};
              const ans = data.answers?.[i] || '';
              const isOpen = expandedQ === i;
              const isEditing = editing === i;
              const score = ev.hrOverrideScore || ev.score || 0;

              return (
                <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden card-shadow">
                  <button
                    onClick={() => setExpandedQ(isOpen ? null : i)}
                    className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <p className="flex-1 text-sm font-medium text-slate-800 truncate">{q.text || q}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <RubricStars score={score} />
                      {ev.hrOverrideScore && <span className="text-[10px] text-violet-600 font-medium">HR Override</span>}
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="border-t border-slate-100 p-4 space-y-3"
                    >
                      {/* Answer */}
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Candidate Answer</p>
                        <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">
                          {ans || <span className="italic text-slate-400">No answer provided</span>}
                        </p>
                      </div>

                      {/* Metrics row */}
                      <div className="grid grid-cols-4 gap-2">
                        <MetricChip label="Technical" value={`${ev.technicalScore ?? '—'}/5`} />
                        <MetricChip label="Complete" value={`${ev.completenessScore ?? '—'}/5`} />
                        <MetricChip label="Clarity" value={`${ev.clarityScore ?? '—'}/5`} />
                        <MetricChip label="AI Det." value={`${ev.aiGeneratedProbability || 0}%`}
                          danger={(ev.aiGeneratedProbability || 0) > 60} />
                      </div>

                      {/* AI Feedback */}
                      {ev.feedback && (
                        <p className="text-xs text-slate-600 bg-indigo-50 rounded-lg px-3 py-2">
                          <span className="font-semibold text-indigo-700">AI Feedback: </span>{ev.feedback}
                        </p>
                      )}

                      {ev.hrNote && (
                        <p className="text-xs text-violet-700 bg-violet-50 rounded-lg px-3 py-2">
                          <span className="font-semibold">HR Note: </span>{ev.hrNote}
                        </p>
                      )}

                      {/* HR Override */}
                      {isEditing ? (
                        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-semibold text-violet-700">Human-in-the-Loop Override</p>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-600">Score:</label>
                            <input type="number" min={0} max={5} value={overrideVal}
                              onChange={e => setOverrideVal(Number(e.target.value))}
                              className="w-16 px-2 py-1 border border-violet-200 rounded-lg text-sm text-center" />
                          </div>
                          <textarea
                            value={overrideNote}
                            onChange={e => setOverrideNote(e.target.value)}
                            placeholder="Add recruiter note..."
                            className="w-full px-2 py-1.5 border border-violet-200 rounded-lg text-xs resize-none"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOverrideSave(i)}
                              disabled={saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 disabled:opacity-60"
                            >
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              Save Override
                            </button>
                            <button onClick={() => setEditing(null)}
                              className="px-3 py-1.5 border border-violet-200 text-violet-600 text-xs rounded-lg hover:bg-violet-100">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditing(i); setOverrideVal(score); setOverrideNote(ev.hrNote || ''); }}
                          className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> HR Manual Override
                        </button>
                      )}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'proctoring' && (
          <SuspicionTimeline events={data.proctorEvents || []} />
        )}

        {activeTab === 'audit' && (
          <div className="space-y-3">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
              <span className="font-semibold">Full Audit Log</span> — Includes frame-level motion analysis, head/neck detection,
              gaze deviation events, tab switches, copy-paste intercepts, and AI speech detection.
              Expand any event for detailed frame metrics.
            </div>
            <AuditEventLog
              events={data.proctorEvents || []}
              motionEvents={data.motionEvents || []}
            />
          </div>
        )}

        {activeTab === 'skills' && (
          <SkillRadarChart
            resumeSkills={data.resumeSkills || []}
            requiredSkills={(data.jobConfig?.requiredSkills || '').split(',').map(s => s.trim())}
            evaluations={data.evaluations || []}
          />
        )}

        {activeTab === 'report' && (
          <AIReportPanel report={data.aiReport} candidate={data} confidenceIndex={clampedConfidence} />
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  const colors = {
    indigo: 'text-indigo-700 bg-indigo-50', emerald: 'text-emerald-700 bg-emerald-50',
    amber: 'text-amber-700 bg-amber-50', rose: 'text-rose-700 bg-rose-50',
    violet: 'text-violet-700 bg-violet-50', slate: 'text-slate-700 bg-slate-100',
  };
  return (
    <div className={`rounded-xl px-3 py-2 text-center ${colors[color] || colors.slate}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] font-medium opacity-70">{label}</p>
    </div>
  );
}

function RubricStars({ score }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`w-3 h-3 ${n <= score ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
      ))}
    </div>
  );
}

function MetricChip({ label, value, danger }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 text-center border ${danger ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[9px] font-medium opacity-70">{label}</p>
    </div>
  );
}

function AIReportPanel({ report, candidate, confidenceIndex }) {
  if (!report) return (
    <div className="text-center text-slate-400 py-16">
      <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>AI report not available. Submit the assessment to generate.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className={`p-5 rounded-2xl border-2 ${
        report.recommendation === 'HIRE' ? 'bg-emerald-50 border-emerald-200' :
        report.recommendation === 'HOLD' ? 'bg-amber-50 border-amber-200' :
        'bg-rose-50 border-rose-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-700">AI Recommendation</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 bg-white/60 px-2.5 py-1 rounded-full border">
              Confidence: {confidenceIndex}%
            </span>
            <span className={`text-lg font-black ${
              report.recommendation === 'HIRE' ? 'text-emerald-700' :
              report.recommendation === 'HOLD' ? 'text-amber-700' : 'text-rose-700'
            }`}>{report.recommendation}</span>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{report.executiveSummary}</p>
      </div>

      {report.strengths?.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500" /> Strengths
          </h4>
          <ul className="space-y-1.5">
            {report.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(report.knowledgeGaps?.length > 0) && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> Knowledge Gaps
          </h4>
          <ul className="space-y-1.5">
            {report.knowledgeGaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.concerns?.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Concerns
          </h4>
          <ul className="space-y-1.5">
            {report.concerns.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.integrityAssessment && (
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Integrity Assessment</p>
          <p className="text-sm text-slate-600">{report.integrityAssessment}</p>
        </div>
      )}

      {report.nextSteps?.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-700 mb-2">Recommended Next Steps</h4>
          <ol className="space-y-1.5">
            {report.nextSteps.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}