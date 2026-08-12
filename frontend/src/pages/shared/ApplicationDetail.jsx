import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Send, Loader2, Wifi, CheckCircle2, Clock,
  Upload, FileText, CreditCard, ShieldCheck, Receipt, ChevronDown,
  Download, Eye, Trash2, AlertCircle, TrendingUp, X, PlaneLanding, XCircle, Wallet, Mail,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { applicationAPI, documentAPI, loeAPI } from '../../api/endpoints';
import LOEActions from '../../components/loe/LOEActions';
import StudentAvatar from '../../components/common/StudentAvatar';
import ArrivalCard from '../../components/documents/ArrivalCard';
import { STAGES } from '../../lib/documentStages';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../components/ui/toast';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import StatusBadge from '../../components/common/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  formatDate, formatStatusLabel, getInitials, studentUniqueId,
  WORKFLOW_STAGES, EMGS_STAGES, APPLICATION_STATUSES,
  POST_EVAL_UNLOCK_PCT, POST_EVAL_STAGES, postEvalIndex,
} from '../../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ['TENANT_ADMIN', 'SUPER_ADMIN'];

// Statuses that can be set via the status dropdown (after ACCEPTED, before EMGS)
const STATUS_DROPDOWN_OPTIONS = [
  'AWAITING_VERIFICATION', 'SENT_TO_UNIVERSITY',
  'AWAITING_OFFER_LETTER', 'OFFER_LETTER_ISSUED', 'REJECTED',
];

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value || '—'}</p>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className = '' }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── "I Want To" action menu ──────────────────────────────────────────────────

function IWantToMenu({ app, user, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isAdmin = ADMIN_ROLES.includes(user?.role);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const actions = [];

  if (!app.isAccepted) {
    if (isAdmin) {
      actions.push({ id: 'accept', label: 'Accept Application', icon: CheckCircle2, variant: 'primary' });
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
      actions.push({ id: 'delete', label: 'Delete Application', icon: Trash2, variant: 'danger' });
    } else {
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
    }
  } else if (app.invoiceIssuedAt) {
    // Post-invoice: EMGS stage
    if (isAdmin) {
      actions.push({ id: 'update-emgs', label: 'Update EMGS Progress', icon: TrendingUp, variant: 'primary' });
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
      actions.push({ id: 'delete', label: 'Delete Application', icon: Trash2, variant: 'danger' });
    } else {
      if (app.offerLetterUrl) actions.push({ id: 'view-ol', label: 'View Offer Letter', icon: FileText });
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
    }
  } else if (app.paymentVerifiedAt && !app.invoiceIssuedAt) {
    if (isAdmin) {
      actions.push({ id: 'issue-invoice', label: 'Issue Invoice', icon: Receipt, variant: 'primary' });
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
    }
  } else if (app.paymentProofUrl && !app.paymentVerifiedAt) {
    if (isAdmin) {
      actions.push({ id: 'verify-payment', label: 'Verify Payment', icon: ShieldCheck, variant: 'primary' });
      actions.push({ id: 'update-status', label: 'Update Status', icon: CheckCircle2 });
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
    } else {
      actions.push({ id: 'view-proof', label: 'View Payment Proof', icon: Eye });
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
    }
  } else if (app.status === 'OFFER_LETTER_ISSUED') {
    if (isAdmin) {
      if (!app.offerLetterUrl) actions.push({ id: 'upload-ol', label: 'Upload Offer Letter', icon: Upload, variant: 'primary' });
      else {
        actions.push({ id: 'view-ol', label: 'View Offer Letter', icon: Eye });
        actions.push({ id: 'retry-ol-email', label: 'Retry Offer Letter Issued Email', icon: Mail });
      }
      actions.push({ id: 'update-status', label: 'Update Status', icon: CheckCircle2 });
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
      actions.push({ id: 'delete', label: 'Delete Application', icon: Trash2, variant: 'danger' });
    } else {
      if (app.offerLetterUrl) actions.push({ id: 'view-ol', label: 'View / Download Offer Letter', icon: Download });
      actions.push({ id: 'upload-proof', label: 'Upload Payment Proof', icon: Upload, variant: 'primary' });
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
    }
  } else {
    // Accepted, pre-offer letter
    if (isAdmin) {
      actions.push({ id: 'update-status', label: 'Update Status', icon: CheckCircle2, variant: 'primary' });
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
      actions.push({ id: 'delete', label: 'Delete Application', icon: Trash2, variant: 'danger' });
    } else {
      actions.push({ id: 'edit', label: 'Edit Application', icon: Edit });
    }
  }

  if (!actions.length) return null;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5"
      >
        I Want To
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1.5 z-50 min-w-[200px] rounded-xl border border-border bg-background shadow-xl"
          >
            <div className="p-1.5 space-y-0.5">
              {actions.map((action) => {
                const Icon = action.icon;
                const isRed = action.variant === 'danger';
                const isPrimary = action.variant === 'primary';
                return (
                  <button
                    key={action.id}
                    onClick={() => { setOpen(false); onAction(action.id); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left
                      ${isRed ? 'text-destructive hover:bg-destructive/10' : isPrimary ? 'text-primary hover:bg-primary/10' : 'hover:bg-muted'}`}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Pre-EMGS Workflow Timeline ───────────────────────────────────────────────

function WorkflowTimeline({ app }) {
  const currentIdx = WORKFLOW_STAGES.findIndex((s) => s.status === app.status);
  const isRejected = app.status === 'REJECTED';

  return (
    <div className="space-y-0">
      {WORKFLOW_STAGES.map((stage, idx) => {
        const isDone = !isRejected && currentIdx >= idx;
        const isCurrent = !isRejected && currentIdx === idx;
        const isLast = idx === WORKFLOW_STAGES.length - 1;

        return (
          <div key={stage.status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 flex-shrink-0 transition-colors
                ${isDone ? 'border-primary bg-primary' : isCurrent ? 'border-primary bg-primary/10' : 'border-muted bg-muted/30'}`}>
                {isDone
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  : <div className={`h-2 w-2 rounded-full ${isCurrent ? 'bg-primary' : 'bg-muted-foreground/30'}`} />}
              </div>
              {!isLast && <div className={`w-0.5 flex-1 my-1 ${isDone ? 'bg-primary/40' : 'bg-border'}`} style={{ minHeight: 16 }} />}
            </div>
            <div className="pb-4 pt-1 min-w-0">
              <p className={`text-sm font-medium leading-tight ${isDone ? 'text-primary' : 'text-muted-foreground'}`}>
                {stage.label}
              </p>
            </div>
          </div>
        );
      })}

      {/* Offer Letter / Payment / Invoice micro-steps */}
      {currentIdx >= 5 && (
        <div className="mt-2 space-y-2 pl-10">
          {[
            { done: !!app.offerLetterUrl, label: 'Offer Letter Uploaded' },
            { done: !!app.paymentProofUrl, label: 'Payment Proof Submitted' },
            { done: !!app.paymentVerifiedAt, label: 'Payment Verified' },
            { done: !!app.invoiceIssuedAt, label: 'Invoice Issued' },
          ].map(({ done, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`h-4 w-4 rounded-full flex items-center justify-center border ${done ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/30'}`}>
                {done && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
              </div>
              <span className={`text-xs ${done ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EMGS Progress ────────────────────────────────────────────────────────────

function EmgsProgress({ pct }) {
  const currentStage = EMGS_STAGES.findLast((s) => s.pct <= pct) || EMGS_STAGES[0];
  const nextStage = EMGS_STAGES.find((s) => s.pct > pct);

  // Circular ring geometry
  const value = Math.min(100, Math.max(0, pct));
  const size = 168;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  const isComplete = value >= 100;

  return (
    <div className="space-y-4">
      {/* Circular progress ring with percentage in the middle */}
      <div className="flex flex-col items-center pt-1">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            {/* Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              className="stroke-muted"
            />
            {/* Progress */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap={isComplete ? 'butt' : 'round'}
              stroke="#16a34a"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-foreground tabular-nums">{value}%</span>
          </div>
        </div>
        <p className="mt-3 text-sm font-medium text-foreground text-center">{currentStage.label}</p>
      </div>

      {/* Steps */}
      <div className="space-y-1.5 pt-1">
        {EMGS_STAGES.map((stage) => {
          const done = pct >= stage.pct;
          const current = stage.pct === currentStage.pct;
          return (
            <div key={stage.pct} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${current ? 'bg-primary/8' : ''}`}>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center border flex-shrink-0
                ${done ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                {done ? (
                  <CheckCircle2 className="h-3 w-3 text-white" />
                ) : (
                  <span className="text-[9px] font-bold text-muted-foreground/50">{stage.pct}</span>
                )}
              </div>
              <span className={`text-xs ${done ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                {stage.pct}% — {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {nextStage && (
        <p className="text-[11px] text-muted-foreground text-center pt-1">
          Next milestone: {nextStage.pct}% — {nextStage.label}
        </p>
      )}
    </div>
  );
}

// ─── File upload modal ────────────────────────────────────────────────────────

function FileUploadModal({ title, onClose, onUpload, uploading }) {
  const [file, setFile] = useState(null);

  const handleUpload = () => {
    if (!file) { toast.error('Please select a file'); return; }
    onUpload(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-background shadow-2xl border border-border">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <div className="p-5 space-y-4">
          <div
            className="rounded-lg border-2 border-dashed border-border p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById('file-upload-input').click()}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            {file
              ? <p className="text-sm font-medium text-primary">{file.name}</p>
              : <p className="text-sm text-muted-foreground">Click to select file (PDF, JPEG, PNG — max 15MB)</p>}
          </div>
          <input
            id="file-upload-input"
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button size="sm" onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── EMGS Update Modal ────────────────────────────────────────────────────────

function EmgsModal({ current, onClose, onUpdate, saving }) {
  const STEPS = EMGS_STAGES.map((s) => s.pct);
  const [pct, setPct] = useState(current || 0);
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-background shadow-2xl border border-border">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Update EMGS Progress</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium">Percentage *</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
            >
              {STEPS.map((s) => {
                const stage = EMGS_STAGES.find((x) => x.pct === s);
                return (
                  <option key={s} value={s}>
                    {s}% — {stage?.label}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium">Notes (optional)</label>
            <textarea
              className="h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any remarks about this stage..."
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={() => onUpdate(pct, notes)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Update Progress'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveUpdate, setLiveUpdate] = useState(false);

  // Action states
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [loe, setLoe] = useState(null);
  const [appDocuments, setAppDocuments] = useState([]);

  // Modals
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  const [showUploadOL, setShowUploadOL] = useState(false);
  const [showUploadProof, setShowUploadProof] = useState(false);
  const [showEmgsModal, setShowEmgsModal] = useState(false);
  const [editingPostEval, setEditingPostEval] = useState(false);
  const [previewFile, setPreviewFile] = useState(null); // { url, label }

  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const isEmgsStage = application?.invoiceIssuedAt;

  // Required docs (passport, photo, academic, etc.) are student-level (applicationId = null).
  // Show this application's own docs PLUS the student's global docs, but not other apps' docs.
  const fetchDocuments = useCallback(async (studentId) => {
    if (!studentId) return;
    try {
      const res = await documentAPI.list(studentId);
      const all = res.data.data || [];
      setAppDocuments(all.filter(d => !d.applicationId || d.applicationId === id));
    } catch {
      /* non-fatal */
    }
  }, [id]);

  const fetchApplication = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await applicationAPI.get(id);
      setApplication(res.data.data);
      loeAPI.get(id).then(res => setLoe(res.data.data?.loe || null)).catch(() => {});
      fetchDocuments(res.data.data?.student?.id);
    } catch {
      toast.error('Application not found');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [id, navigate, fetchDocuments]);

  useEffect(() => { fetchApplication(); }, [fetchApplication]);

  // Real-time updates
  useEffect(() => {
    const onStatusChange = (e) => {
      if (e.detail?.id === id) {
        setLiveUpdate(true);
        fetchApplication(true);
        setTimeout(() => setLiveUpdate(false), 2500);
      }
    };
    const onNoteAdded = (e) => { if (e.detail?.applicationId === id) fetchApplication(true); };
    window.addEventListener('mashroute:statusChanged', onStatusChange);
    window.addEventListener('mashroute:noteAdded', onNoteAdded);
    return () => {
      window.removeEventListener('mashroute:statusChanged', onStatusChange);
      window.removeEventListener('mashroute:noteAdded', onNoteAdded);
    };
  }, [id, fetchApplication]);

  // ─── Action handlers ───────────────────────────────────────────────────────

  const handleAction = (actionId) => {
    switch (actionId) {
      case 'accept': handleAccept(); break;
      case 'update-status': setShowStatusPanel(true); break;
      case 'upload-ol': setShowUploadOL(true); break;
      case 'view-ol':
        if (application.offerLetterUrl) setPreviewFile({ url: application.offerLetterUrl, label: 'Offer Letter' });
        break;
      case 'retry-ol-email': handleRetryOfferLetterEmail(); break;
      case 'upload-proof': setShowUploadProof(true); break;
      case 'view-proof':
        if (application.paymentProofUrl) setPreviewFile({ url: application.paymentProofUrl, label: 'Payment Proof' });
        break;
      case 'verify-payment': handleVerifyPayment(); break;
      case 'issue-invoice': handleIssueInvoice(); break;
      case 'update-emgs': setShowEmgsModal(true); break;
      case 'edit': navigate(`/applications/${id}/edit`); break;
      case 'delete': handleDelete(); break;
      default: break;
    }
  };

  const handleAccept = async () => {
    setProcessing(true);
    try {
      const res = await applicationAPI.accept(id);
      setApplication(res.data.data);
      toast.success('Application accepted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept application');
    } finally {
      setProcessing(false);
    }
  };

  // Build & open a pre-filled offer-letter request email to the university.
  const emailUniversityForOfferLetter = (appData) => {
    const uni = appData?.university || {};
    const st = appData?.student || {};
    if (!uni.email) {
      toast.error("This university has no contact email. Add it in Universities → Edit, then try again.");
      return;
    }
    const subject = `Offer Letter Request — ${st.fullName || 'Student'} (${appData.referenceNo})`;
    const body = [
      `Dear ${uni.name || 'Admissions Office'},`,
      '',
      'We would like to request an offer letter for the following student:',
      '',
      `Student Name : ${st.fullName || '-'}`,
      `Passport No  : ${st.passportNumber || '-'}`,
      `Nationality  : ${st.nationality || '-'}`,
      `Program      : ${appData.program || '-'}`,
      `Intake       : ${[appData.intake, appData.intakeYear].filter(Boolean).join(' ') || '-'}`,
      `Application  : ${appData.referenceNo}`,
      '',
      "Kindly issue the offer letter at your earliest convenience. The student's supporting documents are available on request.",
      '',
      'Thank you,',
    ].join('\n');
    window.location.href =
      `mailto:${encodeURIComponent(uni.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success(`Offer-letter request email opened for ${uni.name || 'the university'}`);
  };

  const handleStatusChange = async (newStatus) => {
    if (!newStatus || newStatus === application?.status) return;
    setUpdatingStatus(true);
    try {
      const res = await applicationAPI.updateStatus(id, newStatus, null);
      setApplication(res.data.data);
      setShowStatusPanel(false);
      toast.success(`Status updated to ${formatStatusLabel(newStatus)}`);
      // Sending to the university auto-generates an offer-letter request email.
      if (newStatus === 'SENT_TO_UNIVERSITY') {
        emailUniversityForOfferLetter(res.data.data || application);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUploadOfferLetter = async (file) => {
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await applicationAPI.uploadOfferLetter(id, fd);
      setApplication(res.data.data);
      setShowUploadOL(false);
      toast.success('Offer Letter uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryOfferLetterEmail = async () => {
    setProcessing(true);
    try {
      const res = await applicationAPI.retryOfferLetterIssuedEmail(id);
      const sent = (res.data.data?.results || []).filter((result) => result.status === 'SENT').length;
      toast.success(sent ? `Offer Letter Issued email sent to ${sent} recipient${sent === 1 ? '' : 's'}` : 'Offer Letter Issued email was already sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Offer Letter Issued email retry failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadPaymentProof = async (file) => {
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await applicationAPI.uploadPaymentProof(id, fd);
      setApplication(res.data.data);
      setShowUploadProof(false);
      toast.success('Payment proof uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!window.confirm('Mark payment as verified?')) return;
    setProcessing(true);
    try {
      const res = await applicationAPI.verifyPayment(id);
      setApplication(res.data.data);
      toast.success('Payment verified');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to verify payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleIssueInvoice = async () => {
    if (!window.confirm('Issue invoice and start EMGS workflow?')) return;
    setProcessing(true);
    try {
      const res = await applicationAPI.issueInvoice(id);
      setApplication(res.data.data);
      toast.success('Invoice issued — EMGS workflow started');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to issue invoice');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateEmgs = async (percentage, notes) => {
    setProcessing(true);
    try {
      const res = await applicationAPI.updateEmgs(id, percentage, notes);
      setApplication(res.data.data);
      setShowEmgsModal(false);
      toast.success(`EMGS progress updated to ${percentage}%`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update EMGS progress');
    } finally {
      setProcessing(false);
    }
  };

  const handleVerifyTuition = async () => {
    if (!window.confirm('Mark tuition payment as verified and generate invoice?')) return;
    setProcessing(true);
    try {
      const res = await applicationAPI.verifyTuition(id, { action: 'verify' });
      setApplication(res.data.data);
      await fetchApplication(true);
      toast.success('Tuition payment verified');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to verify tuition payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectTuition = async () => {
    const remarks = window.prompt('Reason for rejection / correction required:');
    if (remarks === null) return; // cancelled
    setProcessing(true);
    try {
      const res = await applicationAPI.verifyTuition(id, { action: 'reject', remarks: remarks.trim() });
      setApplication(res.data.data);
      await fetchApplication(true);
      toast.success('Tuition payment rejected — correction requested');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject tuition payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleCommissionStatus = async (status) => {
    const verb = status === 'PAID' ? 'paid' : 'eligible';
    if (!window.confirm(`Mark commission as ${verb}? This notifies the agent/staff via WhatsApp (if enabled).`)) return;
    setProcessing(true);
    try {
      const res = await applicationAPI.setCommissionStatus(id, status);
      setApplication(res.data.data);
      await fetchApplication(true);
      toast.success(`Commission marked ${verb}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update commission status');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdatePostEval = async (status) => {
    setProcessing(true);
    try {
      const res = await applicationAPI.updatePostEval(id, status);
      setApplication(res.data.data);
      await fetchApplication(true);
      const label = POST_EVAL_STAGES.find((s) => s.value === status)?.label || status;
      toast.success(`Moved to: ${label}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update post-eVAL status');
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadEvisa = async (file) => {
    if (!file) { toast.error('Please select a file'); return; }
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await applicationAPI.uploadEvisa(id, fd);
      setApplication(res.data.data);
      await fetchApplication(true);
      toast.success('eVisa uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadApproval = async (kind, file) => {
    if (!file) { toast.error('Please select a file'); return; }
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = kind === 'emgs'
        ? await applicationAPI.uploadEmgsApproval(id, fd)
        : await applicationAPI.uploadEvalApproval(id, fd);
      setApplication(res.data.data);
      await fetchApplication(true);
      toast.success(kind === 'emgs' ? 'EMGS approval uploaded' : 'eVAL approval uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadTuitionProof = async (file) => {
    if (!file) { toast.error('Please select a file'); return; }
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await applicationAPI.uploadTuitionProof(id, fd);
      setApplication(res.data.data);
      await fetchApplication(true);
      toast.success('Tuition payment proof uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleUploadFlightTicket = async (file) => {
    if (!file) { toast.error('Please select a file'); return; }
    setProcessing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await applicationAPI.updateArrival(id, fd);
      setApplication(res.data.data);
      await fetchApplication(true);
      toast.success('Flight ticket uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await applicationAPI.addNote(id, newNote, false);
      setNewNote('');
      await fetchApplication(true);
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete this application?')) return;
    setProcessing(true);
    try {
      await applicationAPI.delete(id);
      toast.success('Application deleted');
      navigate('/applications');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setProcessing(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!application) return null;

  const app = application;
  const isOfferLetterStage = ['OFFER_LETTER_ISSUED', 'EMGS_PROCESSING', 'COMPLETED'].includes(app.status);
  const canUploadProof = isOfferLetterStage && app.offerLetterUrl;

  // ── Post-eVAL workflow gating (separate from EMGS %) ──
  // The whole section unlocks once 70% eVAL Approved is reached. Within it,
  // visibility is driven by `postEvalStatus`, NOT by the percentage number.
  const emgsPct = app.emgsPercentage || 0;
  const isCompleted = app.status === 'COMPLETED';
  const canUpload = isAdmin || user?.role === 'STAFF';   // Staff/Agent + Admin can upload
  const postEvalStatus = app.postEvalStatus || null;
  const postIdx = postEvalIndex(postEvalStatus);          // -1 when not started
  // The post-eVAL workflow is the "active" focus between 70% and 80%, until
  // arrival is completed. While active the EMGS % progress card is hidden and
  // the post-eVAL section takes over; once Arrival Completed it flips back so
  // the admin continues the EMGS status (80 → 100).
  const postEvalActive =
    emgsPct >= POST_EVAL_UNLOCK_PCT && emgsPct < 80 && postEvalStatus && postEvalStatus !== 'ARRIVAL_COMPLETED';
  const inAwaitingEvisa = postEvalStatus === 'AWAITING_EVISA';
  // eVisa upload only becomes available once the stage is "eVisa Approved".
  // (In "Awaiting for eVisa" only the EMGS + eVAL approval letters are uploaded.)
  const showEvisa = postIdx >= postEvalIndex('EVISA_APPROVED') || !!app.evisaUrl;
  // Show arrival/tuition from "Under Arrival" onward (or data already exists).
  const showArrival =
    postIdx >= postEvalIndex('UNDER_ARRIVAL') || !!app.flightTicketUrl || !!app.tuitionProofUrl || !!app.arrivalDate;
  // Derived tuition verification state (falls back for pre-existing rows)
  const tuitionStatus =
    app.tuitionVerificationStatus && app.tuitionVerificationStatus !== 'NONE'
      ? app.tuitionVerificationStatus
      : app.tuitionVerifiedAt ? 'VERIFIED' : app.tuitionProofUrl ? 'PENDING' : 'NONE';

  // Logical gating: which stage can be reached next, and what (if anything) blocks it.
  const nextPostEvalStage = POST_EVAL_STAGES[postIdx + 1] || null;
  const postEvalBlockReason = (target) => {
    if (!target) return null;
    // To mark "eVisa Approved", both approval letters must be uploaded first.
    if (target === 'EVISA_APPROVED' && (!app.emgsApprovalUrl || !app.evalApprovalUrl)) {
      return 'Upload the EMGS & eVAL approval letters first.';
    }
    // To move to "Under Arrival" (or complete), the eVisa must be uploaded.
    if (['UNDER_ARRIVAL', 'ARRIVAL_COMPLETED'].includes(target) && !app.evisaUrl) {
      return 'Upload the eVisa document first.';
    }
    if (target === 'ARRIVAL_COMPLETED') {
      if (!app.flightTicketUrl) return 'Upload the flight ticket first.';
      if (tuitionStatus !== 'VERIFIED') return 'Verify the tuition payment first.';
    }
    return null;
  };
  const nextStageBlock = postEvalBlockReason(nextPostEvalStage?.value);

  // All workflow documents that have been uploaded — for the Documents section
  // (view / download / replace). Only rows with a file are shown.
  const workflowDocs = [
    { key: 'offer', label: 'Offer Letter', url: app.offerLetterUrl, at: app.offerLetterUploadedAt, by: app.offerLetterUploadedBy, replace: handleUploadOfferLetter, adminOnly: true },
    { key: 'payment', label: 'EMGS Payment Proof', url: app.paymentProofUrl, at: app.paymentProofUploadedAt, by: app.paymentProofUploadedBy, replace: handleUploadPaymentProof },
    { key: 'emgs', label: 'EMGS Approval Letter', url: app.emgsApprovalUrl, at: app.emgsApprovalUploadedAt, replace: (f) => handleUploadApproval('emgs', f) },
    { key: 'eval', label: 'eVAL Approval Letter', url: app.evalApprovalUrl, at: app.evalApprovalUploadedAt, replace: (f) => handleUploadApproval('eval', f) },
    { key: 'evisa', label: 'eVisa', url: app.evisaUrl, at: app.evisaUploadedAt, by: app.evisaUploadedBy, replace: handleUploadEvisa },
    { key: 'flight', label: 'Flight Ticket', url: app.flightTicketUrl, replace: handleUploadFlightTicket },
    { key: 'tuition', label: 'Tuition Payment Proof', url: app.tuitionProofUrl, at: app.tuitionProofUploadedAt, by: app.tuitionProofUploadedBy, replace: handleUploadTuitionProof },
  ].filter((d) => d.url);

  return (
    <div className="space-y-6">
      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="flex w-full max-w-4xl flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold text-sm">{previewFile.label}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewFile.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-muted/30 overflow-hidden">
              <iframe
                src={(() => {
                  const m = previewFile.url.match(/[?&]id=([\w-]+)/);
                  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : previewFile.url;
                })()}
                title={previewFile.label}
                className="h-full w-full border-0"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 flex-shrink-0 mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <StudentAvatar student={app.student} documents={appDocuments} size="lg" className="mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold truncate">{app.student?.fullName}</h1>
            <StatusBadge status={app.status} />
            {!app.isAccepted && app.status === 'SUBMITTED' && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Pending Acceptance
              </span>
            )}
            {liveUpdate && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
              >
                <Wifi className="h-3 w-3" /> Live
              </motion.span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {app.referenceNo} · {app.university?.name || 'No university'} · {app.program || 'No program'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <IWantToMenu app={app} user={user} onAction={handleAction} />
          <Button variant="outline" size="sm" onClick={() => navigate(`/applications/${id}/edit`)}>
            <Edit className="h-4 w-4" /> Edit
          </Button>
        </div>
      </div>

      {/* ── Status Update Panel (inline, for status dropdown) ── */}
      <AnimatePresence>
        {showStatusPanel && isAdmin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-medium flex-shrink-0">Update Status:</p>
                  <Select value={app.status} onValueChange={handleStatusChange} disabled={updatingStatus}>
                    <SelectTrigger className="w-56 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_DROPDOWN_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{formatStatusLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {updatingStatus && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  <Button variant="ghost" size="sm" onClick={() => setShowStatusPanel(false)} className="ml-auto">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Student info */}
          <SectionCard title="Student Information">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div className="col-span-2">
                <InfoRow label="Portal ID (Drive folder)" value={studentUniqueId(app.student)} />
              </div>
              <InfoRow label="Full Name" value={app.student?.fullName} />
              <InfoRow label="Passport No." value={app.student?.passportNumber} />
              <InfoRow label="Nationality" value={app.student?.nationality} />
              <InfoRow label="Email" value={app.student?.email} />
              <InfoRow label="Phone" value={app.student?.phone} />
              <InfoRow label="Date of Birth" value={formatDate(app.student?.dateOfBirth)} />
            </div>
          </SectionCard>

          {/* Application details */}
          <SectionCard title="Application Details">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label="University" value={app.university?.name} />
              <InfoRow label="Country" value={app.country} />
              <InfoRow label="Program" value={app.program} />
              <InfoRow label="Intake" value={`${app.intake || ''} ${app.intakeYear || ''}`.trim() || undefined} />
              <InfoRow label="Priority" value={app.priority} />
              <InfoRow label="Agent" value={app.agent ? `${app.agent.firstName} ${app.agent.lastName}` : undefined} />
              <InfoRow label="Submitted" value={formatDate(app.submittedAt)} />
              <InfoRow label="Created" value={formatDate(app.createdAt)} />
            </div>
            {app.isAccepted && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow
                  label="Accepted By"
                  value={app.acceptedBy ? `${app.acceptedBy.firstName} ${app.acceptedBy.lastName}` : undefined}
                />
                <InfoRow label="Accepted At" value={formatDate(app.acceptedAt)} />
              </div>
            )}
          </SectionCard>

          {/* Documents — all uploaded workflow files: view / download / replace */}
          {workflowDocs.length > 0 && (
            <SectionCard title="Documents" icon={FileText}>
              <div className="space-y-2.5">
                {workflowDocs.map((d) => {
                  const canReplace = d.adminOnly ? isAdmin : canUpload;
                  return (
                    <div key={d.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                          <FileText className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{d.label}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {d.at ? `Uploaded ${formatDate(d.at)}` : 'Uploaded'}
                            {d.by ? ` · ${d.by.firstName} ${d.by.lastName}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setPreviewFile({ url: d.url, label: d.label })}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <a href={d.url} download target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                            <Download className="h-3.5 w-3.5" /> Download
                          </Button>
                        </a>
                        {canReplace && (
                          <>
                            <input id={`replace-${d.key}`} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) d.replace(f); }} />
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => document.getElementById(`replace-${d.key}`).click()} disabled={processing}>
                              <Upload className="h-3.5 w-3.5" /> Replace
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Notes */}
          <SectionCard title="Notes">
            <div className="space-y-4">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                  size="icon"
                  className="self-end h-9 w-9 flex-shrink-0"
                >
                  {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <div className="space-y-3">
                {(app.notes || []).length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No notes yet</p>
                ) : (
                  (app.notes || []).map((note) => (
                    <div key={note.id} className="flex gap-3">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {getInitials(`${note.author?.firstName} ${note.author?.lastName}`)}
                      </div>
                      <div className="flex-1 rounded-lg bg-muted/40 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold">{note.author?.firstName} {note.author?.lastName}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDate(note.createdAt, 'MMM d, h:mm a')}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{note.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">
          {/* ── Progress Card — hidden while the post-eVAL workflow is active ── */}
          {!postEvalActive && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  {isEmgsStage ? (
                    <><TrendingUp className="h-4 w-4 text-primary" /> EMGS Progress</>
                  ) : (
                    <><Clock className="h-4 w-4 text-primary" /> Application Workflow</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEmgsStage ? (
                  <EmgsProgress pct={app.emgsPercentage || 0} />
                ) : (
                  <WorkflowTimeline app={app} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick action for admin: Accept (if pending) */}
          {isAdmin && !app.isAccepted && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">Awaiting Acceptance</p>
                    <p className="text-xs text-amber-700 mt-0.5 mb-3">Review and accept this application to begin the workflow.</p>
                    <Button size="sm" onClick={handleAccept} disabled={processing} className="w-full">
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Accept Application
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin: Issue Invoice quick card */}
          {isAdmin && app.paymentVerifiedAt && !app.invoiceIssuedAt && (
            <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <Receipt className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-800">Ready for Invoice</p>
                    <p className="text-xs text-emerald-700 mt-0.5 mb-3">Payment verified. Issue invoice to start EMGS processing.</p>
                    <Button size="sm" onClick={handleIssueInvoice} disabled={processing} className="w-full bg-emerald-600 hover:bg-emerald-700">
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                      Issue Invoice
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin: EMGS update quick button — hidden during the post-eVAL workflow */}
          {isAdmin && isEmgsStage && app.status !== 'COMPLETED' && !postEvalActive && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <Button size="sm" onClick={() => setShowEmgsModal(true)} className="w-full" variant="outline">
                  <TrendingUp className="h-4 w-4" /> Update EMGS Progress
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Admin: Commission payout status (drives WhatsApp commission notifications) */}
          {isAdmin && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Commission Payout</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    app.commissionStatus === 'PAID' ? 'bg-emerald-500/15 text-emerald-600'
                      : app.commissionStatus === 'ELIGIBLE' ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {app.commissionStatus || 'PENDING'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Marking the commission notifies the assigned agent/staff via WhatsApp (if enabled).
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm" variant="outline" className="flex-1"
                    onClick={() => handleCommissionStatus('ELIGIBLE')}
                    disabled={processing || app.commissionStatus === 'ELIGIBLE' || app.commissionStatus === 'PAID'}
                  >
                    Mark Eligible
                  </Button>
                  <Button
                    size="sm" className="flex-1"
                    onClick={() => handleCommissionStatus('PAID')}
                    disabled={processing || app.commissionStatus === 'PAID'}
                  >
                    Mark Paid
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Post-eVAL / eVisa & Arrival Process (active between 70% and arrival completion) ── */}
          {postEvalActive && (
            <SectionCard title="Post-eVAL / eVisa & Arrival Process" icon={PlaneLanding}>
              <div className="space-y-2.5">
                {POST_EVAL_STAGES.map((stage, i) => {
                  const reached = postIdx >= i;
                  const isCurrent = postIdx === i;
                  return (
                    <div
                      key={stage.value}
                      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                        isCurrent
                          ? 'border-primary/40 bg-primary/5'
                          : reached
                            ? 'border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20'
                            : 'border-border bg-muted/20'
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          reached
                            ? 'bg-emerald-500 text-white'
                            : isCurrent
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {reached && !isCurrent ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${reached || isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {stage.label}
                        </p>
                        {isCurrent && <p className="text-[11px] text-primary">Current stage</p>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Admin: advance OR edit the workflow. Staff/Agent see status only. */}
              {isAdmin ? (
                editingPostEval ? (
                  <div className="mt-4 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                    <label className="block text-xs font-semibold text-foreground">Set stage</label>
                    <p className="text-[11px] text-muted-foreground">
                      Jump to any stage or step back to correct a mistake. Stages needing an upload first are disabled.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {POST_EVAL_STAGES.map((stage, i) => {
                        const block = postEvalBlockReason(stage.value);
                        const isCurrent = postIdx === i;
                        return (
                          <button
                            key={stage.value}
                            type="button"
                            disabled={processing || isCurrent || !!block}
                            title={block || ''}
                            onClick={() => handleUpdatePostEval(stage.value).then(() => setEditingPostEval(false))}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                              isCurrent
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5'
                            }`}
                          >
                            {stage.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingPostEval(false)} disabled={processing}>
                        Done
                      </Button>
                    </div>
                  </div>
                ) : nextPostEvalStage ? (
                  <div className="mt-4 space-y-2">
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={processing || !!nextStageBlock}
                      onClick={() => handleUpdatePostEval(nextPostEvalStage.value)}
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                      Move to: {nextPostEvalStage.label}
                    </Button>
                    {nextStageBlock && (
                      <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {nextStageBlock}
                      </p>
                    )}
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditingPostEval(true)} disabled={processing}>
                      <Edit className="h-3.5 w-3.5" /> Edit stage
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> Post-eVAL process completed — you can continue the EMGS status (80% → 100%).
                    </div>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setEditingPostEval(true)} disabled={processing}>
                      <Edit className="h-3.5 w-3.5" /> Edit stage
                    </Button>
                  </div>
                )
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  Your tenant admin manages these stages. You can upload documents and select dates below.
                </p>
              )}
            </SectionCard>
          )}

          {/* ── Post-eVAL documents: each upload animates away once done, revealing the next ── */}
          <AnimatePresence mode="popLayout" initial={false}>
            {/* Approval Letters — visible until BOTH letters are uploaded, then animates out */}
            {postEvalActive && (!app.emgsApprovalUrl || !app.evalApprovalUrl) && (
              <motion.div
                key="approvals"
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <SectionCard title="Approval Letters" icon={FileText}>
                  <p className="mb-3 text-xs text-muted-foreground">Upload both letters to unlock the eVisa step.</p>
                  <AnimatePresence mode="popLayout" initial={false}>
                    {[
                      { key: 'emgs', label: 'EMGS Approval Letter', url: app.emgsApprovalUrl },
                      { key: 'eval', label: 'eVAL Approval Letter', url: app.evalApprovalUrl },
                    ].filter((item) => !item.url).map((item) => (
                      <motion.div
                        key={item.key}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="mb-3 rounded-lg border border-border bg-muted/20 p-3 last:mb-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{item.label}</p>
                              <p className="text-[11px] text-muted-foreground">Not uploaded yet</p>
                            </div>
                          </div>
                          {canUpload && (
                            <>
                              <input id={`approval-${item.key}`} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleUploadApproval(item.key, f); }} />
                              <Button variant="ghost" size="sm" className="flex-shrink-0" onClick={() => document.getElementById(`approval-${item.key}`).click()} disabled={processing}>
                                <Upload className="h-3.5 w-3.5" /> Upload
                              </Button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </SectionCard>
              </motion.div>
            )}

            {/* eVisa — visible at "eVisa Approved" until uploaded, then animates out */}
            {postEvalActive && showEvisa && !app.evisaUrl && (
              <motion.div
                key="evisa"
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <SectionCard title="eVisa" icon={FileText}>
                  {canUpload ? (
                    <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                      <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-3">Upload the approved eVisa document</p>
                      <input id="evisa-input" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleUploadEvisa(f); }} />
                      <Button size="sm" onClick={() => document.getElementById('evisa-input').click()} disabled={processing}>
                        {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Upload eVisa
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" /> eVisa not yet uploaded
                    </div>
                  )}
                </SectionCard>
              </motion.div>
            )}

            {/* Arrival — Under Arrival: flight/arrival date + flight ticket (animates in) */}
            {postEvalActive && showArrival && (
              <motion.div
                key="arrival"
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <SectionCard title="Arrival" icon={PlaneLanding}>
                  <ArrivalCard application={app} canEdit={canUpload} userRole={user?.role} onRefresh={fetchApplication} />
                </SectionCard>
              </motion.div>
            )}

          {/* Tuition Payment (Under Arrival) */}
          {postEvalActive && showArrival && (
            <motion.div
              key="tuition"
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
            <SectionCard title="Tuition Payment" icon={Receipt}>
              {app.tuitionProofUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                        <Receipt className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Tuition Payment Proof</p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {app.tuitionProofUploadedAt ? formatDate(app.tuitionProofUploadedAt) : ''}
                          {app.tuitionProofUploadedBy ? ` · ${app.tuitionProofUploadedBy.firstName} ${app.tuitionProofUploadedBy.lastName}` : ''}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setPreviewFile({ url: app.tuitionProofUrl, label: 'Tuition Payment Proof' })}>
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  </div>

                  {/* Verification status */}
                  {tuitionStatus === 'VERIFIED' && (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          <Receipt className="h-3.5 w-3.5" /> Invoice Generated
                        </span>
                      </div>
                      {app.tuitionVerifiedBy && (
                        <p className="text-[11px] text-muted-foreground">
                          Verified by {app.tuitionVerifiedBy.firstName} {app.tuitionVerifiedBy.lastName}
                          {app.tuitionVerifiedAt ? ` · ${formatDate(app.tuitionVerifiedAt)}` : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {tuitionStatus === 'REJECTED' && (
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        <XCircle className="h-3.5 w-3.5" /> Rejected — Correction Required
                      </span>
                      {app.tuitionVerificationRemarks && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                          <span className="font-semibold">Admin remarks:</span> {app.tuitionVerificationRemarks}
                        </div>
                      )}
                      {canUpload && (
                        <>
                          <input id="tuition-reupload-input" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleUploadTuitionProof(f); }} />
                          <Button size="sm" onClick={() => document.getElementById('tuition-reupload-input').click()} disabled={processing}>
                            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            Upload Corrected Proof
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {tuitionStatus === 'PENDING' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        <Clock className="h-3.5 w-3.5" /> Pending Admin Verification
                      </span>
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="outline" onClick={handleVerifyTuition} disabled={processing}
                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                            Verify
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleRejectTuition} disabled={processing}
                            className="border-red-200 text-red-600 hover:bg-red-50">
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : canUpload ? (
                <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                  <Receipt className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No tuition payment proof uploaded yet</p>
                  <input id="tuition-proof-input" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleUploadTuitionProof(f); }} />
                  <Button size="sm" onClick={() => document.getElementById('tuition-proof-input').click()} disabled={processing}>
                    {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload Tuition Payment Proof
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  Tuition payment proof not yet uploaded
                </div>
              )}
            </SectionCard>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Status Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Status History</CardTitle>
            </CardHeader>
            <CardContent>
              {(app.statusHistory || []).length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No history yet</p>
              ) : (
                <div className="space-y-1">
                  {(app.statusHistory || []).map((h, i) => (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                        {i < (app.statusHistory || []).length - 1 && (
                          <div className="w-px flex-1 bg-border my-1" style={{ minHeight: 12 }} />
                        )}
                      </div>
                      <div className="pb-3 min-w-0">
                        <p className="text-xs font-semibold">
                          {formatStatusLabel(h.toStatus)}
                          {h.emgsPercentage !== null && h.emgsPercentage !== undefined && (
                            <span className="ml-1 text-primary">({h.emgsPercentage}%)</span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {h.changedBy ? `${h.changedBy.firstName} ${h.changedBy.lastName}` : 'System'} · {formatDate(h.createdAt, 'MMM d, h:mm a')}
                        </p>
                        {h.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">"{h.notes}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Letter of Eligibility */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                Letter of Eligibility
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LOEActions
                application={application}
                loe={loe}
                userRole={user?.role}
                onRefresh={() => loeAPI.get(id).then(res => setLoe(res.data.data?.loe || null)).catch(() => {})}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Modals ── */}
      {showUploadOL && (
        <FileUploadModal
          title="Upload Offer Letter"
          onClose={() => setShowUploadOL(false)}
          onUpload={handleUploadOfferLetter}
          uploading={processing}
        />
      )}
      {showUploadProof && (
        <FileUploadModal
          title="Upload Payment Proof"
          onClose={() => setShowUploadProof(false)}
          onUpload={handleUploadPaymentProof}
          uploading={processing}
        />
      )}
      {showEmgsModal && (
        <EmgsModal
          current={app.emgsPercentage || 0}
          onClose={() => setShowEmgsModal(false)}
          onUpdate={handleUpdateEmgs}
          saving={processing}
        />
      )}
    </div>
  );
}
