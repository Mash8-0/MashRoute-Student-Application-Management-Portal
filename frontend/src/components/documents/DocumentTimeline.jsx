import { useState } from 'react';
import { FileText, CheckCircle2, Eye, Download, Trash2, Loader2, X, Clock } from 'lucide-react';
import { STAGES, DOC_TITLE_BY_TYPE } from '../../lib/documentStages';
import { documentAPI } from '../../api/endpoints';
import { toast } from '../ui/toast';
import { formatDate } from '../../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPreviewUrl(fileUrl) {
  if (!fileUrl) return null;
  const m = fileUrl.match(/[?&]id=([\w-]+)/) || fileUrl.match(/\/d\/([\w-]+)/);
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

// ─── Verification badge ───────────────────────────────────────────────────────

function VerificationBadge({ status }) {
  if (status === 'VERIFIED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-500">
        <CheckCircle2 className="h-3 w-3" /> Verified
      </span>
    );
  }
  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-500">
        <X className="h-3 w-3" /> Rejected
      </span>
    );
  }
  return null;
}

// ─── Single document row ──────────────────────────────────────────────────────

function DocRow({ doc, canDelete, onRefresh, onPreview }) {
  const [deleting, setDeleting] = useState(false);

  const title = DOC_TITLE_BY_TYPE[doc.type] || doc.type;

  const handleDelete = async () => {
    if (!confirm(`Delete "${title}"?`)) return;
    setDeleting(true);
    try {
      await documentAPI.delete(doc.id);
      toast.success('Document deleted');
      onRefresh?.();
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
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            <VerificationBadge status={doc.verificationStatus} />
          </div>
          <p className="text-xs text-muted-foreground truncate">{doc.originalName}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            Uploaded {formatDate(doc.createdAt)}
            {doc.uploadedBy ? ` · ${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => onPreview({ fileUrl: doc.driveViewLink || doc.fileUrl, title })}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Eye className="h-3.5 w-3.5" /> View
        </button>
        <a href={doc.fileUrl} download target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Download className="h-3.5 w-3.5" /> Download
        </a>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DocumentTimeline({ documents = [], canDelete = false, onRefresh }) {
  const [previewFile, setPreviewFile] = useState(null);

  if (!documents.length) return null;

  const stageGroups = STAGES
    .map((stage) => ({
      stage,
      docs: documents.filter((d) => stage.docTypes.includes(d.type)),
    }))
    .filter((g) => g.docs.length > 0);

  if (!stageGroups.length) return null;

  return (
    <>
      <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

      <div className="space-y-6">
        {stageGroups.map(({ stage, docs }) => (
          <div key={stage.key ?? stage.label} className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-base font-bold text-foreground">{stage.label}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                {docs.length}
              </span>
            </div>
            <div className="space-y-2">
              {docs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  canDelete={canDelete}
                  onRefresh={onRefresh}
                  onPreview={setPreviewFile}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
