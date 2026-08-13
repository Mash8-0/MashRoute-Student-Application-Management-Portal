import { useEffect, useState } from 'react';
import { CreditCard, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { emgsPaymentAPI, universityAPI } from '../../api/endpoints';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/toast';

const EMPTY = { accountType: 'TENANT_ACCOUNT', universityId: '', label: '', accountHolderName: '', bankName: '', accountNumber: '', currency: 'MYR', branchName: '', swiftBic: '', paymentInstructions: '', isDefault: true };

export default function PaymentAccountsSettings() {
  const [accounts, setAccounts] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [accountRes, universityRes] = await Promise.all([
        emgsPaymentAPI.listAccounts({ includeInactive: true }),
        universityAPI.list({ limit: 200 }),
      ]);
      setAccounts(accountRes.data.data || []);
      setUniversities(universityRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load payment accounts');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const create = async (e) => {
    e.preventDefault();
    if (!form.label.trim() || !form.accountHolderName.trim() || !form.bankName.trim() || !form.accountNumber.trim()) return toast.error('Label, account holder, bank, and account number are required');
    if (form.accountType === 'UNIVERSITY_ACCOUNT' && !form.universityId) return toast.error('Select a university');
    setSaving(true);
    try {
      await emgsPaymentAPI.createAccount({ ...form, universityId: form.accountType === 'UNIVERSITY_ACCOUNT' ? form.universityId : null });
      toast.success('Payment account created');
      setForm(EMPTY); setShowForm(false); await load();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not create payment account'); }
    finally { setSaving(false); }
  };

  const update = async (account, data) => {
    try { await emgsPaymentAPI.updateAccount(account.id, data); toast.success('Payment account updated'); await load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Could not update payment account'); }
  };

  const archive = async (account) => {
    if (!confirm(`Archive "${account.label}"?`)) return;
    try { await emgsPaymentAPI.archiveAccount(account.id); toast.success('Payment account archived'); await load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Could not archive payment account'); }
  };

  return <div className="space-y-4">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Payment Accounts</CardTitle><p className="mt-1 text-sm text-muted-foreground">Accounts students can pay into for EMGS fees.</p></div><Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4"/>Add Account</Button></CardHeader>
      <CardContent className="space-y-3">
        {loading ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin"/></div> : !accounts.length ? <div className="rounded-xl border border-dashed border-border p-6 text-center"><CreditCard className="mx-auto mb-2 h-7 w-7 text-muted-foreground"/><p className="font-medium">No payment accounts configured</p><p className="text-sm text-muted-foreground">Add an active MYR account before setting up EMGS payments.</p></div> : accounts.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
          <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{account.label}</p>{account.isDefault && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">DEFAULT</span>}<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${account.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{account.isActive ? 'ACTIVE' : 'INACTIVE'}</span></div><p className="text-sm text-muted-foreground">{account.bankName} · {account.maskedAccountNumber} · {account.currency}</p><p className="text-xs text-muted-foreground">{account.accountType.replace(/_/g, ' ')}</p></div>
          <div className="flex gap-2">{!account.isDefault && account.isActive && <Button size="sm" variant="outline" onClick={() => update(account, { isDefault: true })}>Make Default</Button>}<Button size="sm" variant="outline" onClick={() => update(account, { isActive: !account.isActive })}>{account.isActive ? 'Deactivate' : 'Activate'}</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => archive(account)}><Trash2 className="h-4 w-4"/></Button></div>
        </div>)}
      </CardContent>
    </Card>

    {showForm && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={create} className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-2xl border border-border bg-background p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Add Payment Account</h2><p className="text-sm text-muted-foreground">Account numbers are encrypted and masked after saving.</p></div><Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}><X className="h-4 w-4"/></Button></div><div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Account Type<select className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3" value={form.accountType} onChange={(e) => set('accountType', e.target.value)}><option value="TENANT_ACCOUNT">Tenant / Admin Account</option><option value="UNIVERSITY_ACCOUNT">University Account</option><option value="EMGS_ACCOUNT">EMGS Account</option><option value="OTHER_APPROVED_ACCOUNT">Other Approved Account</option></select></label>
      <label className="text-sm">Currency<select className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3" value={form.currency} onChange={(e) => set('currency', e.target.value)}><option>MYR</option><option>USD</option></select></label>
      {form.accountType === 'UNIVERSITY_ACCOUNT' && <label className="text-sm sm:col-span-2">University<select className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3" value={form.universityId} onChange={(e) => set('universityId', e.target.value)}><option value="">Select university</option>{universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
      <label className="text-sm">Account Label<Input className="mt-1" value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="Main MYR Account"/></label><label className="text-sm">Account Holder<Input className="mt-1" value={form.accountHolderName} onChange={(e) => set('accountHolderName', e.target.value)}/></label><label className="text-sm">Bank Name<Input className="mt-1" value={form.bankName} onChange={(e) => set('bankName', e.target.value)}/></label><label className="text-sm">Account Number<Input className="mt-1" value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)}/></label><label className="text-sm">Branch (optional)<Input className="mt-1" value={form.branchName} onChange={(e) => set('branchName', e.target.value)}/></label><label className="text-sm">SWIFT/BIC (optional)<Input className="mt-1" value={form.swiftBic} onChange={(e) => set('swiftBic', e.target.value)}/></label><label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)}/>Set as default for this account type and currency</label>
    </div><div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}Save Account</Button></div></form></div>}
  </div>;
}
