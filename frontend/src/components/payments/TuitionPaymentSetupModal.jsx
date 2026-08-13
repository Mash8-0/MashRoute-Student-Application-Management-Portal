import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, FileText, Loader2, X } from 'lucide-react';
import { applicationAPI, emgsPaymentAPI } from '../../api/endpoints';
import { Button } from '../ui/button';
import { toast } from '../ui/toast';

const inputClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40';

function money(value, currency = 'MYR') {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(Number(value || 0));
}

export default function TuitionPaymentSetupModal({ application, onClose, onConfigured }) {
  const [screen, setScreen] = useState('setup');
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    amount: '', currency: 'MYR',
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    description: 'Tuition fees for your university programme.', notes: '',
    accountType: 'TENANT_ACCOUNT', destinationAccountId: '',
    generateFolio: true, notifyStudent: true,
  });
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const selectedAccount = useMemo(() => accounts.find((row) => row.id === form.destinationAccountId), [accounts, form.destinationAccountId]);

  useEffect(() => {
    emgsPaymentAPI.listAccounts({
      accountType: form.accountType,
      ...(form.accountType === 'UNIVERSITY_ACCOUNT' && { universityId: application.universityId }),
      currency: form.currency,
    }).then((res) => {
      const rows = res.data.data || [];
      setAccounts(rows);
      setForm((prev) => ({ ...prev, destinationAccountId: rows.find((row) => row.isDefault)?.id || rows[0]?.id || '' }));
    }).catch(() => setAccounts([]));
  }, [form.accountType, form.currency, application.universityId]);

  const review = () => {
    if (!form.amount || Number(form.amount) <= 0 || !form.dueDate || !form.destinationAccountId) {
      toast.error('Amount, due date, and payment account are required');
      return;
    }
    setScreen('confirm');
  };

  const confirmSetup = async () => {
    setSaving(true);
    try {
      await applicationAPI.openTuitionPayment(application.id, form);
      toast.success('Tuition payment opened, folio generated, and email sent');
      onClose();
      await onConfigured?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not open tuition payment');
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
    <div className="max-h-[94vh] w-full max-w-2xl overflow-auto rounded-2xl border border-border bg-background shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
        <div>
          <h2 className="font-semibold">{screen === 'confirm' ? 'Review Tuition Fees Payment' : 'Open Tuition Fees Payment & Generate Tuition Fees Folio'}</h2>
          <p className="text-xs text-muted-foreground">{application.student?.fullName} · {application.referenceNo}</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      {screen === 'setup' && <div className="space-y-5 p-6">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          Configure the tuition fee here. Confirmation will generate the tuition fees folio PDF and email it with the eVisa, EMGS approval, and eVAL approval documents.
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-medium">Fee Type</label><input className={inputClass} value="Tuition Fees" disabled /></div>
          <div><label className="mb-1 block text-xs font-medium">Currency</label><select className={inputClass} value={form.currency} onChange={(e) => set('currency', e.target.value)}><option>MYR</option><option>USD</option></select></div>
          <div><label className="mb-1 block text-xs font-medium">Amount *</label><input type="number" min="0.01" step="0.01" className={inputClass} value={form.amount} onChange={(e) => set('amount', e.target.value)} /></div>
          <div><label className="mb-1 block text-xs font-medium">Due Date *</label><input type="date" className={inputClass} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>
        </div>
        <div><label className="mb-1 block text-xs font-medium">Payment To *</label><div className="grid gap-2 sm:grid-cols-2">
          {[["TENANT_ACCOUNT", "Tenant / Admin Account"], ["UNIVERSITY_ACCOUNT", "University Account"]].map(([value, label]) => <button type="button" key={value} className={`rounded-xl border p-3 text-left text-sm ${form.accountType === value ? 'border-primary bg-primary/10' : 'border-border'}`} onClick={() => set('accountType', value)}>{label}</button>)}
        </div></div>
        <div><label className="mb-1 block text-xs font-medium">Select Payment Account *</label><select className={inputClass} value={form.destinationAccountId} onChange={(e) => set('destinationAccountId', e.target.value)}><option value="">Select account</option>{accounts.map((row) => <option key={row.id} value={row.id}>{row.label} — {row.bankName} {row.currency} — {row.maskedAccountNumber}{row.isDefault ? ' (Default)' : ''}</option>)}</select>{!accounts.length && <p className="mt-1 text-xs text-amber-500">No eligible active account found for this destination and currency.</p>}</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.generateFolio} readOnly />Generate Tuition Fees Folio</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notifyStudent} readOnly />Notify Student with Attachments</label></div>
        <div><label className="mb-1 block text-xs font-medium">Student-visible Description</label><textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" value={form.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div><label className="mb-1 block text-xs font-medium">Internal Note</label><textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        <div className="flex justify-end"><Button onClick={review}><FileText className="h-4 w-4" /> Review &amp; Generate Folio</Button></div>
      </div>}

      {screen === 'confirm' && <div className="space-y-5 p-6">
        <div className="rounded-xl border border-border bg-muted/20 p-4"><div className="grid grid-cols-[150px_1fr] gap-y-2 text-sm">
          <span className="text-muted-foreground">Student</span><strong>{application.student?.fullName}</strong>
          <span className="text-muted-foreground">Application</span><strong>{application.university?.name} — {application.program}</strong>
          <span className="text-muted-foreground">Fee</span><strong>{form.description}</strong>
          <span className="text-muted-foreground">Amount</span><strong>{money(form.amount, form.currency)}</strong>
          <span className="text-muted-foreground">Due Date</span><strong><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{form.dueDate}</strong>
          <span className="text-muted-foreground">Payment To</span><strong>{form.accountType === 'UNIVERSITY_ACCOUNT' ? 'University Account' : 'Tenant / Admin Account'}</strong>
          <span className="text-muted-foreground">Account</span><strong>{selectedAccount ? `${selectedAccount.label} — ${selectedAccount.bankName} ${selectedAccount.maskedAccountNumber}` : 'Not selected'}</strong>
          <span className="text-muted-foreground">Email</span><strong>Send folio and approval attachments</strong>
        </div></div>
        <div className="flex justify-between"><Button variant="outline" onClick={() => setScreen('setup')}><ArrowLeft className="h-4 w-4" /> Back</Button><Button disabled={saving} onClick={confirmSetup}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm &amp; Generate Folio</Button></div>
      </div>}
    </div>
  </div>;
}
