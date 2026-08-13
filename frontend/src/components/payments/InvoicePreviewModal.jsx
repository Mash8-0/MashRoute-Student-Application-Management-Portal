import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Plus, Receipt, Trash2, X } from 'lucide-react';
import { paymentAPI } from '../../api/endpoints';
import { Button } from '../ui/button';
import { toast } from '../ui/toast';
import { formatDate } from '../../lib/utils';

const inputClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function money(amount, currency = 'MYR') {
  const prefix = currency === 'MYR' || currency === 'RM' ? 'RM' : currency;
  return `${prefix} ${Number(amount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toDateInput(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function normalizeItems(items) {
  const rows = Array.isArray(items) && items.length ? items : [{ description: 'Payment Fee', quantity: 1, unitPrice: 0 }];
  return rows.map((item, index) => ({
    description: item.description || `Fee Item ${index + 1}`,
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || item.amount || 0),
  }));
}

export default function InvoicePreviewModal({ payment, onClose, onGenerated }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [form, setForm] = useState({
    referenceNo: '',
    dueDate: '',
    paymentDate: '',
    sstRate: '0',
    notes: '',
    footerNote: 'This is auto generated from the system || No signature Required\nAll copyright to MashRoute',
    items: [],
  });

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const res = payment.invoice?.id
          ? await paymentAPI.getInvoice(payment.invoice.id)
          : await paymentAPI.prepareInvoice(payment.id, {});
        const row = res.data.data;
        if (!alive) return;
        setInvoice(row);
        setForm({
          referenceNo: row.referenceNo || payment.transactionReference || '',
          dueDate: toDateInput(row.dueDate),
          paymentDate: toDateInput(row.paymentDate || payment.paymentDate),
          sstRate: row.sstRate != null ? String(Number(row.sstRate)) : '0',
          notes: row.notes || 'Please make payment before the due date and send payment proof through the MashRoute portal.',
          footerNote: row.footerNote || 'This is auto generated from the system || No signature Required\nAll copyright to MashRoute',
          items: normalizeItems(row.items),
        });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load invoice preview');
        onClose();
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [payment, onClose]);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    const sstRate = Number(form.sstRate || 0);
    const sstAmount = subtotal * sstRate / 100;
    return { subtotal, sstRate, sstAmount, grandTotal: subtotal + sstAmount };
  }, [form.items, form.sstRate]);
  const canEdit = invoice?.status === 'DRAFT';

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setItem = (index, key, value) => setForm((prev) => ({
    ...prev,
    items: prev.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
  }));
  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, unitPrice: 0 }] }));
  const removeItem = (index) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const handleGenerate = async () => {
    if (!invoice?.id || !canEdit) return;
    setSaving(true);
    try {
      await paymentAPI.updateInvoice(invoice.id, {
        referenceNo: form.referenceNo || undefined,
        dueDate: form.dueDate || null,
        paymentDate: form.paymentDate || null,
        sstRate: totals.sstRate,
        notes: form.notes || null,
        footerNote: form.footerNote || null,
        items: form.items.map((item, index) => ({
          description: item.description || `Fee Item ${index + 1}`,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0),
          sortOrder: index,
        })),
      });
      await paymentAPI.generateInvoice(invoice.id);
      toast.success('Final invoice generated');
      onGenerated?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setSaving(false);
    }
  };

  if (!payment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-base font-semibold">Invoice Preview</h2>
            <p className="text-xs text-muted-foreground">
              {canEdit ? 'Edit reference, notes, SST, and fee items before final generation.' : 'Preview the generated invoice before downloading.'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading invoice preview...
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[380px_1fr]">
            <div className="space-y-4 border-b border-border p-5 lg:border-b-0 lg:border-r">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium">Reference No.</label>
                  <input className={inputClass} value={form.referenceNo} onChange={(e) => setField('referenceNo', e.target.value)} disabled={!canEdit} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Payment Date</label>
                  <input type="date" className={inputClass} value={form.paymentDate} onChange={(e) => setField('paymentDate', e.target.value)} disabled={!canEdit} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Due Date</label>
                  <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => setField('dueDate', e.target.value)} disabled={!canEdit} />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium">SST %</label>
                  <input type="number" min="0" step="0.01" className={inputClass} value={form.sstRate} onChange={(e) => setField('sstRate', e.target.value)} disabled={!canEdit} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium">Invoice Items</label>
                  <Button variant="outline" size="sm" onClick={addItem} disabled={!canEdit} className="h-7 text-xs">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, index) => (
                    <div key={index} className="rounded-lg border border-border p-2">
                      <input className={inputClass} value={item.description} onChange={(e) => setItem(index, 'description', e.target.value)} placeholder="Description" disabled={!canEdit} />
                      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                        <input type="number" min="0" step="0.01" className={inputClass} value={item.quantity} onChange={(e) => setItem(index, 'quantity', e.target.value)} disabled={!canEdit} />
                        <input type="number" min="0" step="0.01" className={inputClass} value={item.unitPrice} onChange={(e) => setItem(index, 'unitPrice', e.target.value)} disabled={!canEdit} />
                        <Button variant="ghost" size="sm" onClick={() => removeItem(index)} disabled={!canEdit || form.items.length === 1} className="h-9 w-9 p-0 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Notes</label>
                <textarea className="h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.notes} onChange={(e) => setField('notes', e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Footer</label>
                <textarea className="h-16 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={form.footerNote} onChange={(e) => setField('footerNote', e.target.value)} disabled={!canEdit} />
              </div>
            </div>

            <div className="bg-slate-100 p-5">
              <div className="mx-auto max-w-[760px] bg-white p-8 shadow-sm">
                <div className="mb-8 flex items-start justify-between gap-8">
                  <h1 className="text-6xl font-black tracking-normal text-sky-500">INVOICE</h1>
                  <div className="text-right">
                    <h2 className="text-3xl font-black tracking-normal text-slate-900">{invoice?.tenantName || payment.tenant?.name || 'Tenant'}</h2>
                    <p className="mt-2 text-[13px] text-slate-700">MashRoute - Student Application Management Portal</p>
                    {invoice?.tenantAddress && <p className="mt-2 text-sm text-slate-700">{invoice.tenantAddress}</p>}
                    <p className="mt-3 text-[13px] text-slate-700">{[invoice?.tenantEmail, invoice?.tenantPhone].filter(Boolean).join(' || ')}</p>
                  </div>
                </div>

                <div className="mb-7 grid max-w-xl grid-cols-[140px_1fr] gap-y-2.5 text-[13px] text-slate-900">
                  <span>Invoice No</span><strong>: {invoice?.displayInvoiceNo || invoice?.invoiceNo || 'DRAFT'}</strong>
                  <span>Reference</span><strong>: {form.referenceNo || '-'}</strong>
                  <span>Payment Date</span><strong>: {form.paymentDate ? formatDate(form.paymentDate) : '-'}</strong>
                  <span>Issue Date</span><span>: {formatDate(invoice?.issueDate || new Date())}</span>
                  <span>Due Date:</span><strong className="text-violet-700">: {form.dueDate ? formatDate(form.dueDate) : '-'}</strong>
                </div>

                <div className="mb-6 rounded-lg border border-slate-200 bg-white px-5 py-4">
                  <div className="mb-5 flex items-center gap-4 text-xl font-black text-sky-600">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-500 ring-8 ring-sky-50">
                      <span className="h-4 w-4 rounded bg-white" />
                    </span>
                    <span>BILL TO</span>
                  </div>
                  <div className="grid grid-cols-1 gap-5 text-[12px] leading-none text-slate-900 md:grid-cols-[1fr_1fr]">
                    <div className="grid min-w-0 grid-cols-[86px_minmax(0,1fr)] gap-x-1 gap-y-2.5">
                      <span className="text-slate-700">Student Name</span><strong className="min-w-0 whitespace-nowrap">: {invoice?.studentName || payment.student?.fullName || '-'}</strong>
                      <span className="text-slate-700">Passport No</span><strong className="min-w-0 whitespace-nowrap">: {invoice?.passportNo || payment.student?.passportNumber || '-'}</strong>
                      <span className="text-slate-700">Email</span><strong className="min-w-0 whitespace-nowrap text-[11px]">: {invoice?.studentEmail || payment.student?.email || '-'}</strong>
                      <span className="text-slate-700">Phone</span><strong className="min-w-0 whitespace-nowrap">: {invoice?.studentPhone || payment.student?.phone || '-'}</strong>
                    </div>
                    <div className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] gap-x-1 gap-y-2.5 border-t border-slate-200 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                      <span className="text-slate-700">University</span><strong className="min-w-0 whitespace-nowrap text-[11px]">: {invoice?.universityName || payment.application?.university?.name || '-'}</strong>
                      <span className="text-slate-700">Programme</span><strong className="min-w-0 whitespace-nowrap text-[11px]">: {invoice?.programmeName || payment.application?.program || '-'}</strong>
                      <span className="text-slate-700">Intake</span><strong className="min-w-0 whitespace-nowrap">: {invoice?.intake || payment.application?.intake || '-'}</strong>
                    </div>
                  </div>
                </div>

                <div className="mb-14 overflow-hidden rounded-lg border border-slate-200">
                  <div className="grid grid-cols-[minmax(0,1.8fr)_110px_150px_150px] bg-gradient-to-r from-sky-500 via-blue-600 to-violet-700 text-sm font-black text-white">
                    <span className="px-5 py-3">Description</span>
                    <span className="border-l border-white/20 px-4 py-3 text-center">Qty</span>
                    <span className="border-l border-white/20 px-4 py-3 text-center">Unit Price</span>
                    <span className="border-l border-white/20 px-5 py-3 text-right">Amount</span>
                  </div>
                  {form.items.map((item, index) => {
                    const amount = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                    return (
                      <div key={index} className="grid min-h-[40px] grid-cols-[minmax(0,1.8fr)_110px_150px_150px] border-t border-slate-200 text-[12px] text-slate-900">
                        <span className="min-w-0 break-words px-5 py-3">{item.description || 'Fee Item'}</span>
                        <span className="border-l border-slate-200 px-4 py-3 text-center">{item.quantity || 1}</span>
                        <span className="border-l border-slate-200 px-4 py-3 text-center">{money(item.unitPrice, invoice?.currency)}</span>
                        <span className="border-l border-slate-200 px-5 py-3 text-right">{money(amount, invoice?.currency)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-[1fr_1.08fr] items-stretch gap-5">
                  <div className="relative min-h-[112px] rounded-lg border border-slate-200 bg-white p-5">
                    <div className="mb-2 flex items-center gap-3 font-black text-violet-700">
                      <span className="flex h-8 w-8 items-center justify-center rounded bg-violet-50 text-violet-700">
                        <Receipt className="h-5 w-5" />
                      </span>
                      NOTES
                    </div>
                    <p className="max-w-[92%] whitespace-pre-line text-sm leading-snug text-slate-700">{form.notes || '-'}</p>
                  </div>
                  <div className="min-h-[112px] rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-900">
                    <div className="flex justify-between"><span>Subtotal</span><span>{money(totals.subtotal, invoice?.currency)}</span></div>
                    <div className="mt-3 flex justify-between"><span>SST ({Number(totals.sstRate || 0).toFixed(2).replace(/\.00$/, '')}%)</span><span>{money(totals.sstAmount, invoice?.currency)}</span></div>
                    <div className="mt-4 border-t border-dashed border-slate-200 pt-4">
                      <div className="flex items-end justify-between font-black">
                        <span className="text-lg text-violet-700">GRAND TOTAL</span>
                        <span className="text-2xl text-sky-600">{money(totals.grandTotal, invoice?.currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-8 whitespace-pre-line text-center text-sm italic tracking-[0.2em] text-slate-900">{form.footerNote}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          {invoice?.pdfUrl && (
            <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant={canEdit ? 'outline' : 'default'}>
                <Download className="h-4 w-4" /> Download Invoice
              </Button>
            </a>
          )}
          {canEdit && (
            <Button onClick={handleGenerate} disabled={loading || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              Generate Invoice
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
