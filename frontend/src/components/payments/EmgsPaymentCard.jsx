import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Download, Eye, Loader2, Pencil, Receipt, ShieldCheck, Upload, X, XCircle } from 'lucide-react';
import { applicationAPI, emgsPaymentAPI } from '../../api/endpoints';
import { toast } from '../ui/toast';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import EmgsPaymentSetupModal from './EmgsPaymentSetupModal';

const money = (value, currency = 'MYR') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value || 0));
const label = (value) => String(value || 'NOT_CONFIGURED').replaceAll('_', ' ');
const previewUrl = (url) => {
  const match = String(url || '').match(/[?&]id=([\w-]+)/) || String(url || '').match(/\/d\/([\w-]+)/);
  return match ? `https://drive.google.com/file/d/${match[1]}/preview` : url;
};

function AmendFeeModal({ fee, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: String(fee.amount),
    dueDate: new Date(fee.dueDate).toISOString().slice(0, 10),
    description: fee.description || 'EMGS Fee',
    internalNote: fee.internalNote || '',
  });
  const save = async () => {
    if (!form.amount || !form.dueDate || !form.description.trim()) return toast.error('Amount, due date and description are required');
    setSaving(true);
    try { await emgsPaymentAPI.amendFee(fee.id, form); toast.success('EMGS payment amended'); await onSaved(); onClose(); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not amend EMGS payment'); }
    finally { setSaving(false); }
  };
  const input = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm';
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="font-semibold">Amend EMGS Payment</p><p className="text-xs text-muted-foreground">Changes are recorded in the financial audit history.</p></div><Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-xs"><span className="mb-1 block font-medium">Amount *</span><input className={input} type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></label><label className="text-xs"><span className="mb-1 block font-medium">Due date *</span><input className={input} type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} /></label><label className="text-xs sm:col-span-2"><span className="mb-1 block font-medium">Description *</span><input className={input} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></label><label className="text-xs sm:col-span-2"><span className="mb-1 block font-medium">Internal note</span><textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" value={form.internalNote} onChange={(e) => setForm((p) => ({ ...p, internalNote: e.target.value }))} /></label></div><div className="flex justify-end gap-2 border-t border-border px-5 py-4"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save Amendment</Button></div></div></div>;
}

export default function EmgsPaymentCard({ application, canVerify, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [proof, setProof] = useState(null);
  const [amount, setAmount] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [showAmend, setShowAmend] = useState(false);
  const [proofPreview, setProofPreview] = useState(null);

  const load = async () => {
    try { setData((await emgsPaymentAPI.getApplicationPayment(application.id)).data.data); }
    catch (error) { if (error.response?.status !== 404) toast.error('Unable to load EMGS payment details'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [application.id]);

  const fee = data?.fees?.find((row) => ['PAYMENT_PENDING', 'PARTIALLY_PAID'].includes(row.status)) || data?.fees?.[0];
  const total = data?.totals?.[0];
  const paymentApplication = data?.application || application;
  const submit = async () => {
    if (!proof || !amount || !fee) return toast.error('Enter the amount and choose a proof document');
    setAction('upload');
    try {
      const form = new FormData(); form.append('file', proof); form.append('feeItemId', fee.id); form.append('amount', amount);
      form.append('currency', fee.currency); form.append('paymentDate', new Date().toISOString()); form.append('paymentMethod', 'BANK_TRANSFER'); form.append('paidBy', 'STUDENT');
      await emgsPaymentAPI.submitProof(application.id, form); toast.success('Payment proof submitted for verification'); setProof(null); setAmount(''); await load();
    } catch (error) { toast.error(error.response?.data?.message || 'Payment proof submission failed'); } finally { setAction(''); }
  };
  const run = async (name, fn, message) => { setAction(name); try { await fn(); toast.success(message); await load(); } catch (error) { toast.error(error.response?.data?.message || 'Payment action failed'); } finally { setAction(''); } };
  const issueInvoice = async () => {
    if (!window.confirm('Issue the invoice and start EMGS processing?')) return;
    await run('invoice', () => applicationAPI.issueInvoice(application.id), 'Invoice issued — EMGS workflow started');
    onChanged?.();
  };

  if (loading) return <Card><CardContent className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>;
  return (<>
    {showSetup && <EmgsPaymentSetupModal application={application} onClose={() => setShowSetup(false)} onConfigured={async () => { await load(); onChanged?.(); }} />}
    {showAmend && fee && <AmendFeeModal fee={fee} onClose={() => setShowAmend(false)} onSaved={async () => { await load(); onChanged?.(); }} />}
    {proofPreview && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="font-semibold">Payment Proof Preview</p><p className="text-xs text-muted-foreground">Review the document before verifying or rejecting the payment.</p></div><div className="flex items-center gap-2"><a href={proofPreview} target="_blank" rel="noopener noreferrer" download><Button size="sm" variant="outline"><Download className="h-4 w-4"/>Download / Open</Button></a><Button size="sm" variant="ghost" onClick={() => setProofPreview(null)}><X className="h-4 w-4"/></Button></div></div><div className="min-h-0 flex-1 bg-muted/20"><iframe title="Payment proof preview" src={previewUrl(proofPreview)} className="h-full w-full border-0" allow="autoplay" /></div></div></div>}
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><CreditCard className="h-5 w-5 text-primary" /></div><div><p className="truncate text-sm font-semibold">{application.university?.name || application.program}</p><p className="text-xs text-muted-foreground">{application.referenceNo}</p></div></div>
          <div className="flex items-center gap-2"><span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">{label(data?.ledger?.status || application.emgsPaymentStatus)}</span>{canVerify && !fee && application.offerLetterUrl && <Button size="sm" onClick={() => setShowSetup(true)}>Open Payment</Button>}{canVerify && fee && <Button variant="outline" size="sm" onClick={() => setShowAmend(true)}><Pencil className="h-3.5 w-3.5"/>Edit / Amend</Button>}</div>
        </div>
        {total ? <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[['Total Payable', total.totalPayable], ['Verified Paid', total.verifiedPaid], ['Pending Verification', total.pendingVerification], ['Outstanding', total.outstanding]].map(([title, value]) => <div key={title} className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{title}</p><p className="mt-1 text-sm font-bold">{money(value, total.currency)}</p></div>)}</div> : <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{application.offerLetterUrl ? 'EMGS payment is not configured yet. Use Open Payment above to configure it here.' : 'Upload the Offer Letter before setting up EMGS payment.'}</div>}
        {fee && <div className="rounded-lg border border-border bg-muted/10 p-3 text-xs"><div className="grid gap-2 sm:grid-cols-2"><p><span className="text-muted-foreground">Payment to:</span> <b>{label(fee.destinationType)}</b></p><p><span className="text-muted-foreground">Account:</span> <b>{fee.destinationSnapshot?.maskedAccountNumber || '—'}</b></p><p><span className="text-muted-foreground">Due:</span> <b>{new Date(fee.dueDate).toLocaleDateString()}</b></p><p><span className="text-muted-foreground">Currency:</span> <b>{fee.currency}</b></p></div></div>}
        {fee && <div className="flex flex-wrap items-end gap-2 rounded-lg border border-primary/20 bg-primary/[0.03] p-3"><label className="min-w-[130px] flex-1 text-xs"><span className="mb-1 block text-muted-foreground">Amount paid</span><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={String(total?.outstanding || fee.amount)} className="h-9 w-full rounded-md border border-input bg-background px-3" /></label><label className="min-w-[180px] flex-[2] text-xs"><span className="mb-1 block text-muted-foreground">Proof (PDF/JPG/PNG)</span><input type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(e) => setProof(e.target.files?.[0])} className="block h-9 w-full text-xs file:mr-2 file:h-9 file:border-0 file:bg-muted file:px-3" /></label><Button size="sm" disabled={!proof || !amount || action === 'upload'} onClick={submit}>{action === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Submit Proof</Button></div>}
        {data?.transactions?.length > 0 && <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transactions</p>
          {data.transactions.map((tx) => <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs">
            <div><p className="font-semibold">{money(tx.amount, tx.currency)} · {label(tx.status)}</p><p className="text-muted-foreground">{tx.transactionReference || 'No reference'} · {new Date(tx.paymentDate).toLocaleDateString()}</p></div>
            <div className="flex flex-wrap gap-2">
              {tx.proofFileUrl && <Button variant="outline" size="sm" onClick={() => setProofPreview(tx.proofFileUrl)}><Eye className="h-3.5 w-3.5" /> Proof</Button>}
              {canVerify && tx.status === 'PROOF_UPLOADED' && <Button variant="outline" size="sm" onClick={() => run(`review-${tx.id}`, () => emgsPaymentAPI.startReview(tx.id), 'Proof marked under review')}><ShieldCheck className="h-3.5 w-3.5" /> Review</Button>}
              {canVerify && ['PROOF_UPLOADED', 'UNDER_VERIFICATION'].includes(tx.status) && <><Button size="sm" onClick={() => run(`verify-${tx.id}`, () => emgsPaymentAPI.verify(tx.id, {}), 'Payment verified and receipt created')}><CheckCircle2 className="h-3.5 w-3.5" /> Verify</Button><Button variant="destructive" size="sm" onClick={() => { const reason = prompt('Reason for rejection'); if (reason) run(`reject-${tx.id}`, () => emgsPaymentAPI.reject(tx.id, { reason, requestNewProof: true }), 'New proof requested'); }}><XCircle className="h-3.5 w-3.5" /> Reject</Button></>}
              {canVerify && tx.status === 'VERIFIED' && <Button variant="outline" size="sm" className="text-amber-600" onClick={() => { const reason = prompt('Reason for reversing this verified payment'); if (reason) run(`reverse-${tx.id}`, () => emgsPaymentAPI.reverse(tx.id, { reason }), 'Payment reversal recorded'); }}><XCircle className="h-3.5 w-3.5" /> Reverse</Button>}
            </div>
          </div>)}
        </div>}
        {data?.receipts?.length > 0 && <div className="flex flex-wrap gap-2">{data.receipts.map((receipt) => <span key={receipt.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600"><Receipt className="h-3.5 w-3.5" /> {receipt.receiptNo} · {money(receipt.amount, receipt.currency)}</span>)}</div>}
        {data?.invoices?.length > 0 && <div className="flex flex-wrap items-center gap-2">{data.invoices.map((invoice) => <div key={invoice.id} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><Receipt className="h-3.5 w-3.5 text-primary" /><b>{invoice.displayInvoiceNo || invoice.invoiceNo}</b><span className="text-muted-foreground">{label(invoice.status)}</span>{invoice.pdfUrl && <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" className="h-6 px-2"><Download className="h-3 w-3" />Folio</Button></a>}</div>)}</div>}
        {canVerify && paymentApplication.paymentVerifiedAt && !paymentApplication.invoiceIssuedAt && ['FULLY_PAID', 'OVERPAID'].includes(data?.ledger?.status) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"><div><p className="text-sm font-semibold text-emerald-600">Payment verified — ready for invoice</p><p className="text-xs text-muted-foreground">Issue the invoice here to start EMGS processing.</p></div><Button size="sm" disabled={action === 'invoice'} onClick={issueInvoice}>{action === 'invoice' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} Issue Invoice</Button></div>}
        {paymentApplication.invoiceIssuedAt && <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Invoice issued</div>}
      </CardContent>
    </Card></>
  );
}
