import { useState, useRef } from 'react';
import { FileText, Download, Upload, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { loeAPI } from '../../api/endpoints';
import { toast } from '../ui/toast';

// ─── Generate Modal ────────────────────────────────────────────────────────────

function GenerateModal({ application, onClose, onGenerated }) {
  const [form, setForm] = useState({
    scholarshipPct: 50,
    tuitionPerYear: 18020,
    programDuration: '2.5 Years',
    facultyName: 'School of Social Science',
    englishRequirement: 'English Placement Test required',
    additionalNotes: '',
  });
  const [saving, setSaving] = useState(false);

  const student = application?.student || {};
  const missingFields = [
    !student.fullName && 'Full Name',
    !student.passportNumber && 'Passport Number',
    !student.nationality && 'Nationality',
    !application?.program && 'Program',
    !application?.intake && 'Intake',
  ].filter(Boolean);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    setSaving(true);
    try {
      const res = await loeAPI.generate(application.id, form);
      onGenerated(res.data.data.loe);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate LOE');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-background shadow-2xl border border-border">
        {/* Header */}
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Generate Letter of Eligibility
          </h2>
          {application?.student?.fullName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {application.student.fullName} — {application.program || 'No program'}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Missing fields warning */}
          {missingFields.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                  Missing required student data
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                  The following fields are missing and must be filled on the student/application before generating:{' '}
                  <span className="font-medium">{missingFields.join(', ')}</span>
                </p>
              </div>
            </div>
          )}

          {/* Field grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium">Scholarship %</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.scholarshipPct}
                onChange={(e) => handleChange('scholarshipPct', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">Tuition per Year (RM)</label>
              <Input
                type="number"
                min={0}
                value={form.tuitionPerYear}
                onChange={(e) => handleChange('tuitionPerYear', Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">Programme Duration</label>
              <Input
                value={form.programDuration}
                onChange={(e) => handleChange('programDuration', e.target.value)}
                placeholder="e.g. 2.5 Years"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">Faculty</label>
              <Input
                value={form.facultyName}
                onChange={(e) => handleChange('facultyName', e.target.value)}
                placeholder="Faculty / School name"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium">English Requirement</label>
              <Input
                value={form.englishRequirement}
                onChange={(e) => handleChange('englishRequirement', e.target.value)}
                placeholder="e.g. English Placement Test required"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium">Additional Notes</label>
              <Input
                value={form.additionalNotes}
                onChange={(e) => handleChange('additionalNotes', e.target.value)}
                placeholder="Optional notes to include in the LOE"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={saving || missingFields.length > 0}
          >
            <FileText className="h-3.5 w-3.5" />
            {saving ? 'Generating...' : 'Generate LOE'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function LOEActions({ application, loe: initialLoe, onRefresh, userRole }) {
  const [loe, setLoe] = useState(initialLoe);
  const [showModal, setShowModal] = useState(false);
  const uploadInputRef = useRef(null);

  const isIIMAT = application?.university?.name?.includes('IIMAT');
  const isAdmin = userRole === 'TENANT_ADMIN' || userRole === 'SUPER_ADMIN';
  const isOfferLetterStatus = application?.status === 'OFFER_LETTER_ISSUED';

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    try {
      const { downloadIIMATLOE } = await import('./IIMATTemplate');
      await downloadIIMATLOE(loe, application, application.student);
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so the same file can be re-selected if needed
    e.target.value = '';

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await loeAPI.upload(application.id, formData);
      setLoe(res.data.data);
      onRefresh?.();
      toast.success('LOE uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload LOE');
    }
  };

  const handleGenerated = (newLoe) => {
    setLoe(newLoe);
    setShowModal(false);
    onRefresh?.();
    toast.success('LOE generated successfully');
  };

  // ─── Render: Not IIMAT ───────────────────────────────────────────────────────

  if (!isIIMAT) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <FileText className="h-4 w-4 flex-shrink-0" />
        LOE generation is currently available for IIMAT only.
      </div>
    );
  }

  // ─── Render: IIMAT non-admin, no LOE ────────────────────────────────────────

  if (isIIMAT && !isAdmin && !loe) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 flex-shrink-0" />
        LOE will be available once admin generates it.
      </div>
    );
  }

  // ─── Render: Main panel ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* LOE status row */}
      {loe ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                {loe.status || 'Generated'}
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-500">
                {loe.loeNumber && <span className="font-medium">{loe.loeNumber}</span>}
                {loe.generatedBy && (
                  <span>
                    {loe.loeNumber ? ' · ' : ''}Generated by{' '}
                    {loe.generatedBy.firstName
                      ? `${loe.generatedBy.firstName} ${loe.generatedBy.lastName || ''}`.trim()
                      : loe.generatedBy.name || loe.generatedBy}
                  </span>
                )}
                {loe.generatedAt && (
                  <span>
                    {(loe.loeNumber || loe.generatedBy) ? ' · ' : ''}
                    {new Date(loe.generatedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : isAdmin && isOfferLetterStatus ? (
        <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
          <FileText className="mx-auto h-8 w-8 text-primary/60 mb-2" />
          <p className="text-sm font-medium text-primary">Status reached — ready to generate LOE</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Generate a Letter of Eligibility for this applicant.
          </p>
        </div>
      ) : isAdmin && !isOfferLetterStatus ? (
        <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            LOE available once status reaches Offer Letter Issued
          </p>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Download — visible to all roles when LOE exists */}
        {loe && (
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" />
            Download LOE
          </Button>
        )}

        {/* Admin-only: Generate / Regenerate + Upload Custom */}
        {isAdmin && isOfferLetterStatus && (
          <>
            <Button size="sm" onClick={() => setShowModal(true)}>
              {loe ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate LOE
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  Generate LOE
                </>
              )}
            </Button>

            {/* Hidden file input for custom upload */}
            <input
              ref={uploadInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => uploadInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Custom
            </Button>
          </>
        )}
      </div>

      {/* Generate modal */}
      {showModal && (
        <GenerateModal
          application={application}
          onClose={() => setShowModal(false)}
          onGenerated={handleGenerated}
        />
      )}
    </div>
  );
}
