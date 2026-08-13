import { useState } from 'react';
import { PlaneLanding, Calendar, Upload, Loader2, Eye, Download } from 'lucide-react';
import { Button, Input } from '../ui';
import { applicationAPI } from '../../api/endpoints';
import { toast } from '../ui/toast';
import { formatDate } from '../../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPreviewUrl(fileUrl) {
  if (!fileUrl) return null;
  // Convert a Google Drive link (?id=ID or /d/ID/) to its /file/d/ID/preview form
  const idMatch =
    fileUrl.match(/[?&]id=([\w-]+)/) || fileUrl.match(/\/d\/([\w-]+)/);
  if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  return fileUrl;
}

function formatArrivalDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return formatDate(dateStr);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ArrivalCard({ application, canEdit, onRefresh }) {
  const initialDate = application?.arrivalDate
    ? new Date(application.arrivalDate).toISOString().slice(0, 10)
    : '';

  const initialFlightDate = application?.flightDate
    ? new Date(application.flightDate).toISOString().slice(0, 10)
    : '';

  const [arrivalDate, setArrivalDate] = useState(initialDate);
  const [flightDate, setFlightDate] = useState(initialFlightDate);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const hasArrivalDate = Boolean(application?.arrivalDate);
  const hasFlightDate = Boolean(application?.flightDate);
  const hasTicket = Boolean(application?.flightTicketUrl);

  const handleSave = async () => {
    if (!arrivalDate && !flightDate && !file) {
      toast.error('Please add a flight/arrival date or flight ticket.');
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      if (file) form.append('file', file);
      if (arrivalDate) form.append('arrivalDate', arrivalDate);
      if (flightDate) form.append('flightDate', flightDate);
      await applicationAPI.updateArrival(application.id, form);
      toast.success('Arrival details saved successfully');
      setFile(null);
      onRefresh?.();
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Failed to save arrival details. Please try again.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openTicket = () => {
    const url = getPreviewUrl(application.flightTicketUrl);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <PlaneLanding className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Arrival Details</h3>
          <p className="text-xs text-muted-foreground">
            Confirmed arrival date and flight ticket
          </p>
        </div>
      </div>

      {/* ── Highlighted date badges ── */}
      {(hasFlightDate || hasArrivalDate) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {hasFlightDate && (
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">Flight Date</p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">{formatArrivalDate(application.flightDate)}</p>
                </div>
              </div>
            </div>
          )}
          {hasArrivalDate && (
            <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary/80">Arrival Date</p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">{formatArrivalDate(application.arrivalDate)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Flight ticket row ── */}
      {hasTicket && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <PlaneLanding className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Flight Ticket</p>
              <p className="text-xs text-muted-foreground">Uploaded flight ticket</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={openTicket}
            >
              <Eye className="h-3.5 w-3.5" /> View
            </Button>
            <a
              href={application.flightTicketUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </a>
          </div>
        </div>
      )}

      {/* ── Edit form ── */}
      {canEdit && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {hasArrivalDate || hasTicket ? 'Update Arrival Details' : 'Add Arrival Details'}
            </h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Set the arrival date and upload the flight ticket.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="flight-date">
                Flight Date
              </label>
              <Input
                id="flight-date"
                type="date"
                value={flightDate}
                onChange={(e) => setFlightDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground" htmlFor="arrival-date">
                Arrival Date
              </label>
              <Input
                id="arrival-date"
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground" htmlFor="flight-ticket">
              Flight Ticket
            </label>
            <Input
              id="flight-ticket"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={saving}
              className="file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary"
            />
            {file && (
              <p className="text-[11px] text-muted-foreground truncate">{file.name}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {saving ? 'Saving...' : 'Save Arrival Details'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Empty state for read-only users ── */}
      {!canEdit && !hasArrivalDate && !hasFlightDate && !hasTicket && (
        <div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
          <PlaneLanding className="mx-auto mb-2 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Arrival details not added yet.</p>
        </div>
      )}
    </div>
  );
}
