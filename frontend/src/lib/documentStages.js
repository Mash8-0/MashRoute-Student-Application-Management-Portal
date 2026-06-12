// Stage-based document system config for MashRoute.
// Pure JS config module — no JSX.

const PDF_IMG_ACCEPT = '.pdf,.jpg,.jpeg,.png';
const PDF_IMG_LABEL = 'PDF, JPG, PNG';

export const STAGES = [
  {
    key: 'application',
    label: 'Application Documents',
    icon: 'FileText',
    adminOnly: false,
    showWhen: () => true,
    docTypes: [
      {
        type: 'PHOTO',
        title: 'Passport Photo',
        description: 'Recent passport-style photo',
        accept: '.jpg,.jpeg,.png',
        acceptLabel: 'JPG, PNG',
        required: true,
      },
      {
        type: 'PASSPORT',
        title: 'Passport Information Page',
        description: 'Page with photo and personal details',
        accept: PDF_IMG_ACCEPT,
        acceptLabel: PDF_IMG_LABEL,
        required: true,
      },
      {
        type: 'PASSPORT_FULL_SCAN',
        title: 'Full Scanned Copy of Passport',
        description: 'All passport pages',
        accept: '.pdf',
        acceptLabel: 'PDF',
        required: true,
      },
      {
        type: 'ACADEMIC_DOCUMENTS',
        title: 'Academic Documents',
        description: 'Transcripts, certificates, diplomas',
        accept: PDF_IMG_ACCEPT,
        acceptLabel: PDF_IMG_LABEL,
        required: true,
      },
      {
        type: 'ENGLISH_PROFICIENCY',
        title: 'English Proficiency Certificate',
        description: 'IELTS, TOEFL, PTE, MOI (if available)',
        accept: PDF_IMG_ACCEPT,
        acceptLabel: PDF_IMG_LABEL,
        required: false,
      },
    ],
  },
  {
    key: 'loe',
    label: 'Offer Letter / LOE',
    icon: 'FileCheck',
    adminOnly: true,
    showWhen: (app) => app.status === 'OFFER_LETTER_ISSUED' || !!app.offerLetterUrl,
    docTypes: [
      {
        type: 'OFFER_LETTER',
        title: 'Offer Letter / LOE',
        description: 'Official offer letter',
        accept: PDF_IMG_ACCEPT,
        acceptLabel: PDF_IMG_LABEL,
        required: true,
      },
    ],
  },
  {
    key: 'payment',
    label: 'Payment',
    icon: 'CreditCard',
    adminOnly: false,
    showWhen: (app) => !!app.offerLetterUrl || app.status === 'OFFER_LETTER_ISSUED',
    docTypes: [
      {
        type: 'PAYMENT_PROOF',
        title: 'Payment Proof',
        description: 'Proof of initial payment',
        accept: PDF_IMG_ACCEPT,
        acceptLabel: PDF_IMG_LABEL,
        required: true,
      },
    ],
  },
  {
    key: 'emgs',
    label: 'EMGS',
    icon: 'ShieldCheck',
    adminOnly: true,
    showWhen: (app) => (app.emgsPercentage || 0) >= 35,
    docTypes: [
      {
        type: 'EMGS_DOCUMENT',
        title: 'EMGS Approval Letter',
        description: 'EMGS approval document',
        accept: PDF_IMG_ACCEPT,
        acceptLabel: PDF_IMG_LABEL,
        required: true,
      },
    ],
  },
  {
    key: 'eval',
    label: 'EVAL',
    icon: 'ClipboardCheck',
    adminOnly: true,
    showWhen: (app) => (app.emgsPercentage || 0) >= 70,
    docTypes: [
      {
        type: 'EVAL_DOCUMENT',
        title: 'EVAL',
        description: 'Evaluation approval document',
        accept: PDF_IMG_ACCEPT,
        acceptLabel: PDF_IMG_LABEL,
        required: true,
      },
    ],
  },
  {
    key: 'evisa',
    label: 'eVisa',
    icon: 'Plane',
    adminOnly: true,
    showWhen: (app) => (app.emgsPercentage || 0) >= 90,
    docTypes: [
      {
        type: 'VISA_DOCUMENT',
        title: 'eVisa',
        description: 'Electronic visa document',
        accept: PDF_IMG_ACCEPT,
        acceptLabel: PDF_IMG_LABEL,
        required: true,
      },
    ],
  },
  {
    key: 'arrival',
    label: 'Arrival',
    icon: 'PlaneLanding',
    adminOnly: false,
    showWhen: (app) => (app.emgsPercentage || 0) >= 90 || app.status === 'COMPLETED',
    docTypes: [
      {
        type: 'FLIGHT_TICKET',
        title: 'Flight Ticket',
        description: 'Flight ticket / boarding pass',
        accept: PDF_IMG_ACCEPT,
        acceptLabel: PDF_IMG_LABEL,
        required: true,
      },
    ],
  },
  {
    key: 'tuition',
    label: 'Tuition Payment',
    icon: 'Receipt',
    adminOnly: false,
    showWhen: (app) => !!app.arrivalDate || app.status === 'COMPLETED',
    docTypes: [
      {
        type: 'TUITION_PROOF',
        title: 'Proof of Tuition Fees Payment',
        description: 'Tuition fee payment proof',
        accept: PDF_IMG_ACCEPT,
        acceptLabel: PDF_IMG_LABEL,
        required: true,
      },
    ],
  },
];

// Map of document type -> title.
export const DOC_TITLE_BY_TYPE = STAGES.reduce((acc, stage) => {
  for (const doc of stage.docTypes) {
    acc[doc.type] = doc.title;
  }
  return acc;
}, {});

// Internal lookup: document type -> stage key.
const STAGE_KEY_BY_TYPE = STAGES.reduce((acc, stage) => {
  for (const doc of stage.docTypes) {
    acc[doc.type] = stage.key;
  }
  return acc;
}, {});

// Returns the stage key for a given document type, or undefined if unknown.
export function getStageForType(type) {
  return STAGE_KEY_BY_TYPE[type];
}
