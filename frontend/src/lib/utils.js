import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatDate = (date, fmt = 'MMM d, yyyy') => {
  if (!date) return '—';
  try {
    return format(typeof date === 'string' ? parseISO(date) : date, fmt);
  } catch {
    return '—';
  }
};

export const timeAgo = (date) => {
  if (!date) return '—';
  try {
    return formatDistanceToNow(typeof date === 'string' ? parseISO(date) : date, { addSuffix: true });
  } catch {
    return '—';
  }
};

export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount));
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
};

// Portal-wide unique student identity: "MRSM-{PASSPORT} {NAME}".
// Also the name of the student's Google Drive folder.
export const studentUniqueId = (student) => {
  if (!student) return '—';
  const passport = (student.passportNumber || 'NOPASS').trim().toUpperCase();
  const name = (student.fullName || 'STUDENT').trim().toUpperCase();
  return `MRSM-${passport} ${name}`;
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export const getStatusColor = (status) => {
  const map = {
    // New workflow statuses
    DRAFT: 'bg-gray-100 text-gray-700',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    ACCEPTED: 'bg-teal-100 text-teal-700',
    AWAITING_VERIFICATION: 'bg-yellow-100 text-yellow-700',
    SENT_TO_UNIVERSITY: 'bg-indigo-100 text-indigo-700',
    AWAITING_OFFER_LETTER: 'bg-orange-100 text-orange-700',
    OFFER_LETTER_ISSUED: 'bg-violet-100 text-violet-700',
    EMGS_PROCESSING: 'bg-cyan-100 text-cyan-700',
    COMPLETED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    // Legacy statuses
    LOE_PROCESSING: 'bg-yellow-100 text-yellow-700',
    LOE_APPROVED: 'bg-teal-100 text-teal-700',
    PAYMENT_PENDING: 'bg-orange-100 text-orange-700',
    EMGS_SUBMITTED: 'bg-indigo-100 text-indigo-700',
    EMGS_APPROVED: 'bg-violet-100 text-violet-700',
    EVAL_APPROVED: 'bg-cyan-100 text-cyan-700',
    VISA_APPROVED: 'bg-emerald-100 text-emerald-700',
    AIRPORT_CLEARANCE: 'bg-lime-100 text-lime-700',
    // Payment statuses
    PENDING: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
    OVERDUE: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-600',
    PARTIAL: 'bg-blue-100 text-blue-700',
    // Tenant statuses
    ACTIVE: 'bg-green-100 text-green-700',
    SUSPENDED: 'bg-red-100 text-red-700',
    // Document statuses
    UPLOADED: 'bg-blue-100 text-blue-700',
    VERIFIED: 'bg-green-100 text-green-700',
    EXPIRED: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

export const getPriorityColor = (priority) => {
  const map = {
    LOW: 'text-gray-500',
    MEDIUM: 'text-blue-600',
    HIGH: 'text-orange-600',
    URGENT: 'text-red-600',
  };
  return map[priority] || 'text-gray-500';
};

export const formatStatusLabel = (status) => {
  if (!status) return '—';
  return STATUS_LABEL_MAP[status] || status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
};

// Active workflow statuses (shown in dropdowns)
export const APPLICATION_STATUSES = [
  'SUBMITTED', 'ACCEPTED', 'AWAITING_VERIFICATION',
  'SENT_TO_UNIVERSITY', 'AWAITING_OFFER_LETTER', 'OFFER_LETTER_ISSUED',
  'EMGS_PROCESSING', 'COMPLETED', 'REJECTED',
];

// Status labels for display (overrides the generic split/capitalize)
const STATUS_LABEL_MAP = {
  SUBMITTED: 'Submitted',
  ACCEPTED: 'Accepted',
  AWAITING_VERIFICATION: 'Awaiting Verification',
  SENT_TO_UNIVERSITY: 'Sent to University',
  AWAITING_OFFER_LETTER: 'Awaiting Offer Letter',
  OFFER_LETTER_ISSUED: 'Offer Letter Issued',
  EMGS_PROCESSING: 'EMGS Processing',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  // Legacy
  DRAFT: 'Draft',
  LOE_PROCESSING: 'LOE Processing',
  LOE_APPROVED: 'LOE Approved',
  PAYMENT_PENDING: 'Payment Pending',
  EMGS_SUBMITTED: 'EMGS Submitted',
  EMGS_APPROVED: 'EMGS Approved',
  EVAL_APPROVED: 'Eval Approved',
  VISA_APPROVED: 'Visa Approved',
  AIRPORT_CLEARANCE: 'Airport Clearance',
};

// Pre-EMGS workflow stages for text timeline
export const WORKFLOW_STAGES = [
  { status: 'SUBMITTED', label: 'Application Submitted' },
  { status: 'ACCEPTED', label: 'Application Accepted' },
  { status: 'AWAITING_VERIFICATION', label: 'Awaiting Verification' },
  { status: 'SENT_TO_UNIVERSITY', label: 'Sent to University' },
  { status: 'AWAITING_OFFER_LETTER', label: 'Awaiting Offer Letter' },
  { status: 'OFFER_LETTER_ISSUED', label: 'Offer Letter Issued' },
];

// EMGS percentage stages (shown after invoice is issued)
export const EMGS_STAGES = [
  { pct: 0, label: 'Application Created' },
  { pct: 5, label: 'Pending Submission of Payment Proof' },
  { pct: 10, label: 'Documents in Process' },
  { pct: 15, label: 'Documents Processing in EMGS' },
  { pct: 32, label: 'Documents Processing in EMGS' },
  { pct: 35, label: 'EMGS Approved' },
  { pct: 70, label: 'eVAL Approved' },
  { pct: 80, label: 'Medical Passed' },
  { pct: 90, label: 'Endorsement in Progress' },
  { pct: 100, label: 'Application Successful' },
];

// ── Post-eVAL workflow (NOT percentage-based) ──
// A separate action/checklist section that unlocks once 70% eVAL Approved is
// reached. It does not change the EMGS percentage number.
export const POST_EVAL_UNLOCK_PCT = 70;

export const POST_EVAL_STAGES = [
  { value: 'AWAITING_EVISA', label: 'Awaiting for eVisa' },
  { value: 'EVISA_APPROVED', label: 'eVisa Approved' },
  { value: 'UNDER_ARRIVAL', label: 'Under Arrival' },
  { value: 'ARRIVAL_COMPLETED', label: 'Arrival Completed' },
];

// Order index helper — for "is this stage reached?" comparisons.
export const postEvalIndex = (status) =>
  POST_EVAL_STAGES.findIndex((s) => s.value === status);

export const DOCUMENT_TYPES = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'SSC_CERTIFICATE', label: 'SSC Certificate' },
  { value: 'HSC_CERTIFICATE', label: 'HSC Certificate' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'BACHELOR_DEGREE', label: "Bachelor's Degree" },
  { value: 'MASTERS_DEGREE', label: "Master's Degree" },
  { value: 'TRANSCRIPT', label: 'Transcript' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'IELTS_CERTIFICATE', label: 'IELTS Certificate' },
  { value: 'PTE_CERTIFICATE', label: 'PTE Certificate' },
  { value: 'MOI_CERTIFICATE', label: 'MOI Certificate' },
  { value: 'PHOTO', label: 'Photo' },
  { value: 'OFFER_LETTER', label: 'Offer Letter' },
  { value: 'EMGS_DOCUMENT', label: 'EMGS Document' },
  { value: 'EVAL_DOCUMENT', label: 'EVAL Document' },
  { value: 'VISA_DOCUMENT', label: 'Visa Document' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate' },
  { value: 'ADDITIONAL', label: 'Additional' },
  { value: 'PASSPORT_FULL_SCAN', label: 'Full Scanned Copy of Passport' },
  { value: 'ACADEMIC_DOCUMENTS', label: 'Academic Documents' },
  { value: 'ENGLISH_PROFICIENCY', label: 'English Proficiency Certificate' },
];
