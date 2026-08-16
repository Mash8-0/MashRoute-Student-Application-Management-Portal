import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, Wallet, X } from 'lucide-react';
import { emgsPaymentAPI } from '../../api/endpoints';
import { Button } from '../ui/button';
import { toast } from '../ui/toast';

const inputClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40';
const REASONS = [
  ['UNIVERSITY_HANDLES_EMGS', 'University handles EMGS'], ['EMGS_ALREADY_PAID', 'EMGS already paid'],
  ['NOT_APPLICABLE', 'EMGS not applicable'], ['SCHOLARSHIP_OR_SPONSORSHIP', 'Scholarship or sponsorship'],
  ['STUDENT_WITHDRAWN', 'Student withdrawn'], ['OTHER', 'Other'],
];

function money(value, currency = 'MYR') {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency }).format(Number(value || 0));
}

export default function EmgsPaymentSetupModal({ application, onClose, onConfigured }) {
  const [screen, setScreen] = useState('decision');
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [reason, setReason] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [form, setForm] = useState({
    amount: '', currency: 'MYR', dueDate: '', allowPartialPayment: false, minimumPartialAmount: '',
    studentVisibleDescription: 'EMGS processing fee for your application.', internalNote: '',
    generateInvoice: true, notifyStudent: true, accountType: 'TENANT_ACCOUNT', destinationAccountId: '',
  });

  useEffect(() => {
    if (screen !== 'setup') return;
    emgsPaymentAPI.listAccounts({ accountType: form.accountType, universityId: application.universityId, currency: form.currency })
      .then((res) => {
        const rows = res.data.data || [];
        setAccounts(rows);
        setForm((prev) => ({ ...prev, destinationAccountId: rows.find((row) => row.isDefault)?.id || rows[0]?.id || '' }));
      })
      .catch(() => setAccounts([]));
  }, [screen, form.accountType, form.currency, application.universityId]);

  const selectedAccount = useMemo(() => accounts.find((row) => row.id === form.destinationAccountId), [accounts, form.destinationAccountId]);
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const postpone = async () => {
    setSaving(true);
    try { await emgsPaymentAPI.postpone(application.id); toast.success('EMGS setup task created'); onConfigured?.(); onClose(); }
    catch (err) { toast.error(err.response?.data?.message || 'Could not postpone setup'); }
    finally { setSaving(false); }
  };

  const markNotRequired = async () => {
    if (!reason || (reason === 'OTHER' && !reasonNote.trim())) return toast.error('Select a reason and add the required note');
    setSaving(true);
    try { await emgsPaymentAPI.notRequired(application.id, { reason, note: reasonNote }); toast.success('EMGS marked not required'); onConfigured?.(); onClose(); }
    catch (err) { toast.error(err.response?.data?.message || 'Could not save decision'); }
    finally { setSaving(false); }
  };

  const confirmSetup = async () => {
    if (!form.amount || !form.dueDate || !form.destinationAccountId) return toast.error('Amount, due date, and payment account are required');
    setSaving(true);
    try {
      await emgsPaymentAPI.setup(application.id, form);
      toast.success('EMGS payment opened'); onConfigured?.(); onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not open EMGS payment'); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
    <div className="max-h-[94vh] w-full max-w-2xl overflow-auto rounded-2xl border border-border bg-background shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
        <div><h2 className="font-semibold">{screen === 'decision' ? 'Offer Letter Issued Successfully' : screen === 'notRequired' ? 'EMGS Not Required' : screen === 'confirm' ? 'Confirm EMGS Payment' : 'Set Up EMGS Payment'}</h2><p className="text-xs text-muted-foreground">{application.student?.fullName} · {application.referenceNo}</p></div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      {screen === 'decision' && <div className="space-y-5 p-6">
        <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500"/><p className="text-sm">The Offer Letter has been uploaded successfully. Would you like to set up the EMGS payment for this application now?</p></div>
        <div className="grid gap-3 sm:grid-cols-3"><Button className="h-auto py-4" onClick={() => setScreen('setup')}><Wallet className="h-4 w-4"/> Set Up EMGS Payment</Button><Button variant="outline" className="h-auto py-4" disabled={saving} onClick={postpone}>Set Up Later</Button><Button variant="outline" className="h-auto py-4 text-amber-500" onClick={() => setScreen('notRequired')}>EMGS Not Required</Button></div>
      </div>}

      {screen === 'notRequired' && <div className="space-y-4 p-6"><label className="text-xs font-medium">Reason</label><select className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)}><option value="">Select reason</option>{REASONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><label className="text-xs font-medium">Internal Note {reason === 'OTHER' && '*'}</label><textarea className="min-h-24 w-full rounded-lg border border-input bg-background p-3 text-sm" value={reasonNote} onChange={(e)=>setReasonNote(e.target.value)}/><div className="flex justify-between"><Button variant="outline" onClick={()=>setScreen('decision')}><ArrowLeft className="h-4 w-4"/>Back</Button><Button disabled={saving} onClick={markNotRequired}>{saving && <Loader2 className="h-4 w-4 animate-spin"/>}Confirm Not Required</Button></div></div>}

      {screen === 'setup' && <div className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1 block text-xs font-medium">Fee Type</label><input className={inputClass} value="EMGS Fee" disabled/></div><div><label className="mb-1 block text-xs font-medium">Currency</label><select className={inputClass} value={form.currency} onChange={(e)=>set('currency',e.target.value)}><option>MYR</option><option>USD</option></select></div><div><label className="mb-1 block text-xs font-medium">Amount *</label><input type="number" min="0.01" step="0.01" className={inputClass} value={form.amount} onChange={(e)=>set('amount',e.target.value)}/></div><div><label className="mb-1 block text-xs font-medium">Due Date *</label><input type="date" className={inputClass} value={form.dueDate} onChange={(e)=>set('dueDate',e.target.value)}/></div></div>
        <div><label className="mb-1 block text-xs font-medium">Payment To *</label><div className="grid gap-2 sm:grid-cols-2">{[['TENANT_ACCOUNT','Tenant / Admin Account'],['UNIVERSITY_ACCOUNT','University Account']].map(([value,label])=><button key={value} className={`rounded-xl border p-3 text-left text-sm ${form.accountType===value?'border-primary bg-primary/10':'border-border'}`} onClick={()=>set('accountType',value)}>{label}</button>)}</div></div>
        <div><label className="mb-1 block text-xs font-medium">Select Payment Account *</label><select className={inputClass} value={form.destinationAccountId} onChange={(e)=>set('destinationAccountId',e.target.value)}><option value="">Select account</option>{accounts.map((row)=><option key={row.id} value={row.id}>{row.label} — {row.bankName} {row.currency} — {row.maskedAccountNumber}{row.isDefault?' (Default)':''}</option>)}</select>{!accounts.length&&<p className="mt-1 text-xs text-amber-500">No eligible active account found for this destination and currency.</p>}</div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowPartialPayment} onChange={(e)=>set('allowPartialPayment',e.target.checked)}/>Allow Partial Payment</label>{form.allowPartialPayment&&<input className={inputClass} type="number" placeholder="Minimum partial amount" value={form.minimumPartialAmount} onChange={(e)=>set('minimumPartialAmount',e.target.value)}/>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.generateInvoice} onChange={(e)=>set('generateInvoice',e.target.checked)}/>Generate Invoice</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notifyStudent} onChange={(e)=>set('notifyStudent',e.target.checked)}/>Notify Student</label></div>
        <div><label className="mb-1 block text-xs font-medium">Student-visible Description</label><textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" value={form.studentVisibleDescription} onChange={(e)=>set('studentVisibleDescription',e.target.value)}/></div><div><label className="mb-1 block text-xs font-medium">Internal Note</label><textarea className="min-h-16 w-full rounded-lg border border-input bg-background p-3 text-sm" value={form.internalNote} onChange={(e)=>set('internalNote',e.target.value)}/></div>
        <div className="flex justify-between"><Button variant="outline" onClick={()=>setScreen('decision')}><ArrowLeft className="h-4 w-4"/>Back</Button><Button onClick={()=>setScreen('confirm')}>Review Setup</Button></div>
      </div>}

      {screen === 'confirm' && <div className="space-y-5 p-6"><div className="rounded-xl border border-border bg-muted/20 p-4"><div className="grid grid-cols-[150px_1fr] gap-y-2 text-sm"><span className="text-muted-foreground">Student</span><strong>{application.student?.fullName}</strong><span className="text-muted-foreground">Application</span><strong>{application.university?.name} — {application.program}</strong><span className="text-muted-foreground">Fee</span><strong>EMGS Fee</strong><span className="text-muted-foreground">Amount</span><strong>{money(form.amount,form.currency)}</strong><span className="text-muted-foreground">Due Date</span><strong><CalendarDays className="mr-1 inline h-3.5 w-3.5"/>{form.dueDate}</strong><span className="text-muted-foreground">Payment To</span><strong>{form.accountType==='UNIVERSITY_ACCOUNT'?'University Account':'Tenant / Admin Account'}</strong><span className="text-muted-foreground">Account</span><strong>{selectedAccount ? `${selectedAccount.label} — ${selectedAccount.bankName} ${selectedAccount.maskedAccountNumber}` : 'Not selected'}</strong><span className="text-muted-foreground">Invoice</span><strong>{form.generateInvoice?'Generate':'Do not generate'}</strong><span className="text-muted-foreground">Student Notification</span><strong>{form.notifyStudent?'Send':'Do not send'}</strong></div></div><div className="flex justify-between"><Button variant="outline" onClick={()=>setScreen('setup')}><ArrowLeft className="h-4 w-4"/>Back</Button><Button disabled={saving} onClick={confirmSetup}>{saving&&<Loader2 className="h-4 w-4 animate-spin"/>}Confirm &amp; Open Payment</Button></div></div>}
    </div>
  </div>;
}
