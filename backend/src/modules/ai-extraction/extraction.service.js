const Tesseract = require('tesseract.js');
const prisma = require('../../config/database');
const logger = require('../../config/logger');

// Modular AI provider interface
class AIProvider {
  async extract(imagePath) {
    throw new Error('extract() must be implemented by provider');
  }
}

class TesseractProvider extends AIProvider {
  async extract(imagePath) {
    const { data } = await Tesseract.recognize(imagePath, 'eng', {
      logger: () => {},
    });
    return { text: data.text, confidence: data.confidence };
  }
}

// Stub for future OpenAI integration
class OpenAIProvider extends AIProvider {
  async extract(imagePath) {
    throw new Error('OpenAI provider not yet configured');
  }
}

// Stub for future Claude integration
class ClaudeProvider extends AIProvider {
  async extract(imagePath) {
    throw new Error('Claude provider not yet configured');
  }
}

const PROVIDERS = {
  tesseract: new TesseractProvider(),
  openai: new OpenAIProvider(),
  claude: new ClaudeProvider(),
};

// Parser: Passport
const parsePassport = (text) => {
  const result = {};

  const nameMatch = text.match(/(?:surname|last name)[:\s]+([A-Z]+)/i);
  const givenMatch = text.match(/(?:given names?|first name)[:\s]+([A-Z ]+)/i);
  if (nameMatch) result.lastName = nameMatch[1].trim();
  if (givenMatch) result.firstName = givenMatch[1].trim();

  const passportMatch = text.match(/\b([A-Z]{1,2}\d{7,8})\b/);
  if (passportMatch) result.passportNumber = passportMatch[1];

  const dobMatch = text.match(/(?:date of birth|dob)[:\s]+(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i);
  if (dobMatch) result.dateOfBirth = dobMatch[1];

  const nationalityMatch = text.match(/(?:nationality|country)[:\s]+([A-Z]{3,30})/i);
  if (nationalityMatch) result.nationality = nationalityMatch[1];

  const expiryMatch = text.match(/(?:expiry|expiration|date of expiry)[:\s]+(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i);
  if (expiryMatch) result.expiryDate = expiryMatch[1];

  // MRZ line extraction (machine-readable zone)
  const mrzLines = text.match(/[A-Z0-9<]{30,44}/g);
  if (mrzLines && mrzLines.length >= 2) {
    result.mrzLine1 = mrzLines[0];
    result.mrzLine2 = mrzLines[1];
  }

  return result;
};

// Parser: Bank Statement
const parseBankStatement = (text) => {
  const result = {};

  const bankMatch = text.match(/(?:bank name|bank)[:\s]+([A-Za-z\s]+(?:Bank|BANK|Financial)?)/i);
  if (bankMatch) result.bankName = bankMatch[1].trim();

  const balanceMatch = text.match(/(?:balance|closing balance|available balance)[:\s:]+[\$£€]?\s*([\d,]+\.?\d{0,2})/i);
  if (balanceMatch) result.balance = balanceMatch[1].replace(/,/g, '');

  const dateMatch = text.match(/(?:statement date|as of|date)[:\s]+(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i);
  if (dateMatch) result.statementDate = dateMatch[1];

  return result;
};

// Parser: Academic Documents
const parseAcademic = (text) => {
  const result = {};

  const instMatch = text.match(/(?:university|college|institution|school)[:\s]+([A-Za-z\s,]+)/i);
  if (instMatch) result.institution = instMatch[1].trim().substring(0, 100);

  const gpaMatch = text.match(/(?:gpa|cgpa|grade point)[:\s:]+([0-9.]+)/i);
  if (gpaMatch) result.gpa = gpaMatch[1];

  const progMatch = text.match(/(?:program|course|degree|faculty)[:\s]+([A-Za-z\s]+)/i);
  if (progMatch) result.program = progMatch[1].trim().substring(0, 100);

  const yearMatch = text.match(/(?:year|batch|session)[:\s:]+(\d{4})/i);
  if (yearMatch) result.year = yearMatch[1];

  return result;
};

const PARSERS = {
  PASSPORT: parsePassport,
  BANK_STATEMENT: parseBankStatement,
  SSC_CERTIFICATE: parseAcademic,
  HSC_CERTIFICATE: parseAcademic,
  BACHELOR_DEGREE: parseAcademic,
  MASTERS_DEGREE: parseAcademic,
  TRANSCRIPT: parseAcademic,
  DIPLOMA: parseAcademic,
};

class ExtractionService {
  async extractDocument(documentId, tenantId, userId, providerName = 'tesseract') {
    const document = await prisma.document.findFirst({
      where: { id: documentId, tenantId, deletedAt: null },
    });
    if (!document) throw { statusCode: 404, message: 'Document not found' };

    const provider = PROVIDERS[providerName];
    if (!provider) throw { statusCode: 400, message: `Unknown provider: ${providerName}` };

    const log = await prisma.extractionLog.create({
      data: {
        documentId,
        userId,
        provider: providerName,
        status: 'processing',
      },
    });

    const startTime = Date.now();
    try {
      const { text, confidence } = await provider.extract(document.fileUrl);
      const parser = PARSERS[document.type];
      const extractedData = parser ? parser(text) : {};

      const processingMs = Date.now() - startTime;

      await prisma.extractionLog.update({
        where: { id: log.id },
        data: {
          status: 'completed',
          rawText: text,
          extractedData,
          confidence: confidence || null,
          processingMs,
        },
      });

      logger.info(`Extraction completed for ${documentId} in ${processingMs}ms`);
      return { extractedData, rawText: text, confidence, processingMs };
    } catch (err) {
      await prisma.extractionLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorMessage: err.message,
          processingMs: Date.now() - startTime,
        },
      });
      logger.error(`Extraction failed for ${documentId}:`, err);
      throw { statusCode: 500, message: `Extraction failed: ${err.message}` };
    }
  }

  async getExtractionLogs(documentId) {
    return prisma.extractionLog.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

module.exports = new ExtractionService();
