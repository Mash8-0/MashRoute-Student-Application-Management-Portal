const fs = require('fs');
const path = require('path');
const { buildSubject, renderHtml, renderText } = require('../src/services/offerLetterIssuedEmail');

const fakeData = {
  recipientType: 'STUDENT', recipientName: 'Ahmad Rahman', recipientEmail: 'ahmad@example.com',
  studentId: 'MR-1001', studentName: 'Ahmad Rahman', studentGender: 'MALE', passportNumber: 'A12345678',
  programmeName: 'Bachelor of Computer Science (Hons)', campusName: 'Subang Jaya',
  senderName: 'Mash', senderDesignation: 'Tenant Administrator', tenantName: 'Visa Route BD',
  logoUrl: 'https://mashroute.com/email-assets/mashroute-logo.png',
  attachmentFileName: 'Offer-Letter-Ahmad-Rahman-A12345678.pdf', attachmentMimeType: 'application/pdf', attachmentSize: 248321,
};

const outputDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../tmp/email-preview');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'offer-letter-issued.html'), renderHtml(fakeData));
fs.writeFileSync(path.join(outputDir, 'offer-letter-issued.txt'), `Subject: ${buildSubject(fakeData)}\n\n${renderText(fakeData)}`);
console.log(path.join(outputDir, 'offer-letter-issued.html'));
