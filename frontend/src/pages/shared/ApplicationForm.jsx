import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { applicationAPI, studentAPI, universityAPI, userAPI, documentAPI } from '../../api/endpoints';
import { toast } from '../../components/ui/toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { APPLICATION_STATUSES, formatStatusLabel } from '../../lib/utils';
import { COURSE_LEVELS, LEVEL_LABELS } from '../../lib/universityData';
import { useAuthStore } from '../../store/authStore';
import DocumentUploadSection from '../../components/documents/DocumentUploadSection';
import CommissionCard from '../../components/commission/CommissionCard';

const REQUIRED_DOC_TYPES = ['PHOTO', 'PASSPORT', 'PASSPORT_FULL_SCAN', 'ACADEMIC_DOCUMENTS'];

const schema = z.object({
  studentId: z.string().min(1, 'Student is required'),
  universityId: z.string().optional(),
  program: z.string().optional(),
  intake: z.string().optional(),
  intakeYear: z.string().optional(),
  country: z.string().optional(),
  priority: z.string().optional(),
  agentId: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

function Field({ label, error, children, required }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function ApplicationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [agents, setAgents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDocs, setStudentDocs] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [policy, setPolicy] = useState(null);

  const canUpdateStatus = ['TENANT_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [level, setLevel] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'MEDIUM',
      status: 'DRAFT',
      studentId: searchParams.get('studentId') || '',
    },
  });

  const selectedUnivId = watch('universityId');
  const selectedStudentId = watch('studentId');
  const selectedAgentId = watch('agentId');
  const selectedProgram = watch('program');
  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedUniv = universities.find((u) => u.id === selectedUnivId);
  const univCourses = Array.isArray(selectedUniv?.courses) ? selectedUniv.courses : [];
  const hasCourses = univCourses.length > 0;
  const hasIntakes = Array.isArray(selectedUniv?.intakes) && selectedUniv.intakes.length > 0;

  // Levels this university actually offers; courses under the chosen level.
  const availableLevels = COURSE_LEVELS.filter((lvl) => univCourses.some((c) => c.level === lvl));
  const levelCourses = level ? univCourses.filter((c) => c.level === level) : [];

  // Intake options: admin-set list, else a generated "Month Year" list.
  const intakeOptions = hasIntakes
    ? selectedUniv.intakes
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        .flatMap((m) => [2025, 2026, 2027].map((y) => `${m} ${y}`))
        .sort((a, b) => a.split(' ')[1] - b.split(' ')[1]);

  // On edit, derive the level from the saved program once courses are loaded.
  useEffect(() => {
    if (level || !hasCourses) return;
    const prog = watch('program');
    const found = univCourses.find((c) => c.name === prog);
    if (found) setLevel(found.level);
  }, [hasCourses, selectedUnivId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Whose commission applies: the assigned agent's tier, else the current user's (if staff).
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const activeCategory = selectedAgent?.agentCategory || (user?.role === 'STAFF' ? user?.agentCategory : null);

  // Resolve a tier's rate: a program-specific override wins, else the university default.
  const resolveRate = (cat) => {
    if (!cat) return null;
    const prog = (selectedProgram || '').trim();
    const specific = prog && commissions.find((r) => r.course === prog && r.category === cat && Number(r.amount) > 0);
    if (specific) return specific;
    return commissions.find((r) => !r.course && r.category === cat) || null;
  };
  const activeCommission = resolveRate(activeCategory);

  // Fetch the selected student's documents (new applications only)
  const refetchStudentDocs = () => {
    if (!selectedStudentId) return;
    documentAPI.list(selectedStudentId).then((res) => {
      setStudentDocs(res.data.data || []);
    }).catch(() => {});
  };

  useEffect(() => {
    if (isEdit || !selectedStudentId) {
      setStudentDocs([]);
      return;
    }
    documentAPI.list(selectedStudentId).then((res) => {
      setStudentDocs(res.data.data || []);
    }).catch(() => setStudentDocs([]));
  }, [selectedStudentId, isEdit]);

  const uploadedTypes = new Set(studentDocs.map((d) => d.type));
  const uploadedRequiredCount = REQUIRED_DOC_TYPES.filter((t) => uploadedTypes.has(t)).length;
  const requiredDone = REQUIRED_DOC_TYPES.every((t) => uploadedTypes.has(t));
  // Gate submission only for NEW applications with a selected student
  const docGateActive = !isEdit && Boolean(selectedStudentId);
  const submitBlocked = docGateActive && !requiredDone;

  // Load reference data — load each independently so one failing (e.g. STAFF
  // lacks permission to list users) never blocks the universities dropdown.
  useEffect(() => {
    universityAPI.list({ limit: 200 })
      .then((res) => setUniversities(res.data.data || []))
      .catch(() => {});
    userAPI.list({ role: 'STAFF', limit: 200 })
      .then((res) => setAgents(res.data.data || []))
      .catch(() => {});
  }, []);

  // Search students
  useEffect(() => {
    const t = setTimeout(() => {
      if (studentSearch.length < 2 && !isEdit) return;
      studentAPI.list({ search: studentSearch, limit: 30 }).then((res) => {
        setStudents(res.data.data || []);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch, isEdit]);

  // Load all students initially for the dropdown
  useEffect(() => {
    studentAPI.list({ limit: 200 }).then((res) => {
      setStudents(res.data.data || []);
    }).catch(() => {});
  }, []);

  // Load existing application for edit
  useEffect(() => {
    if (!isEdit) return;
    applicationAPI.get(id).then((res) => {
      const a = res.data.data;
      reset({
        studentId: a.studentId || '',
        universityId: a.universityId || '',
        program: a.program || '',
        intake: a.intake || '',
        intakeYear: a.intakeYear?.toString() || '',
        country: a.country || '',
        priority: a.priority || 'MEDIUM',
        agentId: a.agentId || '',
        status: a.status || 'DRAFT',
        notes: a.notes || '',
      });
      setLoading(false);
    }).catch(() => {
      toast.error('Application not found');
      navigate(-1);
    });
  }, [id, isEdit, reset, navigate]);

  // Load this university's commission rates + policy (tenant-scoped)
  useEffect(() => {
    if (!selectedUnivId) { setCommissions([]); setPolicy(null); return; }
    universityAPI.getCommissions(selectedUnivId)
      .then((res) => {
        const data = res.data.data || {};
        setCommissions(data.rows || []);
        setPolicy(data.policy || null);
      })
      .catch(() => { setCommissions([]); setPolicy(null); });
  }, [selectedUnivId]);

  // Auto-fill country when university is selected
  useEffect(() => {
    if (!selectedUnivId) return;
    const univ = universities.find((u) => u.id === selectedUnivId);
    if (univ?.country) {
      reset((prev) => ({ ...prev, country: univ.country }));
    }
  }, [selectedUnivId, universities, reset]);

  const onSubmit = async (data) => {
    setSaving(true);
    // When the intake is an admin-set label like "January 2026", derive the year from it.
    const yearFromIntake = (data.intake || '').match(/\b(20\d{2})\b/);
    const payload = {
      ...data,
      intakeYear: data.intakeYear ? parseInt(data.intakeYear) : (yearFromIntake ? parseInt(yearFromIntake[1]) : undefined),
      universityId: data.universityId || undefined,
      agentId: data.agentId || undefined,
    };
    try {
      if (isEdit) {
        await applicationAPI.update(id, payload);
        toast.success('Application updated');
        navigate(`/applications/${id}`);
      } else {
        const res = await applicationAPI.create(payload);
        toast.success('Application created');
        navigate(`/applications/${res.data.data.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save application');
    } finally {
      setSaving(false);
    }
  };

  const sortedUniversities = [...universities].sort((a, b) => {
    if (a.name.includes('IIMAT')) return -1;
    if (b.name.includes('IIMAT')) return 1;
    return a.name.localeCompare(b.name);
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{isEdit ? 'Edit Application' : 'New Application'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update application details' : 'Create a new student application'}
          </p>
        </div>
        <Button type="submit" disabled={saving || submitBlocked} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save Application'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Student Selection */}
          <Card>
            <CardHeader><CardTitle>Student</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!isEdit && (
                <Input
                  placeholder="Search student by name or passport..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="mb-2"
                />
              )}
              <Field label="Select Student" error={errors.studentId?.message} required>
                <select {...register('studentId')} className={selectClass}>
                  <option value="">— Select a student —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} {s.passportNumber ? `(${s.passportNumber})` : ''} · {s.nationality || ''}
                    </option>
                  ))}
                </select>
              </Field>
            </CardContent>
          </Card>

          {/* Required Documents (new application + student selected) */}
          {docGateActive && selectedStudent && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>Required Documents</span>
                  <span className={`text-sm font-semibold ${requiredDone ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {uploadedRequiredCount}/{REQUIRED_DOC_TYPES.length} Uploaded
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!requiredDone && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium text-amber-700">
                        Please upload all required documents before submitting the application.
                      </p>
                      <p className="mt-0.5 text-xs text-amber-600">
                        Required Documents: {uploadedRequiredCount}/{REQUIRED_DOC_TYPES.length} Uploaded
                      </p>
                    </div>
                  </div>
                )}
                <DocumentUploadSection
                  student={selectedStudent}
                  documents={studentDocs}
                  canUpload={true}
                  canDelete={false}
                  onRefresh={refetchStudentDocs}
                />
              </CardContent>
            </Card>
          )}

          {/* Application Details */}
          <Card>
            <CardHeader><CardTitle>Application Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Row 1 — University / Country */}
                <Field label="University" error={errors.universityId?.message}>
                  <select
                    {...register('universityId', {
                      onChange: () => { setLevel(''); setValue('program', ''); setValue('intake', ''); },
                    })}
                    className={selectClass}
                  >
                    <option value="">— Select university —</option>
                    {sortedUniversities.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.country})</option>
                    ))}
                  </select>
                </Field>

                <Field label="Country" error={errors.country?.message}>
                  <Input {...register('country')} placeholder="e.g. Malaysia" />
                </Field>

                {/* Row 2 — Level / Course */}
                {hasCourses ? (
                  <>
                    <Field label="Level">
                      <select
                        className={selectClass}
                        value={level}
                        onChange={(e) => { setLevel(e.target.value); setValue('program', ''); }}
                      >
                        <option value="">— Select level —</option>
                        {availableLevels.map((lvl) => (
                          <option key={lvl} value={lvl}>{LEVEL_LABELS[lvl] || lvl}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Course" error={errors.program?.message}>
                      <select {...register('program')} className={selectClass} disabled={!level}>
                        <option value="">{level ? '— Select course —' : 'Select a level first'}</option>
                        {levelCourses.map((c) => (
                          <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : (
                  <Field label="Program / Course" error={errors.program?.message}>
                    <Input {...register('program')} placeholder={selectedUnivId ? 'No programs set for this university' : 'Select a university first'} />
                  </Field>
                )}

                {/* Row 3 — Intake (Month Year) / Priority */}
                <Field label="Intake" error={errors.intake?.message}>
                  <select {...register('intake')} className={selectClass}>
                    <option value="">— Select intake —</option>
                    {intakeOptions.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Priority" error={errors.priority?.message}>
                  <select {...register('priority')} className={selectClass}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Agent — only admins assign an agent; staff are auto-credited as the agent */}
          {canUpdateStatus && (
            <Card>
              <CardHeader><CardTitle>Assign Agent</CardTitle></CardHeader>
              <CardContent>
                <Field label="Agent / Staff" error={errors.agentId?.message}>
                  <select {...register('agentId')} className={selectClass}>
                    <option value="">— Unassigned —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                    ))}
                  </select>
                </Field>
              </CardContent>
            </Card>
          )}

          {/* University commission (shown once a university is selected) */}
          {selectedUnivId && (
            <CommissionCard
              commission={activeCommission}
              policy={policy}
              universityName={selectedUniv?.name}
              program={selectedProgram}
              category={activeCategory}
            />
          )}

          {/* Status (edit only / admin) */}
          {(isEdit && canUpdateStatus) && (
            <Card>
              <CardHeader><CardTitle>Status</CardTitle></CardHeader>
              <CardContent>
                <Field label="Application Status" error={errors.status?.message}>
                  <select {...register('status')} className={selectClass}>
                    {APPLICATION_STATUSES.map((s) => (
                      <option key={s} value={s}>{formatStatusLabel(s)}</option>
                    ))}
                  </select>
                </Field>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <textarea
                {...register('notes')}
                rows={5}
                placeholder="Any internal notes about this application..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </CardContent>
          </Card>

          {submitBlocked && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-amber-700">
                  Please upload all required documents before submitting the application.
                </p>
                <p className="mt-0.5 text-xs text-amber-600">
                  Required Documents: {uploadedRequiredCount}/{REQUIRED_DOC_TYPES.length} Uploaded
                </p>
              </div>
            </div>
          )}

          <Button type="submit" disabled={saving || submitBlocked} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : isEdit ? 'Update Application' : 'Create Application'}
          </Button>
        </div>
      </div>
    </form>
  );
}
