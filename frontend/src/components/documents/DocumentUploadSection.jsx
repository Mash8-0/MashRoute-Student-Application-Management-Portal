import { useState, useRef } from 'react';
import { Upload, CheckCircle2, FileText, Eye, Download, Trash2, Loader2, AlertCircle, X } from 'lucide-react';
import { applicationAPI, documentAPI } from '../../api/endpoints';
import { toast } from '../ui/toast';
import { Button } from '../ui/button';
import { formatDate } from '../../lib/utils';

// ─── Document definitions ─────────────────────────────────────────────────────

const REQUIRED_DOCS = [
  {
    type: 'PASSPORT',
    title: 'Passport Information Page',
    description: 'The page containing your photo and personal details',
    accept: '.pdf,.jpg,.jpeg,.png',
    acceptLabel: 'PDF, JPG, PNG',
    required: true,
  },
  {
    type: 'PASSPORT_FULL_SCAN',
    title: 'Full Scanned Copy of Passport',
    description: 'Complete scan of all passport pages',
    accept: '.pdf',
    acceptLabel: 'PDF',
    required: true,
  },
  {
    type: 'PHOTO',
    title: 'Student Photo',
    description: 'Recent passport-style photo',
    accept: '.jpg,.jpeg,.png',
    acceptLabel: 'JPG, PNG',
    required: true,
  },
  {
    type: 'ACADEMIC_DOCUMENTS',
    title: 'Academic Documents',
    description: 'Transcripts, certificates, diplomas',
    accept: '.pdf,.jpg,.jpeg,.png',
    acceptLabel: 'PDF, JPG, PNG',
    required: true,
  },
  {
    type: 'ENGLISH_PROFICIENCY',
    title: 'English Proficiency Certificate',
    description: 'IELTS, TOEFL, PTE, MOI, or equivalent English test result',
    accept: '.pdf,.jpg,.jpeg,.png',
    acceptLabel: 'PDF, JPG, PNG',
    required: false,
    legacy: true,
  },
];

const BASE_DOCS = REQUIRED_DOCS.filter(d => !d.legacy);
const REQUIRED_TYPES = BASE_DOCS.filter(d => d.required).map(d => d.type);

const ENGLISH_CERT_DOCS = {
  IELTS: {
    type: 'IELTS_CERTIFICATE',
    title: 'IELTS Certificate',
    description: 'Upload IELTS Certificate',
    accept: '.pdf,.jpg,.jpeg,.png',
    acceptLabel: 'PDF, JPG, PNG',
    required: false,
  },
  PTE: {
    type: 'PTE_CERTIFICATE',
    title: 'PTE Certificate',
    description: 'Upload PTE Certificate',
    accept: '.pdf,.jpg,.jpeg,.png',
    acceptLabel: 'PDF, JPG, PNG',
    required: false,
  },
  MOI: {
    type: 'MOI_CERTIFICATE',
    title: 'MOI Certificate',
    description: 'Upload MOI Certificate',
    accept: '.pdf,.jpg,.jpeg,.png',
    acceptLabel: 'PDF, JPG, PNG',
    required: false,
  },
};

function getDocumentDefinitions(englishProficiency) {
  const normalized = String(englishProficiency || 'NONE').toUpperCase();
  const englishDoc = ENGLISH_CERT_DOCS[normalized];
  return englishDoc ? [...BASE_DOCS, englishDoc] : BASE_DOCS;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPreviewUrl(fileUrl) {
  if (!fileUrl) return null;
  const m = fileUrl.match(/[?&]id=([\w-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return fileUrl;
}

// ─── File Preview Modal ───────────────────────────────────────────────────────

function PreviewModal({ file, onClose }) {
  if (!file) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-4xl flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden" style={{ height: '90vh' }}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <p className="font-semibold text-sm">{file.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={file.fileUrl} download target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              <Download className="h-3.5 w-3.5" /> Download
            </a>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-muted/30 overflow-hidden">
          <iframe src={getPreviewUrl(file.fileUrl)} title={file.title} className="h-full w-full border-0" allow="autoplay" />
        </div>
      </div>
    </div>
  );
}

// ─── Single upload card ───────────────────────────────────────────────────────

function UploadCard({ docDef, studentId, applicationId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('studentId', studentId);
      form.append('type', docDef.type);
      // These required docs (passport, photo, academic, etc.) are student-level —
      // intentionally NOT bound to a single application so they show on every
      // application for this student and on the student profile.
      await documentAPI.upload(form);
      toast.success(`${docDef.title} uploaded successfully`);
      onUploaded();
    } catch (err) {
      const msg = err.response?.data?.message || 'Upload failed. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e) => handleFile(e.target.files?.[0]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      className={`relative rounded-2xl border-2 transition-colors p-5
        ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {docDef.required && (
        <span className="absolute right-4 top-4 rounded-full bg-red-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Required
        </span>
      )}

      <div className="flex items-start gap-4 pr-16">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">{docDef.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{docDef.description}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Accepted formats: {docDef.acceptLabel}
          </p>
          <p className="mt-1 text-xs font-semibold text-red-500">
            Maximum file size: 15 MB
          </p>
          <p className="mt-1 text-xs text-muted-foreground/50">
            Click to browse or drag and drop file here
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-2.5">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <input
          ref={inputRef}
          type="file"
          accept={docDef.accept}
          className="hidden"
          onChange={onInputChange}
          disabled={uploading}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Uploading...' : 'Choose File'}
        </button>
      </div>
    </div>
  );
}

// ─── Uploaded document row ────────────────────────────────────────────────────

function UploadedDocRow({ doc, docDef, canDelete, onDeleted, onPreview }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete "${docDef?.title || doc.type}"?`)) return;
    setDeleting(true);
    try {
      await documentAPI.delete(doc.id);
      toast.success('Document deleted');
      onDeleted();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{docDef?.title || doc.type}</p>
          <p className="text-xs text-muted-foreground truncate">{doc.originalName}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            Uploaded {formatDate(doc.createdAt)}
            {doc.uploadedBy ? ` · ${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}` : ''}
            {doc.fileSource === 'google_drive' && <span className="ml-1 text-primary">· Drive</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onPreview(doc, docDef?.title || doc.type)}>
          <Eye className="h-3.5 w-3.5" /> View
        </Button>
        <a href={doc.fileUrl} download target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
        </a>
        {canDelete && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DocumentUploadSection({
  student,
  documents,
  canUpload,
  canDelete,
  onRefresh,
  applicationId,
  extraDocs = [],
  englishProficiency = 'NONE',
}) {
  const [previewFile, setPreviewFile] = useState(null);
  const [deletingWorkflowDoc, setDeletingWorkflowDoc] = useState(null);

  const handleDeleteWorkflowDoc = async (doc) => {
    if (!doc.deleteKind || !confirm(`Delete "${doc.label}"?`)) return;
    setDeletingWorkflowDoc(doc.key);
    try {
      await applicationAPI.deleteWorkflowDocument(doc.appId, doc.deleteKind);
      toast.success('Document deleted');
      await onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingWorkflowDoc(null);
    }
  };

  const documentDefinitions = getDocumentDefinitions(englishProficiency);
  const definitionTypes = new Set(documentDefinitions.map(d => d.type));
  const uploadedTypes = new Set(documents.map(d => d.type));
  const missingDocs   = documentDefinitions.filter(d => !uploadedTypes.has(d.type));
  const uploadedDocs  = documentDefinitions.filter(d => uploadedTypes.has(d.type));
  const otherDocs     = documents.filter(d => !definitionTypes.has(d.type));

  const uploadedRequired  = REQUIRED_TYPES.filter(t => uploadedTypes.has(t)).length;
  const totalRequired     = REQUIRED_TYPES.length;
  const allRequiredDone   = uploadedRequired === totalRequired;
  const completionPct     = Math.round((uploadedRequired / totalRequired) * 100);

  return (
    <>
      <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      <div className="space-y-6">
        {/* ── Completion banner ── */}
        <div className={`flex items-center justify-between rounded-xl border p-4
          ${allRequiredDone ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-card'}`}>
          <div className="flex items-center gap-3">
            {allRequiredDone
              ? <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              : <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />}
            <div>
              <p className={`text-sm font-semibold ${allRequiredDone ? 'text-emerald-700' : 'text-foreground'}`}>
                {allRequiredDone
                  ? '✅ All required documents have been uploaded successfully.'
                  : `Documents Completed: ${uploadedRequired}/${totalRequired}`}
              </p>
              {!allRequiredDone && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Missing: {totalRequired - uploadedRequired} required document{totalRequired - uploadedRequired !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold ${allRequiredDone ? 'text-emerald-600' : 'text-primary'}`}>{completionPct}%</span>
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${allRequiredDone ? 'bg-emerald-500' : 'bg-primary'}`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Upload section (missing docs only) ── */}
        {canUpload && missingDocs.length > 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold">Upload Documents</h3>
              <p className="text-sm text-muted-foreground">Upload all required documents by clicking or dragging files.</p>
            </div>
            <div className="space-y-3">
              {missingDocs.map(docDef => (
                <UploadCard
                  key={docDef.type}
                  docDef={docDef}
                  studentId={student.id}
                  applicationId={applicationId}
                  onUploaded={onRefresh}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Uploaded documents ── */}
        {(uploadedDocs.length > 0 || otherDocs.length > 0 || extraDocs.length > 0) && (
          <div className="space-y-3">
            <h3 className="text-base font-bold">Uploaded Documents</h3>
            {uploadedDocs.map(docDef => {
              const doc = documents.find(d => d.type === docDef.type);
              return (
                <UploadedDocRow
                  key={docDef.type}
                  doc={doc}
                  docDef={docDef}
                  canDelete={canDelete}
                  onDeleted={onRefresh}
                  onPreview={(d, title) => setPreviewFile({ fileUrl: d.driveViewLink || d.fileUrl, title })}
                />
              );
            })}
            {otherDocs.map(doc => (
              <UploadedDocRow
                key={doc.id}
                doc={doc}
                docDef={null}
                canDelete={canDelete}
                onDeleted={onRefresh}
                onPreview={(d, title) => setPreviewFile({ fileUrl: d.driveViewLink || d.fileUrl, title })}
              />
            ))}

            {/* Application workflow documents (offer letter, eVisa, approvals, …). */}
            {extraDocs.map(d => (
              <div key={d.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{d.label}</p>
                    {d.subtitle && <p className="text-xs text-muted-foreground truncate">{d.subtitle}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
                    onClick={() => setPreviewFile({ fileUrl: d.url, title: d.label })}>
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                  <a href={d.url} download target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </a>
                  {canDelete && d.deleteKind && (
                    <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteWorkflowDoc(d)} disabled={deletingWorkflowDoc === d.key}>
                      {deletingWorkflowDoc === d.key
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All done, nothing to upload */}
        {canUpload && missingDocs.length === 0 && allRequiredDone && uploadedDocs.length > 0 && (
          <div className="rounded-xl border-2 border-dashed border-emerald-200 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400 mb-2" />
            <p className="text-sm text-emerald-600 font-medium">All documents submitted</p>
          </div>
        )}
      </div>
    </>
  );
}
