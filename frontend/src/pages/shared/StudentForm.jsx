import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { studentAPI } from '../../api/endpoints';
import { toast } from '../../components/ui/toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const COUNTRIES = ['Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','DR Congo','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];

const schema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  passportNumber: z.string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9\s-]{2,29}$/, 'Invalid passport number')
    .optional()
    .or(z.literal('')),
  nationality: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string()
    .trim()
    .regex(/^\+?[0-9().\-\s]{5,30}$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  sponsorName: z.string().optional(),
  sponsorContact: z.string().optional(),
  // Academic — SSC
  sscInstitution: z.string().optional(),
  sscGrade: z.string().optional(),
  sscYear: z.string().optional(),
  // Academic — HSC
  hscInstitution: z.string().optional(),
  hscGrade: z.string().optional(),
  hscYear: z.string().optional(),
  // Academic — Diploma
  diplomaInstitution: z.string().optional(),
  diplomaGrade: z.string().optional(),
  diplomaYear: z.string().optional(),
  // Academic — Bachelor
  bachelorInstitution: z.string().optional(),
  bachelorGrade: z.string().optional(),
  bachelorYear: z.string().optional(),
  // Academic — Masters
  mastersInstitution: z.string().optional(),
  mastersGrade: z.string().optional(),
  mastersYear: z.string().optional(),
  // Academic — PhD
  phdInstitution: z.string().optional(),
  phdGrade: z.string().optional(),
  phdYear: z.string().optional(),
  // GPA
  gpa: z.string().optional(),
  // English
  hasIELTS: z.boolean().optional(),
  ieltsScore: z.string().optional(),
  ieltsExpiry: z.string().optional(),
  hasPTE: z.boolean().optional(),
  pteScore: z.string().optional(),
  hasMOI: z.boolean().optional(),
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

export default function StudentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);

  const { register, handleSubmit, reset, watch, setFocus, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { hasIELTS: false, hasPTE: false, hasMOI: false },
  });

  const hasIELTS = watch('hasIELTS');
  const hasPTE = watch('hasPTE');
  const actionLabel = isEdit ? 'Update Student' : 'Create Student';
  const savingLabel = isEdit ? 'Updating Student...' : 'Creating Student...';

  useEffect(() => {
    if (!isEdit) return;
    studentAPI.get(id).then((res) => {
      const s = res.data.data;
      // The API returns null for empty optional fields, but the zod string
      // validators reject null ("Expected string, received null"), which would
      // block every update. Coerce nulls to empty strings before populating.
      const sanitized = Object.fromEntries(
        Object.entries(s).map(([k, v]) => [k, v === null ? '' : v])
      );
      reset({
        ...sanitized,
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
        hasIELTS: Boolean(s.hasIELTS),
        hasPTE: Boolean(s.hasPTE),
        hasMOI: Boolean(s.hasMOI),
      });
      setLoading(false);
    }).catch(() => {
      toast.error('Student not found');
      navigate(-1);
    });
  }, [id, isEdit, reset, navigate]);

  const toOptionalNumber = (value, parser) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return parser(value);
  };

  const normalizePayload = (data) => ({
    ...data,
    passportNumber: typeof data.passportNumber === 'string'
      ? data.passportNumber.trim().toUpperCase()
      : data.passportNumber,
    gpa: toOptionalNumber(data.gpa, parseFloat),
    ieltsScore: toOptionalNumber(data.ieltsScore, parseFloat),
    pteScore: toOptionalNumber(data.pteScore, (v) => parseInt(v, 10)),
    sscYear: toOptionalNumber(data.sscYear, (v) => parseInt(v, 10)),
    hscYear: toOptionalNumber(data.hscYear, (v) => parseInt(v, 10)),
    diplomaYear: toOptionalNumber(data.diplomaYear, (v) => parseInt(v, 10)),
    bachelorYear: toOptionalNumber(data.bachelorYear, (v) => parseInt(v, 10)),
    mastersYear: toOptionalNumber(data.mastersYear, (v) => parseInt(v, 10)),
    phdYear: toOptionalNumber(data.phdYear, (v) => parseInt(v, 10)),
  });

  const getSaveMessage = (err) => {
    const errorData = err.response?.data;
    if (errorData?.code === 'STUDENT_ALREADY_EXISTS') return 'Student Record Already Exists';
    if (err.response?.status === 401) return 'Unauthorized action';
    if (err.response?.status === 403) return 'Unauthorized action';
    if (err.response?.status === 404) return 'Student not found';
    if (errorData?.message) return errorData.message;
    if (err.request && !err.response) return 'Network error';
    return 'Server error';
  };

  const onSubmit = async (data) => {
    if (savingRef.current) return;
    if (isEdit && !id) {
      setSaveError('Missing student ID');
      toast.error('Missing student ID');
      return;
    }

    savingRef.current = true;
    setSaveError('');
    setSaving(true);
    const payload = normalizePayload(data);
    try {
      if (isEdit) {
        await studentAPI.update(id, payload);
        toast.success('Student updated successfully.');
        navigate(`/students/${id}`);
      } else {
        const res = await studentAPI.create(payload);
        toast.success('Student created successfully.');
        navigate(`/students/${res.data.data.id}`);
      }
    } catch (err) {
      console.error('Student save failed', {
        mode: isEdit ? 'update' : 'create',
        status: err.response?.status,
        code: err.response?.data?.code,
        message: err.response?.data?.message || err.message,
      });
      const message = getSaveMessage(err);
      setSaveError(message);
      toast.error(message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onInvalid = (formErrors) => {
    const firstField = Object.keys(formErrors)[0];
    const message = formErrors[firstField]?.message || 'Please fix the highlighted fields';
    setSaveError(message);
    toast.error(message);
    if (firstField) setFocus(firstField);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
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
          {saving ? savingLabel : actionLabel}
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
                <Field label="Passport Number" error={errors.passportNumber?.message}>
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
                <Field label="Email" error={errors.email?.message}>
                  <Input type="email" {...register('email')} placeholder="student@email.com" />
                </Field>
                <Field label="Phone" error={errors.phone?.message}>
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
            <CardContent className="space-y-3">
              {/* IELTS */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('hasIELTS')} className="h-4 w-4 rounded border-input accent-primary" />
                  <span className="text-sm font-medium">IELTS</span>
                </label>
                {hasIELTS && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Field label="Band Score">
                      <Input {...register('ieltsScore')} placeholder="e.g. 6.5" />
                    </Field>
                    <Field label="Expiry Date">
                      <Input type="date" {...register('ieltsExpiry')} />
                    </Field>
                  </div>
                )}
              </div>

              {/* PTE */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('hasPTE')} className="h-4 w-4 rounded border-input accent-primary" />
                  <span className="text-sm font-medium">PTE Academic</span>
                </label>
                {hasPTE && (
                  <Field label="Score">
                    <Input {...register('pteScore')} placeholder="e.g. 65" className="mt-2" />
                  </Field>
                )}
              </div>

              {/* MOI */}
              <div className="rounded-lg border border-border p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('hasMOI')} className="h-4 w-4 rounded border-input accent-primary" />
                  <span className="text-sm font-medium">Medium of Instruction (MOI)</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? savingLabel : actionLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
