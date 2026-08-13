import {
  Wallet, Clock, Database, User, Gift, Landmark, BookOpen, CreditCard,
  CalendarCheck, Info, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { categoryLabel, formatCommission, releaseLabel } from '../../lib/agentCategories';

function Tile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-snug">{value}</p>
    </div>
  );
}

function Row({ icon: Icon, label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className={`text-right text-xs ${strong ? 'font-bold text-primary' : 'font-medium'}`}>{value || '—'}</span>
    </div>
  );
}

// Rich, admin-configured commission card. Reused by the application form and the
// standalone Commission lookup page.
export default function CommissionCard({ commission, policy, universityName, program, category }) {
  const eligible = commission && Number(commission.amount) > 0;
  const amountStr = eligible ? formatCommission(commission) : 'Not set';
  const stageLabel = releaseLabel(policy?.releaseTiming);
  const commissionType = policy?.commissionType || (eligible ? `Claimable / ${stageLabel}` : '—');
  const payoutTime = policy?.payoutTime || '—';
  const payoutMethod = policy?.payoutMethod || 'Bank Transfer';
  const specialBonus = policy?.specialBonus || 'If applicable';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-primary" /> Commission
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
          {/* Eligible badge + amount */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-3xl font-extrabold tracking-tight text-primary">{amountStr}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {category
                  ? `${categoryLabel(category)} · ${program?.trim() ? (commission?.course ? `${program} rate` : 'default rate') : 'default rate'}`
                  : 'Select an agent tier to see the rate'}
              </p>
            </div>
            <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${eligible ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {eligible ? 'Eligible' : 'Not set'}
            </span>
          </div>

          {/* 2×2 tiles */}
          <div className="grid grid-cols-2 gap-2.5">
            <Tile icon={Wallet} label="Commission Type" value={commissionType} />
            <Tile icon={Clock} label="Payout Time" value={payoutTime} />
            <Tile icon={User} label="Payable Commission" value={stageLabel} />
            <Tile icon={Gift} label="Special Bonus" value={specialBonus} />
          </div>

          {/* Details */}
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="mb-1 text-sm font-semibold">Commission Details</p>
            <Row icon={Landmark} label="University Name" value={universityName} />
            <Row icon={BookOpen} label="Program" value={program?.trim() || '—'} />
            <Row icon={Database} label="Commission" value={amountStr} strong />
            <Row icon={CreditCard} label="Payout Method" value={payoutMethod} />
            <Row icon={CalendarCheck} label="Payout Stage" value={stageLabel} />
          </div>

          {/* Notes / disclaimer */}
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-primary/80">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {policy?.notes || 'Final commission and special bonus may vary by intake and policy.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
