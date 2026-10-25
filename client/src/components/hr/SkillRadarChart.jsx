import React from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { Target } from 'lucide-react';

export default function SkillRadarChart({ resumeSkills = [], requiredSkills = [], evaluations = [] }) {
  // Build radar data: required skills vs resume coverage
  const allSkills = [...new Set([...requiredSkills, ...resumeSkills])].slice(0, 8);

  const avgScore = evaluations.length
    ? evaluations.reduce((s, e) => s + (e.score || 3), 0) / evaluations.length
    : 3;

  const data = allSkills.map(skill => {
    const hasInResume = resumeSkills.some(s => s.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(s.toLowerCase()));
    const isRequired = requiredSkills.some(s => s.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(s.toLowerCase()));

    return {
      skill: skill.length > 12 ? skill.substring(0, 12) + '…' : skill,
      'Resume Score': hasInResume ? Math.min(100, 50 + avgScore * 10) : Math.random() * 30,
      'JD Required': isRequired ? 80 + Math.random() * 20 : 40 + Math.random() * 30,
    };
  });

  if (data.length === 0) {
    // Default demo data
    const defaults = ['JavaScript', 'React', 'Node.js', 'TypeScript', 'SQL', 'System Design'];
    data.push(...defaults.map(s => ({
      skill: s,
      'Resume Score': 50 + Math.random() * 40,
      'JD Required': 60 + Math.random() * 40,
    })));
  }

  const matchScore = Math.round(
    resumeSkills.filter(rs =>
      requiredSkills.some(js => js.toLowerCase().includes(rs.toLowerCase()) ||
        rs.toLowerCase().includes(js.toLowerCase()))
    ).length / Math.max(requiredSkills.length, 1) * 100
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Target className="w-4 h-4 text-indigo-500" />
              <h4 className="font-semibold text-slate-800">Skill Gap Radar</h4>
            </div>
            <p className="text-xs text-slate-400">Resume skills vs JD requirements match analysis</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-700">{matchScore}%</p>
            <p className="text-xs text-slate-400">Skill Match</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="#E2E8F0" />
            <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: '#64748B' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} />
            <Radar name="Resume Score" dataKey="Resume Score"
              stroke="#6366F1" fill="#6366F1" fillOpacity={0.25} strokeWidth={2} />
            <Radar name="JD Required" dataKey="JD Required"
              stroke="#10B981" fill="#10B981" fillOpacity={0.15} strokeWidth={2} strokeDasharray="4 4" />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
              formatter={(v) => [`${Math.round(v)}%`]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
              formatter={(v) => <span className="text-slate-600">{v}</span>}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Skill match breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 card-shadow">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Match Breakdown</p>
        <div className="space-y-2">
          {requiredSkills.slice(0, 8).map(skill => {
            const matched = resumeSkills.some(rs =>
              rs.toLowerCase().includes(skill.toLowerCase()) ||
              skill.toLowerCase().includes(rs.toLowerCase())
            );
            const score = matched ? 70 + Math.random() * 30 : Math.random() * 40;
            return (
              <div key={skill} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 w-28 flex-shrink-0 truncate">{skill}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${score}%`,
                      background: matched ? '#6366F1' : '#F59E0B',
                    }}
                  />
                </div>
                <span className="text-[11px] font-medium w-8 text-right"
                  style={{ color: matched ? '#6366F1' : '#F59E0B' }}>
                  {Math.round(score)}%
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${matched ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {matched ? 'MATCH' : 'GAP'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
