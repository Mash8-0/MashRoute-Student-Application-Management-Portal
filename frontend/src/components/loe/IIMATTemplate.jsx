import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  orange: '#E85D26',
  dark: '#1A1A1A',
  gray: '#555555',
  lightGray: '#F9F9F9',
  white: '#FFFFFF',
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.dark,
    paddingTop: 40,
    paddingBottom: 60,
    paddingLeft: 50,
    paddingRight: 50,
    size: 'A4',
  },

  // Header row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerDate: {
    fontSize: 9,
    color: C.gray,
  },
  headerLoeNumber: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  headerBrandIIMAT: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: C.orange,
  },
  headerBrandCollege: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: C.dark,
  },
  headerAddress: {
    fontSize: 8,
    color: C.gray,
    textAlign: 'right',
    marginTop: 2,
  },

  // Student info block
  studentBlock: {
    marginTop: 20,
  },
  studentName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  studentInfo: {
    fontSize: 9,
    color: C.gray,
    marginTop: 2,
  },

  // Greeting / subject
  greeting: {
    marginTop: 16,
    fontSize: 9,
  },
  subject: {
    marginTop: 8,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  introParagraph: {
    marginTop: 8,
    fontSize: 9,
    lineHeight: 1.5,
  },

  // Program info rows
  programRows: {
    marginTop: 12,
  },
  programRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  programLabel: {
    width: 140,
    fontSize: 9,
  },
  programColon: {
    fontSize: 9,
    marginRight: 4,
  },
  programValue: {
    fontSize: 9,
    flex: 1,
  },
  programValueOrange: {
    fontSize: 9,
    flex: 1,
    color: C.orange,
    fontFamily: 'Helvetica-Bold',
  },

  // Required docs header
  docsHeaderBar: {
    marginTop: 16,
    backgroundColor: C.orange,
    padding: 6,
  },
  docsHeaderText: {
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  docsIntro: {
    fontSize: 9,
    marginTop: 6,
    lineHeight: 1.5,
  },
  bulletItem: {
    fontSize: 9,
    marginTop: 3,
    lineHeight: 1.4,
  },
  closingNote: {
    marginTop: 12,
    fontSize: 9,
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 50,
    right: 50,
    borderTopWidth: 0.5,
    borderTopColor: C.gray,
    borderTopStyle: 'solid',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7,
    color: C.gray,
    textAlign: 'center',
    lineHeight: 1.5,
  },

  // Page 2 – Payment Breakdown
  p2Heading: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  p2SubHeading: {
    fontSize: 11,
    textAlign: 'center',
    color: C.gray,
    marginBottom: 12,
  },

  // Tuition table
  table: {
    marginTop: 12,
    borderWidth: 0.5,
    borderColor: C.gray,
    borderStyle: 'solid',
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: C.orange,
    padding: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: C.gray,
    borderTopStyle: 'solid',
    padding: 4,
  },
  tableRowTotal: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.dark,
    borderTopStyle: 'solid',
    padding: 4,
    backgroundColor: C.lightGray,
  },
  cellHeaderText: {
    color: C.white,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  cellText: {
    fontSize: 8,
  },
  cellTextBold: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  cellNo: { width: 24 },
  cellDesc: { flex: 1 },
  cellAmt: { width: 70, textAlign: 'right' },
  cellSchPct: { width: 60, textAlign: 'center' },
  cellSchAmt: { width: 70, textAlign: 'right' },

  // Initial fees
  initialFeesTitle: {
    marginTop: 16,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  sideNote: {
    fontSize: 8,
    color: C.gray,
    marginLeft: 12,
    marginTop: 4,
    lineHeight: 1.5,
  },

  // Bank details
  bankHeaderBar: {
    marginTop: 16,
    backgroundColor: C.orange,
    padding: 6,
  },
  bankHeaderText: {
    color: C.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
  },
  bankRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: C.gray,
    borderBottomStyle: 'solid',
  },
  bankLabel: {
    width: 120,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  bankColon: {
    fontSize: 9,
    marginRight: 4,
  },
  bankValue: {
    fontSize: 9,
    flex: 1,
  },

  // Closing
  offerNote: {
    marginTop: 16,
    fontSize: 9,
    color: C.orange,
    fontFamily: 'Helvetica-BoldOblique',
  },
  closingParagraph: {
    marginTop: 8,
    fontSize: 9,
    lineHeight: 1.5,
  },
  signatureBlock: {
    marginTop: 16,
    fontSize: 9,
    lineHeight: 1.8,
  },
  computerGenerated: {
    marginTop: 20,
    fontSize: 7,
    color: C.gray,
    textAlign: 'center',
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRM(amount) {
  return Number(amount).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Shared Footer Component ──────────────────────────────────────────────────
function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        International Institute of Management and Technology (IIMAT) || Wisma TLT, 51 &amp; 51A, Jln Sultan Azlan Shah, Titiwangsa Sentral, 51200 Kuala Lumpur
      </Text>
      <Text style={styles.footerText}>
        T : 03-4044 6005 || E: admission@iimat.edu.my
      </Text>
    </View>
  );
}

// ─── Page 1 ───────────────────────────────────────────────────────────────────
function Page1({ loe, application, student }) {
  const {
    loeNumber,
    generatedAt,
    scholarshipPct,
    facultyName,
    programDuration,
    englishRequirement,
    additionalNotes,
  } = loe;
  const { program, intake, intakeYear } = application;
  const { fullName, passportNumber, nationality } = student;

  const intakeDisplay = intake && intakeYear ? `${intake} ${intakeYear}` : (intake || intakeYear || '');

  const scholarshipDisplay = scholarshipPct
    ? `${scholarshipPct}% Tuition Scholarship`
    : (additionalNotes || '—');

  return (
    <Page size="A4" style={styles.page}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerDate}>{formatDate(generatedAt)}</Text>
          <Text style={styles.headerLoeNumber}>{loeNumber}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerBrandRow}>
            <Text style={styles.headerBrandIIMAT}>IIMAT</Text>
            <Text style={styles.headerBrandCollege}> College</Text>
          </View>
          <Text style={styles.headerAddress}>
            Wisma TLT, 51 &amp; 51A, Jln Sultan Azlan Shah,{'\n'}
            Titiwangsa Sentral, 51200 Kuala Lumpur
          </Text>
        </View>
      </View>

      {/* Student info block */}
      <View style={styles.studentBlock}>
        <Text style={styles.studentName}>{fullName}</Text>
        <Text style={styles.studentInfo}>{nationality}</Text>
        <Text style={styles.studentInfo}>Passport No.: {passportNumber}</Text>
      </View>

      {/* Greeting */}
      <Text style={styles.greeting}>Dear Mr/Ms,</Text>

      {/* Subject */}
      <Text style={styles.subject}>Re: Letter of Eligibility for Programme Application</Text>

      {/* Introduction */}
      <Text style={styles.introParagraph}>
        Thank you for your interest in pursuing your higher education with International Institute of
        Management and Technology (IIMAT). We are pleased to inform you that you are eligible to
        apply for your preferred programme as per the details below:
      </Text>

      {/* Program info rows */}
      <View style={styles.programRows}>
        <View style={styles.programRow}>
          <Text style={styles.programLabel}>Faculty</Text>
          <Text style={styles.programColon}> : </Text>
          <Text style={styles.programValue}>{facultyName || '—'}</Text>
        </View>
        <View style={styles.programRow}>
          <Text style={styles.programLabel}>Programme</Text>
          <Text style={styles.programColon}> : </Text>
          <Text style={styles.programValue}>{program || '—'}</Text>
        </View>
        <View style={styles.programRow}>
          <Text style={styles.programLabel}>Programme Duration</Text>
          <Text style={styles.programColon}> : </Text>
          <Text style={styles.programValue}>{programDuration || '—'}</Text>
        </View>
        <View style={styles.programRow}>
          <Text style={styles.programLabel}>Intake</Text>
          <Text style={styles.programColon}> : </Text>
          <Text style={styles.programValue}>{intakeDisplay || '—'}</Text>
        </View>
        <View style={styles.programRow}>
          <Text style={styles.programLabel}>English Proficiency</Text>
          <Text style={styles.programColon}> : </Text>
          <Text style={styles.programValue}>{englishRequirement || '—'}</Text>
        </View>
        <View style={styles.programRow}>
          <Text style={styles.programLabel}>Scholarship / Note</Text>
          <Text style={styles.programColon}> : </Text>
          <Text style={styles.programValueOrange}>{scholarshipDisplay}</Text>
        </View>
      </View>

      {/* Required Documents header */}
      <View style={styles.docsHeaderBar}>
        <Text style={styles.docsHeaderText}>Required Documents:</Text>
      </View>

      <Text style={styles.docsIntro}>
        To proceed with your application, please submit the following documents to our Admissions Office:
      </Text>

      <Text style={styles.bulletItem}>{'•  Completed Application Form'}</Text>
      <Text style={styles.bulletItem}>{'•  Copy of Passport (all pages, minimum 18 months validity)'}</Text>
      <Text style={styles.bulletItem}>{'•  Academic Transcripts &amp; Certificates (certified true copies)'}</Text>
      <Text style={styles.bulletItem}>{'•  English Proficiency Certificate (IELTS / TOEFL / equivalent)'}</Text>
      <Text style={styles.bulletItem}>{'•  Personal Statement / Statement of Purpose'}</Text>
      <Text style={styles.bulletItem}>{'•  Two (2) Letters of Recommendation'}</Text>
      <Text style={styles.bulletItem}>{'•  Passport-sized Photographs (2 copies, white background)'}</Text>
      <Text style={styles.bulletItem}>{'•  Proof of Financial Support / Sponsorship Letter'}</Text>

      <Text style={styles.closingNote}>
        Kindly ensure that all documents are submitted within the stipulated timeline to secure your
        placement. Incomplete applications will not be processed. Should you require any further
        assistance, please do not hesitate to contact our Admissions Office.
      </Text>

      <PageFooter />
    </Page>
  );
}

// ─── Page 2 ───────────────────────────────────────────────────────────────────
function Page2({ loe, application, student }) {
  const { scholarshipPct, tuitionPerYear, programDuration } = loe;
  const { program } = application;
  const { fullName } = student;

  const pct = Number(scholarshipPct) || 0;
  const tpy = Number(tuitionPerYear) || 0;
  const discountedPerYear = tpy * (1 - pct / 100);

  const years = 3; // fixed 3-year breakdown
  const totalFull = tpy * years;
  const totalDiscounted = discountedPerYear * years;

  // Initial fees
  const initialFees = [
    { desc: 'EMGS (Education Malaysia Global Services) Fee', amt: 2500 },
    { desc: "International Student Application Fee", amt: 200 },
    { desc: 'Processing Fee', amt: 500 },
    { desc: 'International Student Fee', amt: 2000 },
    { desc: 'Airport Clearance Fee', amt: 300 },
  ];
  const totalInitial = initialFees.reduce((s, r) => s + r.amt, 0);

  const bankDetails = [
    { label: 'Bank Name', value: 'CIMB BANK' },
    { label: 'Bank Address', value: 'Menara CIMB, Jalan Stesen Sentral 2, Kuala Lumpur Sentral, 50470 Kuala Lumpur' },
    { label: 'Swift Code', value: 'CIBBMYKL' },
    { label: 'Account Name', value: 'IIMAT SDN BHD' },
    { label: 'Account No.', value: '80 0126874 8' },
  ];

  return (
    <Page size="A4" style={styles.page}>
      {/* Heading */}
      <Text style={styles.p2Heading}>PAYMENT BREAKDOWN</Text>
      <Text style={styles.p2SubHeading}>{program || ''}</Text>

      {/* Tuition table */}
      <View style={styles.table}>
        {/* Header */}
        <View style={styles.tableRowHeader}>
          <Text style={[styles.cellHeaderText, styles.cellNo]}>No</Text>
          <Text style={[styles.cellHeaderText, styles.cellDesc]}>Description</Text>
          <Text style={[styles.cellHeaderText, styles.cellAmt]}>RM</Text>
          <Text style={[styles.cellHeaderText, styles.cellSchPct]}>Scholarship</Text>
          <Text style={[styles.cellHeaderText, styles.cellSchAmt]}>RM</Text>
        </View>
        {/* Year rows */}
        {[1, 2, 3].map((yr) => (
          <View key={yr} style={styles.tableRow}>
            <Text style={[styles.cellText, styles.cellNo]}>{yr}</Text>
            <Text style={[styles.cellText, styles.cellDesc]}>{`Year ${yr} Tuition Fee`}</Text>
            <Text style={[styles.cellText, styles.cellAmt]}>{formatRM(tpy)}</Text>
            <Text style={[styles.cellText, styles.cellSchPct]}>{`${pct}%`}</Text>
            <Text style={[styles.cellText, styles.cellSchAmt]}>{formatRM(discountedPerYear)}</Text>
          </View>
        ))}
        {/* Total */}
        <View style={styles.tableRowTotal}>
          <Text style={[styles.cellTextBold, styles.cellNo]}></Text>
          <Text style={[styles.cellTextBold, styles.cellDesc]}>Total</Text>
          <Text style={[styles.cellTextBold, styles.cellAmt]}>{formatRM(totalFull)}</Text>
          <Text style={[styles.cellTextBold, styles.cellSchPct]}></Text>
          <Text style={[styles.cellTextBold, styles.cellSchAmt]}>{formatRM(totalDiscounted)}</Text>
        </View>
      </View>

      {/* Initial fees */}
      <Text style={styles.initialFeesTitle}>INITIAL FEES (International Student) :</Text>
      <View style={[styles.table, { marginTop: 6 }]}>
        {/* Header */}
        <View style={styles.tableRowHeader}>
          <Text style={[styles.cellHeaderText, styles.cellNo]}>No</Text>
          <Text style={[styles.cellHeaderText, styles.cellDesc]}>Description</Text>
          <Text style={[styles.cellHeaderText, styles.cellAmt]}>RM</Text>
        </View>
        {initialFees.map((fee, idx) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.cellText, styles.cellNo]}>{idx + 1}</Text>
            <Text style={[styles.cellText, styles.cellDesc]}>{fee.desc}</Text>
            <Text style={[styles.cellText, styles.cellAmt]}>{formatRM(fee.amt)}</Text>
          </View>
        ))}
        {/* Total */}
        <View style={styles.tableRowTotal}>
          <Text style={[styles.cellTextBold, styles.cellNo]}></Text>
          <Text style={[styles.cellTextBold, styles.cellDesc]}>Total</Text>
          <Text style={[styles.cellTextBold, styles.cellAmt]}>{formatRM(totalInitial)}</Text>
        </View>
      </View>
      <Text style={styles.sideNote}>
        Visa Renewal Fee: RM 1,500 / Library &amp; Activity Fee: Waived / Other Applicable Fees: Waived
      </Text>

      {/* Bank details */}
      <View style={styles.bankHeaderBar}>
        <Text style={styles.bankHeaderText}>BANK ACCOUNT DETAILS</Text>
      </View>
      {bankDetails.map((row, idx) => (
        <View key={idx} style={styles.bankRow}>
          <Text style={styles.bankLabel}>{row.label}</Text>
          <Text style={styles.bankColon}> : </Text>
          <Text style={styles.bankValue}>{row.value}</Text>
        </View>
      ))}

      {/* Closing */}
      <Text style={styles.offerNote}>
        Note: This offer letter is valid for 14 days from the date of issuance.
      </Text>
      <Text style={styles.closingParagraph}>
        We look forward to welcoming you as a student at IIMAT College. Please do not hesitate to
        contact our Admissions Office should you have any queries regarding the above. We wish you
        every success in your academic journey.
      </Text>
      <View style={styles.signatureBlock}>
        <Text>Yours sincerely,</Text>
        <Text>{'\n\n'}</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold' }}>Admissions Office</Text>
        <Text>International Institute of Management and Technology (IIMAT)</Text>
        <Text>Email: admission@iimat.edu.my</Text>
      </View>
      <Text style={styles.computerGenerated}>
        This is a computer-generated Letter of Eligibility (LOE) and does not require signature unless stated.
      </Text>

      <PageFooter />
    </Page>
  );
}

// ─── Main Document Export ─────────────────────────────────────────────────────
function IIMATDocument({ loe, application, student }) {
  return (
    <Document>
      <Page1 loe={loe} application={application} student={student} />
      <Page2 loe={loe} application={application} student={student} />
    </Document>
  );
}

export default IIMATDocument;

// ─── Download Helper ──────────────────────────────────────────────────────────
export async function downloadIIMATLOE(loe, application, student) {
  const { pdf } = await import('@react-pdf/renderer');
  const blob = await pdf(
    <IIMATDocument loe={loe} application={application} student={student} />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `LOE_${(student.fullName || 'Student').replace(/\s+/g, '_')}_IIMAT.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
