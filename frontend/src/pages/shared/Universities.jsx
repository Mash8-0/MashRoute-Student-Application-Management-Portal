import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Loader2, GraduationCap, Mail, Phone, X } from 'lucide-react';
import { universityAPI, tenantAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { toast } from '../../components/ui/toast';
import { useAuthStore } from '../../store/authStore';
import { COUNTRIES, CITIES_BY_COUNTRY, COURSE_LEVELS, COMMON_COURSES, LEVEL_LABELS } from '../../lib/universityData';

const inputClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClass = 'mb-1.5 block text-xs font-medium';

function SectionTitle({ children }) {
  return <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

// ─── Courses builder: pick a level, then choose-or-type a program ───────────────
function CoursesBuilder({ courses, setCourses }) {
  const [level, setLevel] = useState('');
  const [program, setProgram] = useState('');

  const has = (lv, name) => courses.some((c) => c.level === lv && c.name === name);
  const addCourse = (lv, rawName) => {
    const name = (rawName ?? program).trim();
    if (!lv) { toast.error('Select a level first'); return; }
    if (!name) return;
    if (!has(lv, name)) setCourses((prev) => [...prev, { level: lv, name }]);
    setProgram('');
  };
  const remove = (lv, name) =>
    setCourses((prev) => prev.filter((c) => !(c.level === lv && c.name === name)));

  const suggestions = (COMMON_COURSES[level] || []).filter((n) => !has(level, n));
  const usedLevels = COURSE_LEVELS.filter((lv) => courses.some((c) => c.level === lv));

  return (
    <div className="space-y-4">
      {/* Add form: level dropdown → program (choose or type) → add */}
      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium">Level *</label>
          <select className={inputClass} value={level} onChange={(e) => { setLevel(e.target.value); setProgram(''); }}>
            <option value="">Select level…</option>
            {COURSE_LEVELS.map((lv) => <option key={lv} value={lv}>{LEVEL_LABELS[lv]}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium">Program / Course</label>
          <div className="flex gap-2">
            <input
              className={`${inputClass} ${!level ? 'opacity-60' : ''}`}
              list="program-suggestions"
              disabled={!level}
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCourse(level); } }}
              placeholder={level ? `Choose or type… e.g. ${(COMMON_COURSES[level] || [])[0] || 'Program name'}` : 'Select a level first'}
            />
            <datalist id="program-suggestions">
              {(COMMON_COURSES[level] || []).map((n) => <option key={n} value={n} />)}
            </datalist>
            <Button type="button" size="sm" className="h-9 flex-shrink-0" disabled={!level || !program.trim()} onClick={() => addCourse(level)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {/* Quick-pick common programs for the selected level */}
          {level && suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => addCourse(level, n)}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary/40"
                >
                  + {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Added courses, grouped by level */}
      {courses.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">No courses added yet.</p>
      ) : (
        <div className="space-y-2">
          {usedLevels.map((lv) => (
            <div key={lv} className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm font-semibold">{LEVEL_LABELS[lv]}</p>
              <div className="flex flex-wrap gap-1.5">
                {courses.filter((c) => c.level === lv).map((c) => (
                  <span key={c.name} className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                    {c.name}
                    <button type="button" onClick={() => remove(lv, c.name)} className="hover:opacity-70">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function UniversityModal({ university, onClose, onSaved, isSuper, tenants }) {
  const isEdit = Boolean(university?.id);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: university?.name || '',
    code: university?.code || '',
    country: university?.country || '',
    city: university?.city || '',
    website: university?.website || '',
    email: university?.email || '',
    phone: university?.phone || '',
    isActive: university?.isActive !== false,
  });
  const [selectedTenants, setSelectedTenants] = useState((university?.assignedTenants || []).map((t) => t.id));
  const [tenantSearch, setTenantSearch] = useState('');
  const [intakes, setIntakes] = useState(Array.isArray(university?.intakes) ? university.intakes : []);
  const [intakeMonth, setIntakeMonth] = useState('');
  const [intakeYear, setIntakeYear] = useState('');

  const addIntake = () => {
    if (!intakeMonth || !intakeYear) return;
    const v = `${intakeMonth} ${intakeYear}`;
    if (!intakes.includes(v)) setIntakes((prev) => [...prev, v]);
    setIntakeMonth('');
    setIntakeYear('');
  };
  const removeIntake = (v) => setIntakes((prev) => prev.filter((x) => x !== v));

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const toggleTenant = (id) =>
    setSelectedTenants((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const cityOptions = CITIES_BY_COUNTRY[form.country] || [];
  const filteredTenants = (tenants || []).filter((t) =>
    !tenantSearch || t.name.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.name || !form.country) {
      toast.error('Name and country are required');
      return;
    }
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('A valid contact email is required (offer-letter requests are sent here)');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || undefined,
        country: form.country,
        city: form.city || undefined,
        website: form.website || undefined,
        email: form.email,
        phone: form.phone || undefined,
        intakes,
        isActive: form.isActive,
        ...(isSuper && { assignedTenantIds: selectedTenants }),
      };
      if (isEdit) {
        await universityAPI.update(university.id, payload);
        toast.success('University updated');
      } else {
        await universityAPI.create(payload);
        toast.success('University added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save university');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-background shadow-2xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">{isEdit ? 'Edit University Profile' : 'Add University Profile'}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto p-6">
          {/* University Information */}
          <div className="space-y-4">
            <SectionTitle>University Information</SectionTitle>
            <div>
              <label className={labelClass}>University Name *</label>
              <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. University of Malaya" />
            </div>
            <div>
              <label className={labelClass}>University ID</label>
              <input className={inputClass} value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. IIMAT-MY (used in document file names)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Country *</label>
                <select className={inputClass} value={form.country} onChange={(e) => { set('country', e.target.value); set('city', ''); }}>
                  <option value="">Select country…</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input className={inputClass} list="city-options" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Select or type…" />
                <datalist id="city-options">
                  {cityOptions.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input type="url" className={inputClass} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <SectionTitle>University Contact Info</SectionTitle>
            <p className="-mt-2 text-[11px] text-muted-foreground">
              Offer-letter requests from agencies are emailed to this address automatically.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" className={`${inputClass} pl-8`} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="admissions@university.edu" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input className={`${inputClass} pl-8`} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+60 ..." />
                </div>
              </div>
            </div>
          </div>

          {/* Intakes */}
          <div className="space-y-3">
            <SectionTitle>Intakes</SectionTitle>
            <p className="-mt-2 text-[11px] text-muted-foreground">
              Intake sessions agents can pick from when submitting an application (e.g. “February 2026”).
            </p>
            <div className="flex gap-2">
              <select className={inputClass} value={intakeMonth} onChange={(e) => setIntakeMonth(e.target.value)}>
                <option value="">Month…</option>
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select className={inputClass} value={intakeYear} onChange={(e) => setIntakeYear(e.target.value)}>
                <option value="">Year…</option>
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Button type="button" size="sm" className="h-9 flex-shrink-0" disabled={!intakeMonth || !intakeYear} onClick={addIntake}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {intakes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {intakes.map((i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                    {i}
                    <button type="button" onClick={() => removeIntake(i)} className="hover:opacity-70"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Assign to tenants (super admin) */}
          {isSuper && (
            <div className="space-y-3">
              <SectionTitle>Assign to Tenants ({selectedTenants.length} selected)</SectionTitle>
              <p className="-mt-1 text-[11px] text-muted-foreground">
                Only the selected agencies' admins and staff will see this university.
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input className={`${inputClass} pl-8`} value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} placeholder="Search agencies by name…" />
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {filteredTenants.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">No agencies match.</p>
                ) : (
                  filteredTenants.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted">
                      <input type="checkbox" checked={selectedTenants.includes(t.id)} onChange={() => toggleTenant(t.id)} className="h-4 w-4 rounded border-input accent-primary" />
                      <span className="text-sm truncate">{t.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {!isEdit && (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
              After saving the profile, use <span className="font-semibold text-foreground">Manage Courses</span> on the
              university card to add the programs it offers (Foundation, Diploma, Bachelor…).
            </p>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
            <span className="text-sm">Active (visible for new applications)</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : isEdit ? 'Update Profile' : 'Add University Profile'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Manage courses (step 2, after the profile exists) ──────────────────────────
export function CoursesModal({ university, onClose, onSaved, readOnly }) {
  const [courses, setCourses] = useState(Array.isArray(university?.courses) ? university.courses : []);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await universityAPI.update(university.id, { courses });
      toast.success('Courses updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save courses');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl bg-background shadow-2xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">{readOnly ? 'Courses' : 'Manage Courses'}</h2>
            <p className="text-xs text-muted-foreground truncate">{university.name}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          {readOnly ? (
            courses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No courses added yet.</p>
            ) : (
              <div className="space-y-3">
                {COURSE_LEVELS.filter((lvl) => courses.some((c) => c.level === lvl)).map((lvl) => (
                  <div key={lvl} className="rounded-lg border border-border p-3">
                    <p className="mb-2 text-sm font-semibold">{LEVEL_LABELS[lvl]}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {courses.filter((c) => c.level === lvl).map((c) => (
                        <span key={c.name} className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">{c.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Tap the programs this university offers under each level. Add custom ones if needed.
              </p>
              <CoursesBuilder courses={courses} setCourses={setCourses} />
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{readOnly ? 'Close' : 'Cancel'}</Button>
          {!readOnly && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Courses'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Universities() {
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUniv, setEditUniv] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { user } = useAuthStore();
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [tenants, setTenants] = useState([]);
  const navigate = useNavigate();

  const canManage = ['TENANT_ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const detailPath = (uid) => (isSuper ? `/super-admin/universities/${uid}` : `/universities/${uid}`);

  const fetchUniversities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await universityAPI.list({ limit: 200 });
      setUniversities(res.data.data || []);
    } catch {
      toast.error('Failed to load universities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUniversities(); }, [fetchUniversities]);

  // Super admin needs the tenant list for assignment
  useEffect(() => {
    if (!isSuper) return;
    tenantAPI.list({ limit: 200 }).then((res) => setTenants(res.data.data || [])).catch(() => {});
  }, [isSuper]);

  const handleDelete = async (univ) => {
    if (!confirm(`Remove ${univ.name}?`)) return;
    setDeleting(univ.id);
    try {
      await universityAPI.delete(univ.id);
      toast.success('University removed');
      fetchUniversities();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = universities.filter((u) =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.country?.toLowerCase().includes(search.toLowerCase()) ||
    u.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Universities"
        description={`${universities.length} partner universities`}
        actions={
          canManage && (
            <Button onClick={() => { setEditUniv(null); setShowModal(true); }}>
              <Plus className="h-4 w-4" /> Add University
            </Button>
          )
        }
      />

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {search ? 'No universities match your search.' : 'No universities yet. Add one to get started.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((univ) => (
            <Card
              key={univ.id}
              className="overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
              onClick={() => navigate(detailPath(univ.id))}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  {univ.logo ? (
                    <img src={univ.logo} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg border border-border bg-white object-contain p-0.5" />
                  ) : (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <GraduationCap className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-semibold leading-tight truncate">{univ.name}</p>
                      {!univ.isActive && (
                        <span className="flex-shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ml-1">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {univ.city ? `${univ.city}, ` : ''}{univ.country}
                    </p>
                    {univ.email && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" /> {univ.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Courses offered summary */}
                {Array.isArray(univ.courses) && univ.courses.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {[...new Set(univ.courses.map((c) => c.level))].map((lvl) => {
                      const n = univ.courses.filter((c) => c.level === lvl).length;
                      return (
                        <span key={lvl} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {LEVEL_LABELS[lvl] || lvl} · {n}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Super admin: which tenants this university is assigned to */}
                {isSuper && (
                  <div className="mt-3">
                    {(univ.assignedTenants || []).length === 0 ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Not assigned to any tenant
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {univ.assignedTenants.map((t) => (
                          <span key={t.id} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[11px] font-medium text-primary">View profile →</span>
                  {univ.website && (
                    <a
                      href={univ.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[11px] text-muted-foreground hover:text-primary hover:underline max-w-[55%]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {univ.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <UniversityModal
          university={editUniv}
          isSuper={isSuper}
          tenants={tenants}
          onClose={() => { setShowModal(false); setEditUniv(null); }}
          onSaved={fetchUniversities}
        />
      )}
    </div>
  );
}
