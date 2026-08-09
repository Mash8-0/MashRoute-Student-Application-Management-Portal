import { useState } from 'react';
import { PlaneLanding, Calendar, Upload, Loader2, Eye, Download, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
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

export default function ArrivalCard({ application, canEdit, userRole, onRefresh }) {
  const initialDate = application?.arrivalDate
    ? new Date(application.arrivalDate).toISOString().slice(0, 10)
    : '';

  const initialFlightDate = application?.flightDate
    ? new Date(application.flightDate).toISOString().slice(0, 10)
    : '';

  const [arrivalDate, setArrivalDate] = useState(initialDate);
  const [flightDate, setFlightDate] = useState(initialFlightDate);
  const [flightNumber, setFlightNumber] = useState(application?.flightNumber || '');
  const [airline, setAirline] = useState(application?.airline || '');
  const [lastPortOfEmbarkation, setLastPortOfEmbarkation] = useState(application?.lastPortOfEmbarkation || '');
  const [modeOfTravel, setModeOfTravel] = useState(application?.modeOfTravel || 'AIR');
  const [accommodationName, setAccommodationName] = useState(application?.malaysiaAccommodationName || '');
  const [accommodationAddress, setAccommodationAddress] = useState(application?.malaysiaAccommodationAddress || '');
  const [accommodationState, setAccommodationState] = useState(application?.malaysiaAccommodationState || '');
  const [accommodationCity, setAccommodationCity] = useState(application?.malaysiaAccommodationCity || '');
  const [accommodationPostcode, setAccommodationPostcode] = useState(application?.malaysiaAccommodationPostcode || '');
  const [file, setFile] = useState(null);
  const [mdacFile, setMdacFile] = useState(null);
  const [mdacNotes, setMdacNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [mdacBusy, setMdacBusy] = useState(false);

  const hasArrivalDate = Boolean(application?.arrivalDate);
  const hasFlightDate = Boolean(application?.flightDate);
  const hasTicket = Boolean(application?.flightTicketUrl);
  const mdac = application?.mdac;
  const eligibility = mdac?.eligibility || {};
  const isAdmin = ['TENANT_ADMIN', 'SUPER_ADMIN'].includes(userRole);

  const mdacTone = {
    NOT_REQUIRED: 'bg-muted text-muted-foreground border-border',
    NOT_YET_ELIGIBLE: 'bg-muted text-muted-foreground border-border',
    ELIGIBLE_NOW: 'bg-blue-500/10 text-blue-700 border-blue-200',
    DUE_TOMORROW: 'bg-amber-500/10 text-amber-700 border-amber-200',
    DUE_TODAY: 'bg-red-500/10 text-red-700 border-red-200',
    OVERDUE: 'bg-red-500/10 text-red-700 border-red-200',
    SUBMITTED: 'bg-purple-500/10 text-purple-700 border-purple-200',
    VERIFIED: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
    NEEDS_REVIEW: 'bg-orange-500/10 text-orange-700 border-orange-200',
    ARRIVAL_DATE_CHANGED: 'bg-orange-500/10 text-orange-700 border-orange-200',
  }[eligibility.displayState] || 'bg-muted text-muted-foreground border-border';

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
      form.append('flightNumber', flightNumber);
      form.append('airline', airline);
      form.append('lastPortOfEmbarkation', lastPortOfEmbarkation);
      form.append('modeOfTravel', modeOfTravel);
      form.append('accommodationName', accommodationName);
      form.append('accommodationAddress', accommodationAddress);
      form.append('accommodationState', accommodationState);
      form.append('accommodationCity', accommodationCity);
      form.append('accommodationPostcode', accommodationPostcode);
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

  const uploadMdac = async () => {
    if (!mdacFile) {
      toast.error('Upload the MDAC confirmation proof first.');
      return;
    }
    setMdacBusy(true);
    try {
      const form = new FormData();
      form.append('file', mdacFile);
      if (mdacNotes) form.append('notes', mdacNotes);
      await applicationAPI.uploadMdacProof(application.id, form);
      toast.success('MDAC proof uploaded');
      setMdacFile(null);
      setMdacNotes('');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload MDAC proof');
    } finally {
      setMdacBusy(false);
    }
  };

  const mdacAction = async (action) => {
    setMdacBusy(true);
    try {
      if (action === 'submitted') await applicationAPI.markMdacSubmitted(application.id, mdacNotes);
      if (action === 'not_required') await applicationAPI.markMdacNotRequired(application.id, mdacNotes);
      if (action === 'verify') await applicationAPI.verifyMdac(application.id, { action: 'verify', notes: mdacNotes });
      if (action === 'review') await applicationAPI.verifyMdac(application.id, { action: 'review', notes: mdacNotes });
      toast.success('MDAC status updated');
      setMdacNotes('');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update MDAC');
    } finally {
      setMdacBusy(false);
    }
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} placeholder="Flight number" disabled={saving} aria-label="Flight number" />
            <Input value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="Airline" disabled={saving} aria-label="Airline" />
            <Input value={lastPortOfEmbarkation} onChange={(e) => setLastPortOfEmbarkation(e.target.value)} placeholder="Last port of embarkation" disabled={saving} aria-label="Last port of embarkation" />
            <select
              value={modeOfTravel}
              onChange={(e) => setModeOfTravel(e.target.value)}
              disabled={saving}
              aria-label="Mode of travel"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="AIR">Air</option>
              <option value="LAND">Land</option>
              <option value="SEA">Sea</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input value={accommodationName} onChange={(e) => setAccommodationName(e.target.value)} placeholder="Accommodation name/type" disabled={saving} aria-label="Accommodation name or type" />
            <Input value={accommodationAddress} onChange={(e) => setAccommodationAddress(e.target.value)} placeholder="Accommodation address" disabled={saving} aria-label="Accommodation address" />
            <Input value={accommodationState} onChange={(e) => setAccommodationState(e.target.value)} placeholder="State" disabled={saving} aria-label="Accommodation state" />
            <Input value={accommodationCity} onChange={(e) => setAccommodationCity(e.target.value)} placeholder="City" disabled={saving} aria-label="Accommodation city" />
            <Input value={accommodationPostcode} onChange={(e) => setAccommodationPostcode(e.target.value)} placeholder="Postcode" disabled={saving} aria-label="Accommodation postcode" />
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

      {mdac && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-foreground">MDAC Reminder & Tracking</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Window opens {eligibility.windowStartDate || 'after arrival is set'} · deadline {eligibility.deadlineDate || '—'}
              </p>
            </div>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${mdacTone}`}>
              {(eligibility.displayState || mdac.status || 'REQUIRED').replace(/_/g, ' ')}
            </span>
          </div>

          {(eligibility.displayState === 'ARRIVAL_DATE_CHANGED' || eligibility.displayState === 'NEEDS_REVIEW') && (
            <div className="flex gap-2 rounded-lg border border-orange-200 bg-orange-500/10 p-3 text-sm text-orange-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>The Malaysia arrival date changed after MDAC activity. Review the proof or submit MDAC again if needed.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Malaysia arrival:</span> {eligibility.arrivalDate || 'Not set'}</p>
            <p><span className="text-muted-foreground">Timezone:</span> {eligibility.timezone || 'Asia/Kuala_Lumpur'}</p>
            <p><span className="text-muted-foreground">Flight:</span> {application.flightNumber || '—'} {application.airline ? `· ${application.airline}` : ''}</p>
            <p><span className="text-muted-foreground">Last port:</span> {application.lastPortOfEmbarkation || '—'}</p>
            <p className="sm:col-span-2"><span className="text-muted-foreground">Accommodation:</span> {[application.malaysiaAccommodationName, application.malaysiaAccommodationAddress, application.malaysiaAccommodationCity, application.malaysiaAccommodationState, application.malaysiaAccommodationPostcode].filter(Boolean).join(', ') || '—'}</p>
            <p><span className="text-muted-foreground">Submitted:</span> {mdac.submittedAt ? formatArrivalDate(mdac.submittedAt) : '—'}</p>
            <p><span className="text-muted-foreground">Verified:</span> {mdac.verifiedAt ? formatArrivalDate(mdac.verifiedAt) : '—'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={eligibility.officialUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4" /> Official MDAC
              </Button>
            </a>
            {mdac.proofUrl && (
              <a href={mdac.proofUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4" /> View Proof
                </Button>
              </a>
            )}
          </div>

          {canEdit && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setMdacFile(e.target.files?.[0] || null)}
                disabled={mdacBusy}
                aria-label="MDAC confirmation proof"
              />
              <textarea
                value={mdacNotes}
                onChange={(e) => setMdacNotes(e.target.value)}
                placeholder="Review notes"
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={mdacBusy}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={uploadMdac} disabled={mdacBusy || !mdacFile}>
                  <Upload className="h-4 w-4" /> Upload Proof
                </Button>
                <Button variant="outline" size="sm" onClick={() => mdacAction('submitted')} disabled={mdacBusy}>
                  Mark Submitted
                </Button>
                {isAdmin && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => mdacAction('not_required')} disabled={mdacBusy}>
                      Not Required
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => mdacAction('review')} disabled={mdacBusy}>
                      Needs Review
                    </Button>
                    <Button size="sm" onClick={() => mdacAction('verify')} disabled={mdacBusy}>
                      <ShieldCheck className="h-4 w-4" /> Verify
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
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
