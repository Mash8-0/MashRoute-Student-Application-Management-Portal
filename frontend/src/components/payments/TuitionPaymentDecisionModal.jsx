import { CheckCircle2, Clock3, Wallet, X } from 'lucide-react';
import { Button } from '../ui/button';

export default function TuitionPaymentDecisionModal({ application, onClose, onOpenPayment }) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
    <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div><h2 className="font-semibold">eVisa Approved Successfully</h2><p className="text-xs text-muted-foreground">{application.student?.fullName} · {application.referenceNo}</p></div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-5 p-6">
        <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" /><p className="text-sm">The eVisa has been uploaded successfully. Would you like to open the Tuition Fees payment and generate the Tuition Fees Folio now?</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button className="h-auto py-4" onClick={onOpenPayment}><Wallet className="h-4 w-4" /> Open Tuition Fees Payment</Button>
          <Button variant="outline" className="h-auto py-4" onClick={onClose}><Clock3 className="h-4 w-4" /> Set Up Later</Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">Payment creation and folio generation are completed from the student profile Payment tab.</p>
      </div>
    </div>
  </div>;
}
