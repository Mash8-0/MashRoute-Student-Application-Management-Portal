import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { studentAPI, agentAPI, userAPI } from '../../api/endpoints';
import { toast } from '../../components/ui/toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const COUNTRIES = ['Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','DR Congo','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];

const asString = (schema) => z.preprocess((value) => (value == null ? '' : value), schema);
const optionalString = asString(z.string().optional());
const optionalEmail = asString(z.string().email('Invalid email').optional().or(z.literal('')));

const schema = z.object({
  fullName: asString(z.string().min(2, 'Full name is required')),
  passportNumber: optionalString,
  nationality: optionalString,
  dateOfBirth: optionalString,
  gender: optionalString,
  email: optionalEmail,
  phone: optionalString,
  address: optionalString,
  city: optionalString,
  country: optionalString,
  emergencyContact: optionalString,
  emergencyPhone: optionalString,
  sponsorName: optionalString,
  sponsorContact: optionalString,
  // Academic — SSC
  sscInstitution: optionalString,
  sscGrade: optionalString,
  sscYear: optionalString,
  // Academic — HSC
  hscInstitution: optionalString,
  hscGrade: optionalString,
  hscYear: optionalString,
  // Academic — Diploma
  diplomaInstitution: optionalString,
  diplomaGrade: optionalString,
  diplomaYear: optionalString,
  // Academic — Bachelor
  bachelorInstitution: optionalString,
  bachelorGrade: optionalString,
  bachelorYear: optionalString,
  // Academic — Masters
  mastersInstitution: optionalString,
  mastersGrade: optionalString,
  mastersYear: optionalString,
  // Academic — PhD
  phdInstitution: optionalString,
  phdGrade: optionalString,
  phdYear: optionalString,
  // GPA
  gpa: optionalString,
  // English
  englishProficiency: z.enum(['IELTS', 'PTE', 'MOI', 'NONE']).optional(),
  hasIELTS: z.boolean().optional(),
  ieltsScore: optionalString,
  ieltsExpiry: optionalString,
  hasPTE: z.boolean().optional(),
  pteScore: optionalString,
  hasMOI: z.boolean().optional(),
  sourceType: z.enum(['DIRECT_STUDENT','REGISTERED_AGENT','MANAGED_AGENT','REFERRAL_PARTNER']),
  sourceAgentId: optionalString,
  assignedStaffId: optionalString,
}).superRefine((data, ctx) => {
  if (data.sourceType !== 'DIRECT_STUDENT' && !data.sourceAgentId) ctx.addIssue({ code: 'custom', path: ['sourceAgentId'], message: 'Select Agent is required' });
});

function Field({ label, error, children, required }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
      {children}
    </p>
  );
}

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const ENGLISH_PROFICIENCY_OPTIONS = [
  { value: 'NONE', label: 'None / Not Available' },
  { value: 'IELTS', label: 'IELTS' },
  { value: 'PTE', label: 'PTE' },
  { value: 'MOI', label: 'MOI' },
];

function inferEnglishProficiency(student = {}) {
  if (student.hasIELTS) return 'IELTS';
  if (student.hasPTE) return 'PTE';
  if (student.hasMOI) return 'MOI';
  return 'NONE';
}

const ERROR_LABELS = {
  fullName: 'Full Name',
  email: 'Email',
  englishProficiency: 'English Proficiency',
};

function getFirstFormError(errors) {
  const [field, error] = Object.entries(errors)[0] || [];
  if (!field) return 'Please check the form and try again';
  return error?.message || `${ERROR_LABELS[field] || field} is invalid`;
}

export default function StudentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { englishProficiency: 'NONE', hasIELTS: false, hasPTE: false, hasMOI: false, sourceType: 'DIRECT_STUDENT', sourceAgentId: '', assignedStaffId: '' },
  });
  const [agents, setAgents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAgent, setQuickAgent] = useState({ displayName: '', agencyName: '', contactPerson: '', email: '', phone: '', whatsapp: '', address: '', notes: '' });
  const sourceType = watch('sourceType') || 'DIRECT_STUDENT';
  const sourceAgentId = watch('sourceAgentId');

  const englishProficiency = watch('englishProficiency') || 'NONE';
  const hasIELTS = englishProficiency === 'IELTS';
  const hasPTE = englishProficiency === 'PTE';
  const savingLabel = isEdit ? 'Saving...' : 'Creating Student...';

  useEffect(() => {
    if (!isEdit) return;
    studentAPI.get(id).then((res) => {
      const s = res.data.data;
      reset({
        ...s,
        dateOfBirth: s.dateOfBirth ? s.dateOfBirth.split('T')[0] : '',
        ieltsExpiry: s.ieltsExpiry ? s.ieltsExpiry.split('T')[0] : '',
        sscYear: s.sscYear?.toString() || '',
        hscYear: s.hscYear?.toString() || '',
        diplomaYear: s.diplomaYear?.toString() || '',
        bachelorYear: s.bachelorYear?.toString() || '',
        mastersYear: s.mastersYear?.toString() || '',
        phdYear: s.phdYear?.toString() || '',
        gpa: s.gpa?.toString() || '',
        ieltsScore: s.ieltsScore?.toString() || '',
        pteScore: s.pteScore?.toString() || '',
        englishProficiency: inferEnglishProficiency(s), sourceType: s.sourceType || 'DIRECT_STUDENT', sourceAgentId: s.sourceAgentId || '', assignedStaffId: s.assignedStaffId || '',
        hasIELTS: Boolean(s.hasIELTS),
        hasPTE: Boolean(s.hasPTE),
        hasMOI: Boolean(s.hasMOI),
      });
      setLoading(false);
    }).catch((err) => {
      const status = err.response?.status;
      toast.error(status === 401 ? 'Session expired. Please log in again.' : 'Failed to load student data');
      navigate(-1);
    });
  }, [id, isEdit, reset, navigate]);

  useEffect(() => { userAPI.list({ role: 'STAFF', limit: 50 }).then((r) => setStaff(r.data.data || [])).catch(() => setStaff([])); }, []);
  useEffect(() => {
    if (sourceType === 'DIRECT_STUDENT') { setValue('sourceAgentId', ''); setAgents([]); return; }
    const timer = setTimeout(() => { setAgentsLoading(true); agentAPI.list({ type: sourceType, status: 'ACTIVE', search: agentSearch || undefined, limit: 20 }).then((r) => setAgents(r.data.data || [])).catch(() => toast.error('Failed to load matching agents')).finally(() => setAgentsLoading(false)); }, 250);
    return () => clearTimeout(timer);
  }, [sourceType, agentSearch, setValue]);

  const createQuickAgent = async () => {
    if (!quickAgent.displayName.trim()) return toast.error('Agent name is required');
    try { const r = await agentAPI.create({ ...quickAgent, type: sourceType }); const created = r.data.data; setAgents((old) => [created, ...old]); setValue('sourceAgentId', created.id, { shouldValidate: true }); setShowQuickAdd(false); setQuickAgent({ displayName: '', agencyName: '', contactPerson: '', email: '', phone: '', whatsapp: '', address: '', notes: '' }); toast.success('Agent created'); } catch (e) { toast.error(e.response?.data?.message || 'Failed to create agent'); }
  };

  const onSubmit = async (data) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveError('');
    setSaving(true);
    const payload = {
      ...data,
      sourceAgentId: data.sourceType === 'DIRECT_STUDENT' ? null : data.sourceAgentId,
      assignedStaffId: data.assignedStaffId || null,
      gpa: data.gpa ? parseFloat(data.gpa) : undefined,
      englishProficiency: undefined,
      hasIELTS: data.englishProficiency === 'IELTS',
      hasPTE: data.englishProficiency === 'PTE',
      hasMOI: data.englishProficiency === 'MOI',
      ieltsScore: data.englishProficiency === 'IELTS' && data.ieltsScore ? parseFloat(data.ieltsScore) : undefined,
      ieltsExpiry: data.englishProficiency === 'IELTS' ? data.ieltsExpiry : undefined,
      pteScore: data.englishProficiency === 'PTE' && data.pteScore ? parseInt(data.pteScore) : undefined,
      sscYear: data.sscYear ? parseInt(data.sscYear) : undefined,
      hscYear: data.hscYear ? parseInt(data.hscYear) : undefined,
      diplomaYear: data.diplomaYear ? parseInt(data.diplomaYear) : undefined,
      bachelorYear: data.bachelorYear ? parseInt(data.bachelorYear) : undefined,
      mastersYear: data.mastersYear ? parseInt(data.mastersYear) : undefined,
      phdYear: data.phdYear ? parseInt(data.phdYear) : undefined,
    };
    delete payload.englishProficiency;
    try {
      if (isEdit) {
        await studentAPI.update(id, payload);
        toast.success('Student updated');
        navigate(`/students/${id}`);
      } else {
        const res = await studentAPI.create(payload);
        toast.success('Student created');
        navigate(`/students/${res.data.data.id}`);
      }
    } catch (err) {
      const errorData = err.response?.data;
      const message = errorData?.code === 'STUDENT_ALREADY_EXISTS'
        ? 'Student Record Already Exists'
        : errorData?.message || 'Failed to save student';
      setSaveError(message);
      toast.error(message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onInvalid = (formErrors) => {
    const message = getFirstFormError(formErrors);
    setSaveError(message);
    toast.error(message);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{isEdit ? 'Edit Student' : 'New Student'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update student record' : 'Register a new student'}
          </p>
        </div>
        <Button type="submit" disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? savingLabel : 'Save Student'}
        </Button>
      </div>

      {saveError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left + Centre */}
        <div className="space-y-6 lg:col-span-2">
          {/* Personal */}
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name" error={errors.fullName?.message} required>
                  <Input {...register('fullName')} placeholder="e.g. Ahmad Rahman" />
                </Field>
                <Field label="Passport Number">
                  <Input {...register('passportNumber')} placeholder="e.g. A12345678" />
                </Field>
                <Field label="Nationality">
                  <select {...register('nationality')} className={selectClass}>
                    <option value="">Select nationality</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Date of Birth">
                  <Input type="date" {...register('dateOfBirth')} />
                </Field>
                <Field label="Gender">
                  <select {...register('gender')} className={selectClass}>
                    <option value="">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Email">
                  <Input type="email" {...register('email')} placeholder="student@email.com" />
                </Field>
                <Field label="Phone">
                  <Input {...register('phone')} placeholder="+880 1xxx-xxxxxx" />
                </Field>
                <Field label="City">
                  <Input {...register('city')} placeholder="e.g. Dhaka" />
                </Field>
              </div>
              <Field label="Address">
                <Input {...register('address')} placeholder="Full home address" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Emergency Contact Name">
                  <Input {...register('emergencyContact')} placeholder="Parent / Guardian" />
                </Field>
                <Field label="Emergency Phone">
                  <Input {...register('emergencyPhone')} placeholder="+880 1xxx-xxxxxx" />
                </Field>
                <Field label="Sponsor Name">
                  <Input {...register('sponsorName')} placeholder="Sponsor full name" />
                </Field>
                <Field label="Sponsor Contact">
                  <Input {...register('sponsorContact')} placeholder="Sponsor phone / email" />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Academic */}
          <Card>
            <CardHeader><CardTitle>Academic Background</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <SectionHeading>SSC / O-Level</SectionHeading>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Institution">
                  <Input {...register('sscInstitution')} placeholder="School name" />
                </Field>
                <Field label="Grade / GPA">
                  <Input {...register('sscGrade')} placeholder="e.g. A+ / 5.00" />
                </Field>
                <Field label="Year">
                  <Input type="number" {...register('sscYear')} placeholder="e.g. 2018" />
                </Field>
              </div>

              <SectionHeading>HSC / A-Level</SectionHeading>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Institution">
                  <Input {...register('hscInstitution')} placeholder="College name" />
                </Field>
                <Field label="Grade / GPA">
                  <Input {...register('hscGrade')} placeholder="e.g. A / 4.83" />
                </Field>
                <Field label="Year">
                  <Input type="number" {...register('hscYear')} placeholder="e.g. 2020" />
                </Field>
              </div>

              <SectionHeading>Diploma (if applicable)</SectionHeading>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Institution">
                  <Input {...register('diplomaInstitution')} placeholder="Institute name" />
                </Field>
                <Field label="Grade / GPA">
                  <Input {...register('diplomaGrade')} placeholder="e.g. 3.8" />
                </Field>
                <Field label="Year">
                  <Input type="number" {...register('diplomaYear')} placeholder="e.g. 2021" />
                </Field>
              </div>

              <SectionHeading>Bachelor's Degree (if applicable)</SectionHeading>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Institution">
                  <Input {...register('bachelorInstitution')} placeholder="University name" />
                </Field>
                <Field label="Grade / CGPA">
                  <Input {...register('bachelorGrade')} placeholder="e.g. 3.75" />
                </Field>
                <Field label="Year">
                  <Input type="number" {...register('bachelorYear')} placeholder="e.g. 2023" />
                </Field>
              </div>

              <SectionHeading>Master's Degree (if applicable)</SectionHeading>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Institution">
                  <Input {...register('mastersInstitution')} placeholder="University name" />
                </Field>
                <Field label="Grade / CGPA">
                  <Input {...register('mastersGrade')} placeholder="e.g. 3.9" />
                </Field>
                <Field label="Year">
                  <Input type="number" {...register('mastersYear')} placeholder="e.g. 2025" />
                </Field>
              </div>

              <SectionHeading>PhD / Doctorate (if applicable)</SectionHeading>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Institution">
                  <Input {...register('phdInstitution')} placeholder="University name" />
                </Field>
                <Field label="Grade / CGPA">
                  <Input {...register('phdGrade')} placeholder="e.g. 3.9" />
                </Field>
                <Field label="Year">
                  <Input type="number" {...register('phdYear')} placeholder="e.g. 2028" />
                </Field>
              </div>

              <div className="pt-1">
                <Field label="Overall GPA / CGPA">
                  <Input {...register('gpa')} type="number" step="0.01" min="0" max="5" placeholder="e.g. 3.75" className="max-w-[160px]" />
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* English Proficiency */}
          <Card>
            <CardHeader><CardTitle>English Proficiency</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Student Has">
                <select {...register('englishProficiency')} className={selectClass}>
                  {ENGLISH_PROFICIENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>

              {hasIELTS && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Band Score">
                    <Input {...register('ieltsScore')} placeholder="e.g. 6.5" />
                  </Field>
                  <Field label="Expiry Date">
                    <Input type="date" {...register('ieltsExpiry')} />
                  </Field>
                </div>
              )}

              {hasPTE && (
                <Field label="PTE Score">
                  <Input {...register('pteScore')} placeholder="e.g. 65" />
                </Field>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Agent &amp; Source</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Field label="Student Source" error={errors.sourceType?.message} required>
                <select {...register('sourceType', { onChange: () => setValue('sourceAgentId', '') })} className={selectClass}>
                  <option value="DIRECT_STUDENT">Direct Student</option><option value="REGISTERED_AGENT">Registered Agent</option><option value="MANAGED_AGENT">Managed Agent</option><option value="REFERRAL_PARTNER">Referral Partner</option>
                </select>
              </Field>
              {sourceType !== 'DIRECT_STUDENT' && <>
                <Field label="Search Agents"><Input value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)} placeholder="Name, agency, email or phone" /></Field>
                <Field label="Select Agent" error={errors.sourceAgentId?.message} required>
                  <select {...register('sourceAgentId')} className={selectClass} disabled={agentsLoading}>
                    <option value="">{agentsLoading ? 'Loading...' : agents.length ? 'Select matching agent' : 'No active agents found'}</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.displayName}{a.agencyName ? ` — ${a.agencyName}` : ''}</option>)}
                  </select>
                </Field>
                {sourceAgentId && (() => { const a = agents.find((x) => x.id === sourceAgentId); return a ? <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs"><div className="flex justify-between"><strong>{a.displayName}</strong><button type="button" onClick={() => setValue('sourceAgentId','')}><X className="h-4 w-4" /></button></div><p>{a.type.replaceAll('_',' ')}{a.agencyName ? ` · ${a.agencyName}` : ''}</p><p className="text-muted-foreground">{a.contactPerson || a.email || a.phone || 'No contact supplied'}</p></div> : null; })()}
                <Button type="button" variant="outline" size="sm" onClick={() => setShowQuickAdd(true)}><Plus className="h-4 w-4" /> Add New Agent</Button>
              </>}
              <Field label="Assigned Internal Staff"><select {...register('assignedStaffId')} className={selectClass}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}</select></Field>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? savingLabel : isEdit ? 'Update Student' : 'Create Student'}
          </Button>
        </div>
      </div>
      {showQuickAdd && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true"><Card className="w-full max-w-lg"><CardHeader><CardTitle>Quick Add {sourceType.replaceAll('_',' ')}</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">{[['displayName','Agent Name'],['agencyName','Agency Name'],['contactPerson','Contact Person'],['email','Email'],['phone','Phone'],['whatsapp','WhatsApp'],['address','Address'],['notes','Notes']].map(([key,label]) => <Field key={key} label={label} required={key==='displayName'}><Input value={quickAgent[key]} onChange={(e) => setQuickAgent((q) => ({ ...q, [key]: e.target.value }))} /></Field>)}<div className="col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowQuickAdd(false)}>Cancel</Button><Button type="button" onClick={createQuickAgent}>Create &amp; Select</Button></div></CardContent></Card></div>}
    </form>
  );
}
