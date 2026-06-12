import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, Send, CheckCircle2, AlertTriangle, Loader2, RefreshCw, Save, XCircle,
} from 'lucide-react';
import { whatsappAPI } from '../../api/endpoints';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/toast';

const ROLE_LABELS = {
  TENANT_ADMIN: 'Tenant Admin',
  STAFF: 'Assigned Staff',
  AGENT: 'Assigned Agent',
  STUDENT: 'Student',
};

// Small premium toggle switch.
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Line({ title, desc, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

const STATUS_BADGE = {
  SENT: 'bg-emerald-500/15 text-emerald-600',
  FAILED: 'bg-red-500/15 text-red-600',
  SKIPPED: 'bg-muted text-muted-foreground',
  PENDING: 'bg-amber-500/15 text-amber-600',
};

export default function WhatsAppSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerReady, setProviderReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [recipients, setRecipients] = useState({});
  const [events, setEvents] = useState({});
  const [eventDefs, setEventDefs] = useState([]);
  const [roles, setRoles] = useState([]);

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);

  const on = (map, key) => map[key] !== false; // default ON

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await whatsappAPI.getSettings();
      const d = data.data;
      setEnabled(d.enabled);
      setProviderReady(d.providerReady);
      setEventDefs(d.events || []);
      setRoles(d.roles || []);
      setRecipients(d.config?.recipients || {});
      setEvents(d.config?.events || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load WhatsApp settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data } = await whatsappAPI.getLogs({ limit: 15 });
      setLogs(data.data || []);
    } catch {
      /* non-fatal */
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadLogs(); }, [load, loadLogs]);

  const save = async () => {
    setSaving(true);
    try {
      await whatsappAPI.updateSettings({ enabled, config: { recipients, events } });
      toast.success('WhatsApp settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim()) { toast.error('Enter a number to test'); return; }
    setTesting(true);
    try {
      await whatsappAPI.test(testTo.trim());
      toast.success('Test message sent (template: hello_world)');
      loadLogs();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Test failed');
      loadLogs();
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Master card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
            </span>
            WhatsApp Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Provider status */}
          <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${providerReady ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
            {providerReady
              ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              : <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />}
            <div>
              <p className="font-medium">{providerReady ? 'Meta WhatsApp Cloud API connected' : 'Server credentials not set'}</p>
              <p className="text-muted-foreground">
                {providerReady
                  ? 'Messages use approved template messages via the Meta Cloud API.'
                  : 'Ask your developer to set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN on the server.'}
              </p>
            </div>
          </div>

          {/* Master toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-semibold">Enable WhatsApp notifications</p>
              <p className="text-xs text-muted-foreground">Send template messages on key application events.</p>
            </div>
            <Toggle checked={enabled} onChange={setEnabled} />
          </div>

          {/* Recipients */}
          <div className={enabled ? '' : 'pointer-events-none opacity-50'}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Recipients</p>
            <div className="divide-y divide-border/60">
              {roles.map((r) => (
                <Line
                  key={r}
                  title={ROLE_LABELS[r] || r}
                  checked={on(recipients, r)}
                  onChange={(v) => setRecipients((p) => ({ ...p, [r]: v }))}
                />
              ))}
            </div>
          </div>

          {/* Events */}
          <div className={enabled ? '' : 'pointer-events-none opacity-50'}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Notify on events</p>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {eventDefs.map((e) => (
                <Line
                  key={e.key}
                  title={e.label}
                  checked={on(events, e.key)}
                  onChange={(v) => setEvents((p) => ({ ...p, [e.key]: v }))}
                />
              ))}
            </div>
          </div>

          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Test send */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Send a test message</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Sends the <span className="font-medium">hello_world</span> template to verify your setup.
          </p>
          <div className="flex gap-2">
            <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="e.g. +60 17 123 4567" className="max-w-xs" />
            <Button onClick={sendTest} disabled={testing || !providerReady} size="sm" variant="outline">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent notifications</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadLogs} disabled={logsLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No messages sent yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Recipient</th>
                    <th className="px-2 py-2 font-medium">Role</th>
                    <th className="px-2 py-2 font-medium">Template</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-2">
                        <p className="font-medium">{l.recipientName || '—'}</p>
                        <p className="text-muted-foreground">{l.recipientPhone}</p>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{ROLE_LABELS[l.recipientRole] || l.recipientRole || '—'}</td>
                      <td className="px-2 py-2 text-muted-foreground">{l.templateName}</td>
                      <td className="px-2 py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[l.messageStatus] || 'bg-muted text-muted-foreground'}`}>
                          {l.messageStatus === 'FAILED' ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                          {l.messageStatus}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
