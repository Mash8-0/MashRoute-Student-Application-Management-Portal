import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, CheckCircle2, XCircle, Eye, Download, Loader2,
  Mail, Phone, Globe, FileText, Clock, X,
} from 'lucide-react';
import { tenantAPI } from '../../api/endpoints';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { toast } from '../../components/ui/toast';
import { formatDate } from '../../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPreviewUrl(fileUrl) {
  if (!fileUrl) return null;
  // Convert google drive share links to embeddable preview links.
  const idMatch =
    fileUrl.match(/[?&]id=([\w-]+)/) ||
    fileUrl.match(/\/file\/d\/([\w-]+)/) ||
    fileUrl.match(/\/d\/([\w-]+)/);
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  return fileUrl;
}

function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

// ─── Document preview modal (reused from DocumentUploadSection) ────────────────

function PreviewModal({ doc, onClose }) {
  if (!doc) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="flex w-full max-w-4xl flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        style={{ height: '90vh' }}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <p className="font-semibold text-sm truncate">{doc.title}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={doc.fileUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-muted/30 overflow-hidden">
          <iframe
            src={getPreviewUrl(doc.fileUrl)}
            title={doc.title}
            className="h-full w-full border-0"
            allow="autoplay"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Image (logo) enlarge modal ───────────────────────────────────────────────

function ImageModal({ image, onClose }) {
  if (!image) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background border border-border shadow-lg hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <img
          src={image.src}
          alt={image.alt}
          className="max-h-[80vh] max-w-[80vw] rounded-2xl border border-border bg-card object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}

// ─── Detail field row ─────────────────────────────────────────────────────────

function DetailField({ icon: Icon, label, value, href }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium text-primary hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-sm font-medium text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}

// ─── Pending company card ─────────────────────────────────────────────────────

function CompanyCard({ tenant, onPreview, onEnlargeLogo, onApprove, onReject, busy }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [imgError, setImgError] = useState(false);

  const docUrl = tenant.verificationDocUrl;
  const website = tenant.website;
  const websiteHref =
    website && !/^https?:\/\//i.test(website) ? `https://${website}` : website;

  const submitReject = () => {
    onReject(tenant.id, reason.trim());
    setShowReject(false);
    setReason('');
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo / avatar */}
          {tenant.logo && !imgError ? (
            <button
              type="button"
              onClick={() => onEnlargeLogo({ src: tenant.logo, alt: tenant.name })}
              className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-border bg-muted ring-1 ring-border transition-transform hover:scale-105"
            >
              <img
                src={tenant.logo}
                alt={tenant.name}
                className="h-full w-full object-cover"
                onError={() => setImgError(true)}
              />
            </button>
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary ring-1 ring-border">
              {initials(tenant.name)}
            </div>
          )}
          <div className="min-w-0">
            <CardTitle className="truncate">{tenant.name}</CardTitle>
            <div className="mt-1.5 flex items-center gap-2">
              <StatusBadge status="PENDING" />
              {tenant.verificationType && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {tenant.verificationType}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
          <Clock className="h-3.5 w-3.5" />
          {tenant.submittedAt ? formatDate(tenant.submittedAt) : '—'}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Contact details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DetailField icon={Building2} label="Contact Person" value={tenant.contactPersonName} />
          <DetailField icon={Mail} label="Email" value={tenant.email} href={tenant.email ? `mailto:${tenant.email}` : undefined} />
          <DetailField icon={Phone} label="Phone" value={tenant.phone} href={tenant.phone ? `tel:${tenant.phone}` : undefined} />
          <DetailField icon={Globe} label="Country" value={tenant.country} />
          <DetailField icon={Globe} label="Website" value={website} href={websiteHref} />
        </div>

        {/* Verification document */}
        {docUrl && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Verification Document</p>
                <p className="text-xs text-muted-foreground">{tenant.verificationType || 'Submitted document'}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onPreview({ fileUrl: docUrl, title: `${tenant.name} — Verification Document` })}
            >
              <Eye className="h-3.5 w-3.5" /> View Document
            </Button>
          </div>
        )}

        {/* Reject inline form */}
        {showReject ? (
          <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <label className="block text-sm font-semibold text-foreground">
              Reason for rejection
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Explain why this registration is being rejected (optional but recommended)..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowReject(false); setReason(''); }}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-red-600 text-white hover:bg-red-600/90"
                onClick={submitReject}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Confirm Rejection
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="gap-1.5 border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-600"
              onClick={() => setShowReject(true)}
              disabled={busy}
            >
              <XCircle className="h-4 w-4" /> Reject
            </Button>
            <Button
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-600/90"
              onClick={() => onApprove(tenant.id)}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CompanyApprovals() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [enlargedLogo, setEnlargedLogo] = useState(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantAPI.listPending();
      setTenants(res.data.data || []);
    } catch {
      toast.error('Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (id) => {
    setActioningId(id);
    try {
      await tenantAPI.approve(id);
      toast.success('Company approved');
      await fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve company');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id, reason) => {
    setActioningId(id);
    try {
      await tenantAPI.reject(id, reason);
      toast.success('Company registration rejected');
      await fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject company');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <ImageModal image={enlargedLogo} onClose={() => setEnlargedLogo(null)} />

      <PageHeader
        title="Company Approval Requests"
        description={
          loading
            ? 'Loading pending registrations...'
            : `${tenants.length} pending registration${tenants.length !== 1 ? 's' : ''} awaiting review`
        }
      />

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Loading pending companies...</p>
        </div>
      ) : tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <p className="mt-4 text-base font-semibold text-foreground">No pending company registrations.</p>
          <p className="mt-1 text-sm text-muted-foreground">New company sign-ups will appear here for review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {tenants.map((tenant, i) => (
            <motion.div
              key={tenant.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
            >
              <CompanyCard
                tenant={tenant}
                busy={actioningId === tenant.id}
                onPreview={setPreviewDoc}
                onEnlargeLogo={setEnlargedLogo}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
