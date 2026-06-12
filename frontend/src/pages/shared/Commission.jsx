import { useState, useEffect, useCallback } from 'react';
import { Wallet, GraduationCap } from 'lucide-react';
import { universityAPI } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';
import PageHeader from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from '../../components/ui/toast';
import { COURSE_LEVELS, LEVEL_LABELS } from '../../lib/universityData';
import { AGENT_CATEGORIES, categoryLabel } from '../../lib/agentCategories';
import CommissionCard from '../../components/commission/CommissionCard';

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function Commission() {
  const { user } = useAuthStore();
  const isStaff = user?.role === 'STAFF';

  const [universities, setUniversities] = useState([]);
  const [univId, setUnivId] = useState('');
  const [level, setLevel] = useState('');
  const [program, setProgram] = useState('');
  const [category, setCategory] = useState(isStaff ? (user?.agentCategory || 'STANDARD') : 'STANDARD');
  const [commissions, setCommissions] = useState([]);
  const [policy, setPolicy] = useState(null);

  useEffect(() => {
    universityAPI.list({ limit: 200 })
      .then((res) => setUniversities(res.data.data || []))
      .catch(() => toast.error('Failed to load universities'));
  }, []);

  const loadCommissions = useCallback((id) => {
    if (!id) { setCommissions([]); setPolicy(null); return; }
    universityAPI.getCommissions(id)
      .then((res) => {
        const data = res.data.data || {};
        setCommissions(data.rows || []);
        setPolicy(data.policy || null);
      })
      .catch(() => { setCommissions([]); setPolicy(null); });
  }, []);

  const onUniversity = (id) => {
    setUnivId(id);
    setLevel('');
    setProgram('');
    loadCommissions(id);
  };

  const selectedUniv = universities.find((u) => u.id === univId);
  const univCourses = Array.isArray(selectedUniv?.courses) ? selectedUniv.courses : [];
  const availableLevels = COURSE_LEVELS.filter((lvl) => univCourses.some((c) => c.level === lvl));
  const levelCourses = level ? univCourses.filter((c) => c.level === level) : [];

  // Resolve: program-specific rate (if set) → university default.
  const resolveRate = (cat) => {
    if (!cat) return null;
    const specific = program && commissions.find((r) => r.course === program && r.category === cat && Number(r.amount) > 0);
    if (specific) return specific;
    return commissions.find((r) => !r.course && r.category === cat) || null;
  };
  const commission = resolveRate(category);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission"
        description="Check the commission for a university and program."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Selector */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-primary" /> Check Commission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium">University</label>
              <select className={selectClass} value={univId} onChange={(e) => onUniversity(e.target.value)}>
                <option value="">— Select university —</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.country})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium">Level</label>
                <select
                  className={selectClass}
                  value={level}
                  onChange={(e) => { setLevel(e.target.value); setProgram(''); }}
                  disabled={!univId}
                >
                  <option value="">— Select —</option>
                  {availableLevels.map((lvl) => (
                    <option key={lvl} value={lvl}>{LEVEL_LABELS[lvl] || lvl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium">Course</label>
                <select className={selectClass} value={program} onChange={(e) => setProgram(e.target.value)} disabled={!level}>
                  <option value="">{level ? '— Select —' : 'Pick level'}</option>
                  {levelCourses.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium">Agent Tier</label>
              {isStaff ? (
                <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                  {categoryLabel(category)}
                </div>
              ) : (
                <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {AGENT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.tier}. {c.label}</option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {isStaff ? 'Your commission tier.' : 'Check any agent tier.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        <div className="lg:col-span-2">
          {univId ? (
            <CommissionCard
              commission={commission}
              policy={policy}
              universityName={selectedUniv?.name}
              program={program}
              category={category}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                <GraduationCap className="h-8 w-8 opacity-40" />
                <p className="text-sm">Select a university to view its commission.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
