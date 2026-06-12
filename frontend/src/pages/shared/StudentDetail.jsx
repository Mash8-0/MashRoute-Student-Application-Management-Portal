import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Plus, FileText, Loader2, Trash2, Receipt, CheckCircle2, CreditCard } from 'lucide-react';
import DocumentUploadSection from '../../components/documents/DocumentUploadSection';
import DocumentTimeline from '../../components/documents/DocumentTimeline';
import StudentAvatar from '../../components/common/StudentAvatar';
import { studentAPI, applicationAPI, documentAPI } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../components/ui/toast';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, getStatusColor, DOCUMENT_TYPES, studentUniqueId } from '../../lib/utils';

const docLabel = (type) => DOCUMENT_TYPES.find((d) => d.value === type)?.label || type;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function AcademicRow({ label, institution, grade, year }) {
  if (!institution && !grade && !year) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs font-semibold text-primary mb-1">{label}</p>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-[10px] text-muted-foreground">Institution</p>
          <p className="font-medium text-xs">{institution || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Grade / GPA</p>
          <p className="font-medium text-xs">{grade || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Year</p>
          <p className="font-medium text-xs">{year || '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [student, setStudent] = useState(null);
  const [applications, setApplications] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(false);

  const canEdit = ['TENANT_ADMIN', 'STAFF', 'SUPER_ADMIN'].includes(user?.role);
  const canDelete = ['TENANT_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, aRes, dRes] = await Promise.all([
        studentAPI.get(id),
        applicationAPI.list({ studentId: id, limit: 50 }),
        documentAPI.list(id),
      ]);
      setStudent(sRes.data.data);
      setApplications(aRes.data.data || []);
      setDocuments(dRes.data.data || []);
    } catch {
      toast.error('Student not found');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const docType = prompt(
      'Select document type:\nPASSPORT, SSC_CERTIFICATE, HSC_CERTIFICATE, DIPLOMA, BACHELOR_DEGREE,\nMASTERS_DEGREE, TRANSCRIPT, BANK_STATEMENT, IELTS_CERTIFICATE,\nPTE_CERTIFICATE, MOI_CERTIFICATE, PHOTO, OFFER_LETTER, ADDITIONAL',
      'ADDITIONAL'
    );
    if (!docType) return;
    setUploadingDoc(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('studentId', id);
      form.append('type', docType.toUpperCase().trim()); // backend expects `type` not `documentType`
      await documentAPI.upload(form);
      toast.success('Document uploaded');
      const dRes = await documentAPI.list(id);
      setDocuments(dRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!confirm('Delete this document?')) return;
    setDeletingDoc(docId);
    try {
      await documentAPI.delete(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeletingDoc(null);
    }
  };

  const handleDeleteStudent = async () => {
    if (!confirm(`Delete student "${student.fullName}"? This will also remove their applications and documents from active lists. This cannot be undone.`)) return;
    setDeletingStudent(true);
    try {
      await studentAPI.delete(id);
      toast.success('Student deleted');
      navigate('/students');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete student');
      setDeletingStudent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) return null;

  const tabs = ['overview', 'applications', 'payment', 'documents'];

  // Workflow documents uploaded against this student's applications (offer letter,
  // payment, EMGS/eVAL approvals, eVisa, flight ticket, tuition proof).
  const WF_DOC_DEFS = [
    ['offerLetterUrl', 'Offer Letter'],
    ['paymentProofUrl', 'EMGS Payment Proof'],
    ['emgsApprovalUrl', 'EMGS Approval Letter'],
    ['evalApprovalUrl', 'eVAL Approval Letter'],
    ['evisaUrl', 'eVisa'],
    ['flightTicketUrl', 'Flight Ticket'],
    ['tuitionProofUrl', 'Tuition Payment Proof'],
  ];
  const appDocs = applications.flatMap((a) =>
    WF_DOC_DEFS.filter(([field]) => a[field]).map(([field, label]) => ({
      key: `${a.id}-${field}`, label, url: a[field], subtitle: a.referenceNo, appId: a.id,
    }))
  );
  const totalDocCount = documents.length + appDocs.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <StudentAvatar student={student} documents={documents} size="lg" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{student.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {student.passportNumber || 'No passport'} · {student.nationality || 'Unknown nationality'}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {studentUniqueId(student)}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/students/${id}/edit`)}>
              <Edit className="h-4 w-4" /> Edit
            </Button>
            <Button size="sm" onClick={() => navigate(`/applications/new?studentId=${id}`)}>
              <Plus className="h-4 w-4" /> New Application
            </Button>
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteStudent}
                disabled={deletingStudent}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {deletingStudent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
            {tab === 'applications' && applications.length > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{applications.length}</span>
            )}
            {tab === 'documents' && totalDocCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{totalDocCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  ['Full Name', student.fullName],
                  ['Passport No.', student.passportNumber],
                  ['Nationality', student.nationality],
                  ['Date of Birth', formatDate(student.dateOfBirth)],
                  ['Gender', student.gender],
                  ['Email', student.email],
                  ['Phone', student.phone],
                  ['City / Country', [student.city, student.country].filter(Boolean).join(', ') || '—'],
                  ['Emergency Contact', student.emergencyContact],
                  ['Emergency Phone', student.emergencyPhone],
                  ['Sponsor Name', student.sponsorName],
                  ['Sponsor Contact', student.sponsorContact],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value || '—'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Academic Background</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <AcademicRow label="SSC / O-Level" institution={student.sscInstitution} grade={student.sscGrade} year={student.sscYear} />
                <AcademicRow label="HSC / A-Level" institution={student.hscInstitution} grade={student.hscGrade} year={student.hscYear} />
                <AcademicRow label="Diploma" institution={student.diplomaInstitution} grade={student.diplomaGrade} year={student.diplomaYear} />
                <AcademicRow label="Bachelor's Degree" institution={student.bachelorInstitution} grade={student.bachelorGrade} year={student.bachelorYear} />
                <AcademicRow label="Master's Degree" institution={student.mastersInstitution} grade={student.mastersGrade} year={student.mastersYear} />
                {student.gpa && (
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground">Overall GPA / CGPA</p>
                    <p className="text-sm font-semibold text-primary">{student.gpa}</p>
                  </div>
                )}
                {!student.sscInstitution && !student.hscInstitution && !student.bachelorInstitution && !student.diplomaInstitution && !student.mastersInstitution && (
                  <p className="text-sm text-muted-foreground py-2">No academic records added.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>English Proficiency</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">IELTS</p>
                    <p className="font-medium">
                      {student.hasIELTS
                        ? `Yes — ${student.ieltsScore || '?'} band${student.ieltsExpiry ? ` (exp. ${formatDate(student.ieltsExpiry)})` : ''}`
                        : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">PTE Academic</p>
                    <p className="font-medium">{student.hasPTE ? `Yes — ${student.pteScore || '?'}` : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">MOI Certificate</p>
                    <p className="font-medium">{student.hasMOI ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Applications Tab ── */}
      {activeTab === 'applications' && (
        <div className="space-y-3">
          {canEdit && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => navigate(`/applications/new?studentId=${id}`)}>
                <Plus className="h-4 w-4" /> New Application
              </Button>
            </div>
          )}
          {applications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">No applications yet.</CardContent>
            </Card>
          ) : (
            applications.map((app) => (
              <Card
                key={app.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/applications/${app.id}`)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-primary">{app.referenceNo}</p>
                    <p className="text-sm font-medium truncate">{app.university?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{app.program || 'No program'} · {app.intake} {app.intakeYear}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={app.status} />
                    <span className="text-xs text-muted-foreground">{formatDate(app.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Payment Tab ── */}
      {activeTab === 'payment' && (
        <div className="space-y-3">
          {applications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">No applications yet.</CardContent>
            </Card>
          ) : (
            applications.map((app) => {
              const paymentDone = !!app.paymentProofUrl;
              const verified = !!app.paymentVerifiedAt;
              const invoiced = !!app.invoiceIssuedAt;
              const chip = (ok, label) => (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  ok ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                }`}>
                  {ok && <CheckCircle2 className="h-3 w-3" />} {label}
                </span>
              );
              return (
                <Card key={app.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <CreditCard className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {app.university?.name || app.program || 'Application'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{app.referenceNo}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-xs flex-shrink-0" onClick={() => navigate(`/applications/${app.id}`)}>
                        Open
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {chip(paymentDone, paymentDone ? 'Payment proof uploaded' : 'No payment proof')}
                      {chip(verified, verified ? 'Payment verified' : 'Not verified')}
                      {chip(invoiced, invoiced ? 'Invoice issued' : 'No invoice')}
                    </div>
                    <div className="flex items-center gap-2 border-t border-border pt-3">
                      <Button size="sm" variant="outline" disabled className="gap-1.5">
                        <Receipt className="h-3.5 w-3.5" /> Generate Invoice
                      </Button>
                      <span className="text-[11px] text-muted-foreground">Invoice generation coming soon.</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Documents Tab ── */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <DocumentTimeline
            documents={documents}
            canDelete={canDelete}
            onRefresh={async () => {
              const dRes = await documentAPI.list(id);
              setDocuments(dRes.data.data || []);
            }}
          />
          <DocumentUploadSection
            student={student}
            documents={documents}
            canUpload={canEdit}
            canDelete={canDelete}
            extraDocs={appDocs}
            onRefresh={async () => {
              const dRes = await documentAPI.list(id);
              setDocuments(dRes.data.data || []);
            }}
          />
        </div>
      )}
    </div>
  );
}
