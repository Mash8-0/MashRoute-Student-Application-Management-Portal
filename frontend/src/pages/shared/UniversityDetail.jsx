import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, GraduationCap, Mail, Phone, Globe, MapPin, Hash, Edit, Trash2,
  Loader2, Upload, Building2, BookOpen, Wallet, X, Clock, CalendarDays,
} from 'lucide-react';
import { universityAPI, tenantAPI } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from '../../components/ui/toast';
import { COURSE_LEVELS, LEVEL_LABELS } from '../../lib/universityData';
import { AGENT_CATEGORIES, formatCommission, COMMISSION_RELEASE_OPTIONS, releaseLabel, PAYOUT_METHODS } from '../../lib/agentCategories';
import { UniversityModal, CoursesModal } from './Universities';

function InfoRow({ icon: Icon, label, value, href }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">{value}</a>
        ) : (
          <p className="text-sm text-foreground break-words">{value}</p>
        )}
      </div>
    </div>
  );
}

const cInput = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const DEFAULT_COURSE = ''; // "" = applies to all programs

const blankRows = () => AGENT_CATEGORIES.map((c) => ({ category: c.value, amount: '', type: 'FIXED', currency: 'MYR' }));
const cloneRows = (rows) => (rows || blankRows()).map((r) => ({ ...r }));

// Tenant admin sets commission: pick a level → select course(s) → set rates → apply.
function CommissionModal({ university, initialRows, initialPolicy, onClose, onSaved }) {
  const courses = Array.isArray(university?.courses) ? university.courses : [];
  const levelsWithCourses = COURSE_LEVELS.filter((lvl) => courses.some((c) => c.level === lvl));

  const [releaseTiming, setReleaseTiming] = useState(initialPolicy?.releaseTiming || 'AFTER_REGISTRATION');
  const [commissionType, setCommissionType] = useState(initialPolicy?.commissionType || '');
  const [payoutTime, setPayoutTime] = useState(initialPolicy?.payoutTime || '');
  const [payoutMethod, setPayoutMethod] = useState(initialPolicy?.payoutMethod || 'Bank Transfer');
  const [specialBonus, setSpecialBonus] = useState(initialPolicy?.specialBonus || '');
  const [policyNotes, setPolicyNotes] = useState(initialPolicy?.notes || '');

  // Build the source-of-truth map: course ("" = default) → 8 category rows.
  const initialMap = useRef(null);
  if (!initialMap.current) {
    const map = { [DEFAULT_COURSE]: blankRows() };
    courses.forEach((c) => { map[c.name] = blankRows(); });
    (initialRows || []).forEach((r) => {
      const key = r.course || DEFAULT_COURSE;
      if (!map[key]) map[key] = blankRows();
      const row = map[key].find((x) => x.category === r.category);
      if (row) { row.amount = r.amount ?? ''; row.type = r.type || 'FIXED'; row.currency = r.currency || 'MYR'; }
    });
    initialMap.current = map;
  }

  const [rowsByCourse, setRowsByCourse] = useState(initialMap.current);
  const [level, setLevel] = useState('DEFAULT');           // 'DEFAULT' | a COURSE_LEVELS value
  const [selected, setSelected] = useState([]);            // course names (real levels only)
  const [editor, setEditor] = useState(() => cloneRows(initialMap.current[DEFAULT_COURSE]));
  const [saving, setSaving] = useState(false);

  const courseHasRates = (c) => (rowsByCourse[c] || []).some((r) => Number(r.amount) > 0);
  const levelCourseNames = level === 'DEFAULT' ? [] : courses.filter((c) => c.level === level).map((c) => c.name);
  const targets = level === 'DEFAULT' ? [DEFAULT_COURSE] : selected;
  const editorEnabled = level === 'DEFAULT' || selected.length > 0;

  const onLevel = (lv) => {
    setLevel(lv);
    setSelected([]);
    setEditor(lv === 'DEFAULT' ? cloneRows(rowsByCourse[DEFAULT_COURSE]) : blankRows());
  };

  const toggleCourse = (name) => {
    const next = selected.includes(name) ? selected.filter((x) => x !== name) : [...selected, name];
    setSelected(next);
    // Prefill the editor when a single course is selected (so you can edit it); blank when none.
    if (next.length === 1) setEditor(cloneRows(rowsByCourse[next[0]]));
    else if (next.length === 0) setEditor(blankRows());
  };

  const allSelected = levelCourseNames.length > 0 && selected.length === levelCourseNames.length;
  const toggleAll = () => {
    if (allSelected) { setSelected([]); setEditor(blankRows()); }
    else { setSelected(levelCourseNames); if (levelCourseNames.length === 1) setEditor(cloneRows(rowsByCourse[levelCourseNames[0]])); }
  };

  const setEditorRow = (cat, k, v) => setEditor((prev) => prev.map((r) => (r.category === cat ? { ...r, [k]: v } : r)));

  // Stamp the editor onto the current target course(s).
  const stamp = (map) => {
    if (!targets.length) return map;
    const m = { ...map };
    targets.forEach((c) => { m[c] = cloneRows(editor); });
    return m;
  };
  const handleApply = () => {
    setRowsByCourse((prev) => stamp(prev));
    const n = targets.length;
    toast.success(level === 'DEFAULT' ? 'Default rate set' : `Applied to ${n} course${n > 1 ? 's' : ''}`);
  };
  const clearCourse = (name) => {
    setRowsByCourse((prev) => ({ ...prev, [name]: blankRows() }));
    if (selected.length === 1 && selected[0] === name) setEditor(blankRows());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalMap = stamp(rowsByCourse); // commit the current editor to its target(s)
      const payload = [];
      Object.entries(finalMap).forEach(([cKey, crows]) =>
        crows.forEach((r) => payload.push({
          course: cKey,
          category: r.category,
          amount: r.amount === '' ? 0 : Number(r.amount),
          type: r.type,
          currency: r.currency || 'MYR',
        }))
      );
      const policy = {
        releaseTiming,
        commissionType: commissionType.trim() || null,
        payoutTime: payoutTime.trim() || null,
        payoutMethod: payoutMethod.trim() || null,
        specialBonus: specialBonus.trim() || null,
        notes: policyNotes.trim() || null,
      };
      const res = await universityAPI.setCommissions(university.id, payload, policy);
      toast.success('Commission structure saved');
      onSaved(res.data.data || { rows: [], policy: null });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save commissions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Commission Structure</h2>
            <p className="truncate text-xs text-muted-foreground">{university.name} · by level, course & agent tier</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-6">
          {/* Step 1 — level */}
          <div>
            <label className="mb-1.5 block text-xs font-medium">1. Level</label>
            <select className={cInput} value={level} onChange={(e) => onLevel(e.target.value)}>
              <option value="DEFAULT">All Programs (default){courseHasRates(DEFAULT_COURSE) ? ' • set' : ''}</option>
              {levelsWithCourses.map((lvl) => (
                <option key={lvl} value={lvl}>{LEVEL_LABELS[lvl] || lvl}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {level === 'DEFAULT'
                ? 'Base rate used when a course has no specific rate.'
                : 'Pick the courses under this level to set their commission.'}
            </p>
          </div>

          {/* Step 2 — courses (real levels only) */}
          {level !== 'DEFAULT' && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium">2. Courses ({selected.length} selected)</label>
                {levelCourseNames.length > 0 && (
                  <button type="button" onClick={toggleAll} className="text-[11px] font-medium text-primary hover:underline">
                    {allSelected ? 'Clear all' : 'Select all'}
                  </button>
                )}
              </div>
              {levelCourseNames.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No courses under this level. Add them via Manage Courses first.
                </p>
              ) : (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                  {levelCourseNames.map((name) => (
                    <div key={name} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={selected.includes(name)}
                        onChange={() => toggleCourse(name)}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                      <span className="flex-1 truncate text-sm">{name}</span>
                      {courseHasRates(name) && (
                        <>
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">set</span>
                          <button type="button" onClick={() => clearCourse(name)} title="Clear rates" className="text-muted-foreground hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — rates */}
          <div>
            <label className="mb-1.5 block text-xs font-medium">3. Commission by Agent Tier</label>
            {!editorEnabled ? (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                Select one or more courses above to set their rates.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Agent Category</span>
                  <span className="w-28 text-center">Amount</span>
                  <span className="w-28 text-center">Type</span>
                </div>
                <div className="space-y-2">
                  {editor.map((r) => {
                    const meta = AGENT_CATEGORIES.find((c) => c.value === r.category);
                    return (
                      <div key={r.category} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg border border-border p-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{meta.tier}. {meta.label}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{meta.desc}</p>
                        </div>
                        <input
                          type="number" min="0" step="0.01"
                          className={`${cInput} w-28`}
                          value={r.amount}
                          onChange={(e) => setEditorRow(r.category, 'amount', e.target.value)}
                          placeholder="0"
                        />
                        <select className={`${cInput} w-28`} value={r.type} onChange={(e) => setEditorRow(r.category, 'type', e.target.value)}>
                          <option value="FIXED">MYR (fixed)</option>
                          <option value="PERCENTAGE">% (percent)</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
                {level !== 'DEFAULT' && (
                  <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={handleApply} disabled={!selected.length}>
                    Apply to {selected.length} selected course{selected.length === 1 ? '' : 's'}
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Commission terms (applies to the whole university) */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold">Commission Terms</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Commission Type</label>
                <input className={cInput} value={commissionType} onChange={(e) => setCommissionType(e.target.value)} placeholder="e.g. Claimable / Upfront" />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Payout Time</label>
                <input className={cInput} value={payoutTime} onChange={(e) => setPayoutTime(e.target.value)} placeholder="e.g. 30 to 60 Days" />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Payable / Released</label>
                <select className={cInput} value={releaseTiming} onChange={(e) => setReleaseTiming(e.target.value)}>
                  {COMMISSION_RELEASE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Payout Method</label>
                <select className={cInput} value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value)}>
                  {PAYOUT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Special Bonus</label>
              <input className={cInput} value={specialBonus} onChange={(e) => setSpecialBonus(e.target.value)} placeholder="e.g. If applicable / RM 500 per student" />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Notes</label>
              <textarea
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={policyNotes}
                onChange={(e) => setPolicyNotes(e.target.value)}
                placeholder="e.g. 50% upfront, balance after registration; paid within 30 days of enrolment."
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Commission'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function UniversityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const canManage = ['TENANT_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [univ, setUniv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [showCourses, setShowCourses] = useState(false);
  const [showCommission, setShowCommission] = useState(false);
  const [commissions, setCommissions] = useState([]);
  const [policy, setPolicy] = useState(null);
  const isTenantAdmin = user?.role === 'TENANT_ADMIN';
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const logoInput = useRef(null);

  const fetchUniv = useCallback(async () => {
    setLoading(true);
    try {
      const res = await universityAPI.get(id);
      setUniv(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'University not found');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchUniv(); }, [fetchUniv]);
  useEffect(() => {
    if (!isSuper) return;
    tenantAPI.list({ limit: 200 }).then((res) => setTenants(res.data.data || [])).catch(() => {});
  }, [isSuper]);
  // Commissions are tenant-scoped; super admin (no tenant) has none to show.
  useEffect(() => {
    if (isSuper) return;
    universityAPI.getCommissions(id).then((res) => {
      const data = res.data.data || {};
      setCommissions(data.rows || []);
      setPolicy(data.policy || null);
    }).catch(() => {});
  }, [id, isSuper]);

  const handleLogo = async (file) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await universityAPI.uploadLogo(id, fd);
      setUniv(res.data.data);
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Remove ${univ.name}?`)) return;
    setDeleting(true);
    try {
      await universityAPI.delete(id);
      toast.success('University removed');
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!univ) return null;

  const courses = Array.isArray(univ.courses) ? univ.courses : [];
  const usedLevels = COURSE_LEVELS.filter((lvl) => courses.some((c) => c.level === lvl));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Edit className="h-4 w-4" /> Edit Profile
            </Button>
            {isSuper && (
              <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Profile card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* Logo */}
            <div className="relative flex-shrink-0">
              {univ.logo ? (
                <img src={univ.logo} alt="" className="h-24 w-24 rounded-xl border border-border bg-white object-contain p-1" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-primary/10">
                  <GraduationCap className="h-10 w-10 text-primary" />
                </div>
              )}
              {canManage && (
                <>
                  <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleLogo(f); }} />
                  <button
                    onClick={() => logoInput.current?.click()}
                    disabled={uploadingLogo}
                    className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-muted disabled:opacity-60"
                    title={univ.logo ? 'Replace logo' : 'Upload logo'}
                  >
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </button>
                </>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{univ.name}</h1>
                {univ.isActive
                  ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Active</span>
                  : <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Inactive</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {[univ.city, univ.country].filter(Boolean).join(', ')}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InfoRow icon={Hash} label="University ID" value={univ.code} />
                <InfoRow icon={Mail} label="Email" value={univ.email} href={univ.email ? `mailto:${univ.email}` : null} />
                <InfoRow icon={Phone} label="Phone" value={univ.phone} />
                <InfoRow icon={Globe} label="Website" value={univ.website?.replace(/^https?:\/\//, '')} href={univ.website} />
                <InfoRow icon={MapPin} label="Location" value={[univ.city, univ.country].filter(Boolean).join(', ')} />
              </div>

              {/* Intakes (admin-set) */}
              {Array.isArray(univ.intakes) && univ.intakes.length > 0 && (
                <div className="mt-4 flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Intakes</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {univ.intakes.map((i) => (
                        <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground">{i}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assigned tenants (super admin) */}
      {isSuper && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm"><Building2 className="h-4 w-4 text-primary" /> Assigned Agencies</CardTitle>
          </CardHeader>
          <CardContent>
            {(univ.assignedTenants || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not assigned to any agency yet. Use <span className="font-medium text-foreground">Edit Profile</span> to assign.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {univ.assignedTenants.map((t) => (
                  <span key={t.id} className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{t.name}</span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Courses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><BookOpen className="h-4 w-4 text-primary" /> Courses Offered ({courses.length})</CardTitle>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setShowCourses(true)}>
              <Edit className="h-3.5 w-3.5" /> {courses.length > 0 ? 'Manage' : 'Add Courses'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No courses added yet.{canManage ? ' Click "Add Courses" to add the programs this university offers.' : ''}
            </p>
          ) : (
            <div className="space-y-3">
              {usedLevels.map((lvl) => (
                <div key={lvl} className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-semibold">{LEVEL_LABELS[lvl] || lvl}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {courses.filter((c) => c.level === lvl).map((c) => (
                      <span key={c.name} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground">{c.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission by agent category (tenant admin / staff only) */}
      {!isSuper && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4 text-primary" /> Commission by Agent Category</CardTitle>
            {isTenantAdmin && (
              <Button variant="outline" size="sm" onClick={() => setShowCommission(true)}>
                <Edit className="h-3.5 w-3.5" /> {commissions.length > 0 ? 'Edit' : 'Set Commission'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <p className="-mt-1 mb-3 text-[11px] text-muted-foreground">
              {isTenantAdmin
                ? 'Set the commission your agency earns for this university, per program and agent tier. Agents see the rate for their tier and chosen program when submitting an application.'
                : 'Commission rates set by your agency for this university, by program and agent tier.'}
            </p>

            {/* Commission terms */}
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5 text-primary" /> Released: {releaseLabel(policy?.releaseTiming)}
              </span>
              {policy?.notes && <span className="text-muted-foreground">· {policy.notes}</span>}
            </div>
            {(() => {
              // Group by program: default ("") first, then each program that has rates.
              const programsWithRates = [...new Set(commissions.filter((r) => r.course && Number(r.amount) > 0).map((r) => r.course))];
              const groups = [{ key: '', label: 'All Programs (default)' }, ...programsWithRates.map((p) => ({ key: p, label: p }))];
              return (
                <div className="space-y-4">
                  {groups.map((g) => (
                    <div key={g.key || 'default'} className="overflow-hidden rounded-lg border border-border">
                      <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold">{g.label}</div>
                      <table className="w-full text-sm">
                        <tbody>
                          {AGENT_CATEGORIES.map((c) => {
                            const row = commissions.find((r) => (r.course || '') === g.key && r.category === c.value);
                            const set = row && Number(row.amount) > 0;
                            // For program groups, only show categories that override the default.
                            if (g.key && !set) return null;
                            return (
                              <tr key={c.value} className="border-b border-border last:border-0">
                                <td className="px-3 py-2 text-muted-foreground">{c.tier}</td>
                                <td className="px-3 py-2 font-medium">{c.label}</td>
                                <td className={`px-3 py-2 text-right font-semibold ${set ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {set ? formatCommission(row) : 'Not set'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {showEdit && (
        <UniversityModal
          university={univ}
          isSuper={isSuper}
          tenants={tenants}
          onClose={() => setShowEdit(false)}
          onSaved={fetchUniv}
        />
      )}
      {showCommission && (
        <CommissionModal
          university={univ}
          initialRows={commissions}
          initialPolicy={policy}
          onClose={() => setShowCommission(false)}
          onSaved={(data) => { setCommissions(data.rows || []); setPolicy(data.policy || null); }}
        />
      )}
      {showCourses && (
        <CoursesModal
          university={univ}
          readOnly={!canManage}
          onClose={() => setShowCourses(false)}
          onSaved={fetchUniv}
        />
      )}
    </div>
  );
}
