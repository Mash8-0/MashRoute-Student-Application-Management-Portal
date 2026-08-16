/**
 * MashRoute Demo Server
 * Serves realistic mock data so the full portal can be previewed
 * without a database connection.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const SECRET = 'demo-secret-key';

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ─── Mock Data ───────────────────────────────────────────────
const USERS = {
  'admin@demo-agency.com': {
    id: 'u1', email: 'admin@demo-agency.com', firstName: 'Sarah', lastName: 'Mitchell',
    role: 'TENANT_ADMIN', tenantId: 't1', isActive: true, avatar: null,
    tenant: { id: 't1', name: 'Global Edu Consultancy', slug: 'global-edu', status: 'ACTIVE', plan: 'PROFESSIONAL', logo: null },
  },
  'superadmin@mashroute.com': {
    id: 'sa1', email: 'superadmin@mashroute.com', firstName: 'Super', lastName: 'Admin',
    role: 'SUPER_ADMIN', tenantId: null, isActive: true, avatar: null, tenant: null,
  },
  'staff@demo-agency.com': {
    id: 'u2', email: 'staff@demo-agency.com', firstName: 'James', lastName: 'Patel',
    role: 'STAFF', tenantId: 't1', isActive: true, avatar: null,
    tenant: { id: 't1', name: 'Global Edu Consultancy', slug: 'global-edu', status: 'ACTIVE', plan: 'PROFESSIONAL', logo: null },
  },
};

const PASSWORDS = {
  'admin@demo-agency.com': process.env.DEMO_ADMIN_PASSWORD,
  'superadmin@mashroute.com': process.env.DEMO_SUPER_ADMIN_PASSWORD,
  'staff@demo-agency.com': process.env.DEMO_STAFF_PASSWORD,
};

const ok = (res, data, message = 'Success') => res.json({ success: true, message, data });
const paginated = (res, data, total, page = 1, limit = 15) =>
  res.json({
    success: true, message: 'Success', data,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit), hasNextPage: page < Math.ceil(total / limit), hasPrevPage: page > 1 },
  });

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ─── Auth ─────────────────────────────────────────────────────
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = USERS[email];
  if (!user || PASSWORDS[email] !== password) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }, SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' });
  res.cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 7 * 86400000 });
  ok(res, { user, accessToken }, 'Login successful');
});

app.post('/api/v1/auth/refresh', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });
  try {
    const d = jwt.verify(token, SECRET);
    const user = Object.values(USERS).find((u) => u.id === d.id);
    const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }, SECRET, { expiresIn: '1h' });
    ok(res, { accessToken });
  } catch {
    res.status(401).json({ success: false, message: 'Expired' });
  }
});

app.post('/api/v1/auth/logout', auth, (req, res) => {
  res.clearCookie('refreshToken');
  ok(res, null, 'Logged out');
});

app.get('/api/v1/auth/me', auth, (req, res) => {
  ok(res, USERS[req.user.email]);
});

app.post('/api/v1/auth/forgot-password', (req, res) => ok(res, null, 'Reset link sent'));

// ─── Analytics - Tenant Dashboard ────────────────────────────
app.get('/api/v1/analytics/dashboard', auth, (req, res) => {
  ok(res, {
    overview: {
      totalStudents: 248, totalApplications: 412, totalRevenue: 186500,
      paidInvoices: 134, pending: 38, approved: 89, completed: 67, rejected: 12,
    },
    applicationsByStatus: [
      { status: 'SUBMITTED', _count: { status: 48 } },
      { status: 'LOE_PROCESSING', _count: { status: 32 } },
      { status: 'LOE_APPROVED', _count: { status: 27 } },
      { status: 'PAYMENT_PENDING', _count: { status: 19 } },
      { status: 'EMGS_SUBMITTED', _count: { status: 44 } },
      { status: 'VISA_APPROVED', _count: { status: 89 } },
      { status: 'COMPLETED', _count: { status: 67 } },
      { status: 'REJECTED', _count: { status: 12 } },
    ],
    recentApplications: [
      { id: 'a1', referenceNo: 'SL-M8K2-XPQA', status: 'VISA_APPROVED', createdAt: new Date(Date.now() - 3600000).toISOString(), student: { fullName: 'Arjun Sharma' }, university: { name: 'University of Malaya' } },
      { id: 'a2', referenceNo: 'SL-N9J1-LMRB', status: 'EMGS_SUBMITTED', createdAt: new Date(Date.now() - 86400000).toISOString(), student: { fullName: 'Fatima Al-Hassan' }, university: { name: "Monash University Malaysia" } },
      { id: 'a3', referenceNo: 'SL-P3Q7-DVCK', status: 'LOE_APPROVED', createdAt: new Date(Date.now() - 172800000).toISOString(), student: { fullName: 'Wei Chen' }, university: { name: "Taylor's University" } },
      { id: 'a4', referenceNo: 'SL-R6T8-FJNM', status: 'PAYMENT_PENDING', createdAt: new Date(Date.now() - 259200000).toISOString(), student: { fullName: 'Priya Nair' }, university: { name: 'INTI International University' } },
      { id: 'a5', referenceNo: 'SL-S2W4-KQYZ', status: 'SUBMITTED', createdAt: new Date(Date.now() - 345600000).toISOString(), student: { fullName: 'Mohammed Al-Rashid' }, university: { name: 'University of Melbourne' } },
    ],
    agentPerformance: [
      { id: 'u2', firstName: 'James', lastName: 'Patel', _count: { assignedApplications: 87 } },
      { id: 'u3', firstName: 'Emily', lastName: 'Wong', _count: { assignedApplications: 63 } },
      { id: 'u4', firstName: 'Carlos', lastName: 'Rivera', _count: { assignedApplications: 51 } },
      { id: 'u5', firstName: 'Aisha', lastName: 'Okonkwo', _count: { assignedApplications: 42 } },
    ],
    monthlyApplications: [
      { month: 'Dec 2024', count: '34' }, { month: 'Jan 2025', count: '48' },
      { month: 'Feb 2025', count: '52' }, { month: 'Mar 2025', count: '71' },
      { month: 'Apr 2025', count: '65' }, { month: 'May 2025', count: '89' },
    ],
  });
});

// ─── Analytics - Global (Super Admin) ────────────────────────
app.get('/api/v1/analytics/global', auth, (req, res) => {
  ok(res, {
    overview: { totalTenants: 47, activeTenants: 41, totalUsers: 318, totalStudents: 8942, totalApplications: 14703 },
    byPlan: [
      { plan: 'STARTER', _count: { plan: 18 } },
      { plan: 'PROFESSIONAL', _count: { plan: 21 } },
      { plan: 'ENTERPRISE', _count: { plan: 8 } },
    ],
    recentTenants: [
      { id: 't1', name: 'Global Edu Consultancy', status: 'ACTIVE', plan: 'PROFESSIONAL', createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 't2', name: 'Apex Visa Services', status: 'ACTIVE', plan: 'ENTERPRISE', createdAt: new Date(Date.now() - 259200000).toISOString() },
      { id: 't3', name: 'StudyPath International', status: 'ACTIVE', plan: 'STARTER', createdAt: new Date(Date.now() - 432000000).toISOString() },
      { id: 't4', name: 'EduBridge Consultants', status: 'SUSPENDED', plan: 'PROFESSIONAL', createdAt: new Date(Date.now() - 604800000).toISOString() },
      { id: 't5', name: 'Scholars Gate Agency', status: 'ACTIVE', plan: 'PROFESSIONAL', createdAt: new Date(Date.now() - 864000000).toISOString() },
    ],
  });
});

// ─── Notifications ───────────────────────────────────────────
app.get('/api/v1/analytics/notifications', auth, (req, res) => {
  ok(res, [
    { id: 'n1', type: 'STATUS_CHANGED', title: 'Visa Approved', message: 'Arjun Sharma\'s visa has been approved', isRead: false, createdAt: new Date(Date.now() - 1800000).toISOString() },
    { id: 'n2', type: 'PAYMENT_PENDING', title: 'Payment Due', message: 'Invoice INV-GEC-202505-XK9P is overdue', isRead: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: 'n3', type: 'DOCUMENT_MISSING', title: 'Document Required', message: 'Fatima Al-Hassan is missing bank statement', isRead: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
  ]);
});
app.patch('/api/v1/analytics/notifications/:id/read', auth, (req, res) => ok(res, null, 'Marked read'));
app.patch('/api/v1/analytics/notifications/read-all', auth, (req, res) => ok(res, null, 'All read'));

// ─── Students ─────────────────────────────────────────────────
const STUDENTS = [
  { id: 's1', fullName: 'Arjun Sharma', passportNumber: 'M9823411', nationality: 'Indian', email: 'arjun@email.com', phone: '+91 9876543210', hasIELTS: true, ieltsScore: 7.0, gender: 'MALE', dateOfBirth: '1999-03-15', createdAt: new Date(Date.now() - 864000000).toISOString(), _count: { applications: 2, documents: 8 } },
  { id: 's2', fullName: 'Fatima Al-Hassan', passportNumber: 'K4519027', nationality: 'Saudi Arabian', email: 'fatima@email.com', phone: '+966 551234567', hasIELTS: true, ieltsScore: 6.5, gender: 'FEMALE', dateOfBirth: '2000-07-22', createdAt: new Date(Date.now() - 720000000).toISOString(), _count: { applications: 1, documents: 5 } },
  { id: 's3', fullName: 'Wei Chen', passportNumber: 'G7734892', nationality: 'Chinese', email: 'wei@email.com', phone: '+86 13812345678', hasIELTS: false, ieltsScore: null, gender: 'MALE', dateOfBirth: '1998-11-08', createdAt: new Date(Date.now() - 600000000).toISOString(), _count: { applications: 3, documents: 12 } },
  { id: 's4', fullName: 'Priya Nair', passportNumber: 'P2287643', nationality: 'Indian', email: 'priya@email.com', phone: '+91 9012345678', hasIELTS: true, ieltsScore: 7.5, gender: 'FEMALE', dateOfBirth: '2001-01-30', createdAt: new Date(Date.now() - 480000000).toISOString(), _count: { applications: 1, documents: 6 } },
  { id: 's5', fullName: 'Mohammed Al-Rashid', passportNumber: 'H6637281', nationality: 'Bangladeshi', email: 'moh@email.com', phone: '+880 1812345678', hasIELTS: true, ieltsScore: 6.0, gender: 'MALE', dateOfBirth: '1997-06-14', createdAt: new Date(Date.now() - 360000000).toISOString(), _count: { applications: 1, documents: 4 } },
  { id: 's6', fullName: 'Amara Diallo', passportNumber: 'F1193847', nationality: 'Nigerian', email: 'amara@email.com', phone: '+234 8012345678', hasIELTS: false, ieltsScore: null, gender: 'FEMALE', dateOfBirth: '2000-09-05', createdAt: new Date(Date.now() - 240000000).toISOString(), _count: { applications: 1, documents: 3 } },
  { id: 's7', fullName: 'Reza Tehrani', passportNumber: 'J3348291', nationality: 'Iranian', email: 'reza@email.com', phone: '+98 9123456789', hasIELTS: true, ieltsScore: 6.5, gender: 'MALE', dateOfBirth: '1999-12-18', createdAt: new Date(Date.now() - 120000000).toISOString(), _count: { applications: 2, documents: 7 } },
  { id: 's8', fullName: 'Sofia Petrov', passportNumber: 'R8812930', nationality: 'Russian', email: 'sofia@email.com', phone: '+7 9012345678', hasIELTS: true, ieltsScore: 7.0, gender: 'FEMALE', dateOfBirth: '2001-04-25', createdAt: new Date(Date.now() - 60000000).toISOString(), _count: { applications: 1, documents: 5 } },
];

app.get('/api/v1/students', auth, (req, res) => {
  const { search = '', page = 1, limit = 15 } = req.query;
  const filtered = STUDENTS.filter((s) =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) ||
    s.passportNumber.includes(search)
  );
  paginated(res, filtered, filtered.length, parseInt(page), parseInt(limit));
});

app.get('/api/v1/students/:id', auth, (req, res) => {
  const s = STUDENTS.find((s) => s.id === req.params.id) || STUDENTS[0];
  ok(res, { ...s, applications: [], documents: [] });
});

app.post('/api/v1/students', auth, (req, res) => {
  const student = { id: `s${Date.now()}`, ...req.body, createdAt: new Date().toISOString(), _count: { applications: 0, documents: 0 } };
  STUDENTS.unshift(student);
  res.status(201).json({ success: true, message: 'Student created', data: student });
});

app.patch('/api/v1/students/:id', auth, (req, res) => ok(res, { id: req.params.id, ...req.body }, 'Student updated'));

// ─── Applications ─────────────────────────────────────────────
const APPLICATIONS = [
  { id: 'a1', referenceNo: 'SL-M8K2-XPQA', status: 'VISA_APPROVED', priority: 'HIGH', program: 'Computer Science', intake: 'September', intakeYear: 2025, country: 'Malaysia', progressPct: 85, createdAt: new Date(Date.now() - 2592000000).toISOString(), student: { id: 's1', fullName: 'Arjun Sharma', passportNumber: 'M9823411', nationality: 'Indian', photo: null }, university: { id: 'uni1', name: 'University of Malaya', country: 'Malaysia' }, agent: { id: 'u2', firstName: 'James', lastName: 'Patel', avatar: null }, _count: { documents: 8, notes: 3 } },
  { id: 'a2', referenceNo: 'SL-N9J1-LMRB', status: 'EMGS_SUBMITTED', priority: 'HIGH', program: 'Business Administration', intake: 'January', intakeYear: 2026, country: 'Malaysia', progressPct: 50, createdAt: new Date(Date.now() - 1728000000).toISOString(), student: { id: 's2', fullName: 'Fatima Al-Hassan', passportNumber: 'K4519027', nationality: 'Saudi Arabian', photo: null }, university: { id: 'uni2', name: 'Monash University Malaysia', country: 'Malaysia' }, agent: { id: 'u3', firstName: 'Emily', lastName: 'Wong', avatar: null }, _count: { documents: 5, notes: 2 } },
  { id: 'a3', referenceNo: 'SL-P3Q7-DVCK', status: 'LOE_APPROVED', priority: 'MEDIUM', program: 'Engineering', intake: 'September', intakeYear: 2025, country: 'Malaysia', progressPct: 30, createdAt: new Date(Date.now() - 1296000000).toISOString(), student: { id: 's3', fullName: 'Wei Chen', passportNumber: 'G7734892', nationality: 'Chinese', photo: null }, university: { id: 'uni3', name: "Taylor's University", country: 'Malaysia' }, agent: { id: 'u2', firstName: 'James', lastName: 'Patel', avatar: null }, _count: { documents: 12, notes: 5 } },
  { id: 'a4', referenceNo: 'SL-R6T8-FJNM', status: 'PAYMENT_PENDING', priority: 'URGENT', program: 'Medicine', intake: 'March', intakeYear: 2026, country: 'Malaysia', progressPct: 40, createdAt: new Date(Date.now() - 864000000).toISOString(), student: { id: 's4', fullName: 'Priya Nair', passportNumber: 'P2287643', nationality: 'Indian', photo: null }, university: { id: 'uni4', name: 'INTI International University', country: 'Malaysia' }, agent: { id: 'u4', firstName: 'Carlos', lastName: 'Rivera', avatar: null }, _count: { documents: 6, notes: 1 } },
  { id: 'a5', referenceNo: 'SL-S2W4-KQYZ', status: 'SUBMITTED', priority: 'MEDIUM', program: 'Law', intake: 'September', intakeYear: 2025, country: 'Australia', progressPct: 10, createdAt: new Date(Date.now() - 432000000).toISOString(), student: { id: 's5', fullName: 'Mohammed Al-Rashid', passportNumber: 'H6637281', nationality: 'Bangladeshi', photo: null }, university: { id: 'uni5', name: 'University of Melbourne', country: 'Australia' }, agent: { id: 'u5', firstName: 'Aisha', lastName: 'Okonkwo', avatar: null }, _count: { documents: 4, notes: 0 } },
  { id: 'a6', referenceNo: 'SL-T1V9-HNPQ', status: 'COMPLETED', priority: 'LOW', program: 'Accounting', intake: 'January', intakeYear: 2025, country: 'UK', progressPct: 100, createdAt: new Date(Date.now() - 7776000000).toISOString(), student: { id: 's6', fullName: 'Amara Diallo', passportNumber: 'F1193847', nationality: 'Nigerian', photo: null }, university: { id: 'uni7', name: 'University of London', country: 'UK' }, agent: { id: 'u2', firstName: 'James', lastName: 'Patel', avatar: null }, _count: { documents: 9, notes: 4 } },
  { id: 'a7', referenceNo: 'SL-U5X3-BWGT', status: 'REJECTED', priority: 'HIGH', program: 'Pharmacy', intake: 'September', intakeYear: 2024, country: 'Malaysia', progressPct: 0, createdAt: new Date(Date.now() - 5184000000).toISOString(), student: { id: 's7', fullName: 'Reza Tehrani', passportNumber: 'J3348291', nationality: 'Iranian', photo: null }, university: { id: 'uni3', name: "Taylor's University", country: 'Malaysia' }, agent: { id: 'u3', firstName: 'Emily', lastName: 'Wong', avatar: null }, _count: { documents: 7, notes: 6 } },
  { id: 'a8', referenceNo: 'SL-V7Y6-CLMF', status: 'DRAFT', priority: 'MEDIUM', program: 'Psychology', intake: 'January', intakeYear: 2026, country: 'Canada', progressPct: 0, createdAt: new Date(Date.now() - 86400000).toISOString(), student: { id: 's8', fullName: 'Sofia Petrov', passportNumber: 'R8812930', nationality: 'Russian', photo: null }, university: { id: 'uni6', name: 'University of Toronto', country: 'Canada' }, agent: null, _count: { documents: 2, notes: 0 } },
];

app.get('/api/v1/applications', auth, (req, res) => {
  const { search = '', status, page = 1, limit = 15 } = req.query;
  let filtered = APPLICATIONS;
  if (status) filtered = filtered.filter((a) => a.status === status);
  if (search) filtered = filtered.filter((a) =>
    a.student.fullName.toLowerCase().includes(search.toLowerCase()) ||
    a.referenceNo.includes(search)
  );
  paginated(res, filtered, filtered.length, parseInt(page), parseInt(limit));
});

app.get('/api/v1/applications/:id', auth, (req, res) => {
  const app2 = APPLICATIONS.find((a) => a.id === req.params.id) || APPLICATIONS[0];
  ok(res, {
    ...app2,
    student: STUDENTS.find((s) => s.id === app2.student.id) || app2.student,
    notes: [
      { id: 'note1', content: 'Student has submitted all required academic documents. Waiting for bank statement.', isPrivate: false, createdAt: new Date(Date.now() - 86400000).toISOString(), author: { firstName: 'James', lastName: 'Patel', avatar: null } },
      { id: 'note2', content: 'EMGS application reference number received: EMGS-2025-88234.', isPrivate: false, createdAt: new Date(Date.now() - 172800000).toISOString(), author: { firstName: 'Sarah', lastName: 'Mitchell', avatar: null } },
    ],
    statusHistory: [
      { id: 'h1', fromStatus: 'EMGS_APPROVED', toStatus: app2.status, notes: 'All checks passed', createdAt: new Date(Date.now() - 86400000).toISOString(), changedBy: { firstName: 'Sarah', lastName: 'Mitchell' } },
      { id: 'h2', fromStatus: 'PAYMENT_PENDING', toStatus: 'EMGS_APPROVED', notes: null, createdAt: new Date(Date.now() - 604800000).toISOString(), changedBy: { firstName: 'James', lastName: 'Patel' } },
      { id: 'h3', fromStatus: null, toStatus: 'DRAFT', notes: 'Application created', createdAt: new Date(Date.now() - 2592000000).toISOString(), changedBy: { firstName: 'James', lastName: 'Patel' } },
    ],
    documents: [],
    payments: [],
  });
});

app.post('/api/v1/applications', auth, (req, res) => {
  const newApp = { id: `a${Date.now()}`, referenceNo: `SL-${Math.random().toString(36).substr(2,4).toUpperCase()}-${Math.random().toString(36).substr(2,4).toUpperCase()}`, status: 'DRAFT', progressPct: 0, createdAt: new Date().toISOString(), ...req.body };
  APPLICATIONS.unshift(newApp);
  res.status(201).json({ success: true, message: 'Application created', data: newApp });
});

app.patch('/api/v1/applications/:id', auth, (req, res) => ok(res, { id: req.params.id, ...req.body }, 'Updated'));
app.patch('/api/v1/applications/:id/status', auth, (req, res) => {
  const a = APPLICATIONS.find((a) => a.id === req.params.id);
  if (a) a.status = req.body.status;
  ok(res, a || { id: req.params.id, status: req.body.status }, 'Status updated');
});
app.delete('/api/v1/applications/:id', auth, (req, res) => ok(res, null, 'Deleted'));
app.get('/api/v1/applications/:id/notes', auth, (req, res) => ok(res, []));
app.post('/api/v1/applications/:id/notes', auth, (req, res) => res.status(201).json({ success: true, data: { id: `n${Date.now()}`, ...req.body, createdAt: new Date().toISOString(), author: { firstName: 'Sarah', lastName: 'Mitchell' } } }));
app.get('/api/v1/applications/:id/history', auth, (req, res) => ok(res, []));

// ─── Payments ─────────────────────────────────────────────────
const PAYMENTS = [
  { id: 'p1', invoiceNo: 'INV-GEC-202505-AXKP', amount: 4500, currency: 'USD', status: 'PAID', dueDate: new Date(Date.now() - 864000000).toISOString(), paidAt: new Date(Date.now() - 432000000).toISOString(), student: { fullName: 'Arjun Sharma' }, application: { referenceNo: 'SL-M8K2-XPQA' } },
  { id: 'p2', invoiceNo: 'INV-GEC-202505-BMNQ', amount: 3800, currency: 'USD', status: 'PENDING', dueDate: new Date(Date.now() + 604800000).toISOString(), paidAt: null, student: { fullName: 'Fatima Al-Hassan' }, application: { referenceNo: 'SL-N9J1-LMRB' } },
  { id: 'p3', invoiceNo: 'INV-GEC-202504-CRJW', amount: 6200, currency: 'USD', status: 'PAID', dueDate: new Date(Date.now() - 2592000000).toISOString(), paidAt: new Date(Date.now() - 1728000000).toISOString(), student: { fullName: 'Wei Chen' }, application: { referenceNo: 'SL-P3Q7-DVCK' } },
  { id: 'p4', invoiceNo: 'INV-GEC-202505-DSTX', amount: 8500, currency: 'USD', status: 'OVERDUE', dueDate: new Date(Date.now() - 259200000).toISOString(), paidAt: null, student: { fullName: 'Priya Nair' }, application: { referenceNo: 'SL-R6T8-FJNM' } },
  { id: 'p5', invoiceNo: 'INV-GEC-202503-EVYK', amount: 2900, currency: 'USD', status: 'PAID', dueDate: new Date(Date.now() - 5184000000).toISOString(), paidAt: new Date(Date.now() - 4320000000).toISOString(), student: { fullName: 'Amara Diallo' }, application: { referenceNo: 'SL-T1V9-HNPQ' } },
  { id: 'p6', invoiceNo: 'INV-GEC-202505-FZLM', amount: 1200, currency: 'USD', status: 'PENDING', dueDate: new Date(Date.now() + 1209600000).toISOString(), paidAt: null, student: { fullName: 'Sofia Petrov' }, application: null },
];

app.get('/api/v1/payments/stats', auth, (req, res) => ok(res, { total: 6, paid: 3, pending: 2, overdue: 1, totalRevenue: 13600 }));
app.get('/api/v1/payments', auth, (req, res) => {
  const { status, page = 1, limit = 15 } = req.query;
  const filtered = status ? PAYMENTS.filter((p) => p.status === status) : PAYMENTS;
  paginated(res, filtered, filtered.length, parseInt(page), parseInt(limit));
});
app.post('/api/v1/payments', auth, (req, res) => res.status(201).json({ success: true, data: { id: `p${Date.now()}`, invoiceNo: `INV-DEMO-${Date.now()}`, ...req.body } }));
app.get('/api/v1/payments/:id', auth, (req, res) => ok(res, PAYMENTS.find((p) => p.id === req.params.id) || PAYMENTS[0]));
app.patch('/api/v1/payments/:id', auth, (req, res) => ok(res, { id: req.params.id, ...req.body }));
app.post('/api/v1/payments/:id/mark-paid', auth, (req, res) => {
  const p = PAYMENTS.find((p) => p.id === req.params.id);
  if (p) { p.status = 'PAID'; p.paidAt = new Date().toISOString(); }
  ok(res, p, 'Payment marked as paid');
});
app.delete('/api/v1/payments/:id', auth, (req, res) => ok(res, null, 'Deleted'));

// ─── Universities ─────────────────────────────────────────────
const UNIVERSITIES = [
  { id: 'uni1', name: 'University of Malaya', country: 'Malaysia', city: 'Kuala Lumpur' },
  { id: 'uni2', name: 'Monash University Malaysia', country: 'Malaysia', city: 'Subang Jaya' },
  { id: 'uni3', name: "Taylor's University", country: 'Malaysia', city: 'Subang Jaya' },
  { id: 'uni4', name: 'INTI International University', country: 'Malaysia', city: 'Nilai' },
  { id: 'uni5', name: 'University of Melbourne', country: 'Australia', city: 'Melbourne' },
  { id: 'uni6', name: 'University of Toronto', country: 'Canada', city: 'Toronto' },
  { id: 'uni7', name: 'University of London', country: 'UK', city: 'London' },
];
app.get('/api/v1/universities', auth, (req, res) => ok(res, UNIVERSITIES));
app.post('/api/v1/universities', auth, (req, res) => res.status(201).json({ success: true, data: { id: `uni${Date.now()}`, ...req.body } }));
app.patch('/api/v1/universities/:id', auth, (req, res) => ok(res, { id: req.params.id, ...req.body }));
app.delete('/api/v1/universities/:id', auth, (req, res) => ok(res, null, 'Deleted'));

// ─── Users ────────────────────────────────────────────────────
const STAFF_LIST = [
  { id: 'u2', firstName: 'James', lastName: 'Patel', email: 'james@demo-agency.com', role: 'STAFF', isActive: true, phone: '+1-555-0102', lastLoginAt: new Date(Date.now() - 3600000).toISOString(), createdAt: new Date(Date.now() - 7776000000).toISOString(), _count: { assignedApplications: 87 } },
  { id: 'u3', firstName: 'Emily', lastName: 'Wong', email: 'emily@demo-agency.com', role: 'STAFF', isActive: true, phone: '+1-555-0103', lastLoginAt: new Date(Date.now() - 86400000).toISOString(), createdAt: new Date(Date.now() - 5184000000).toISOString(), _count: { assignedApplications: 63 } },
  { id: 'u4', firstName: 'Carlos', lastName: 'Rivera', email: 'carlos@demo-agency.com', role: 'STAFF', isActive: true, phone: '+1-555-0104', lastLoginAt: new Date(Date.now() - 172800000).toISOString(), createdAt: new Date(Date.now() - 4320000000).toISOString(), _count: { assignedApplications: 51 } },
  { id: 'u5', firstName: 'Aisha', lastName: 'Okonkwo', email: 'aisha@demo-agency.com', role: 'STAFF', isActive: false, phone: '+1-555-0105', lastLoginAt: null, createdAt: new Date(Date.now() - 2592000000).toISOString(), _count: { assignedApplications: 42 } },
];
app.get('/api/v1/users', auth, (req, res) => paginated(res, STAFF_LIST, STAFF_LIST.length));
app.post('/api/v1/users', auth, (req, res) => res.status(201).json({ success: true, data: { id: `u${Date.now()}`, ...req.body } }));
app.get('/api/v1/users/:id', auth, (req, res) => ok(res, STAFF_LIST[0]));
app.patch('/api/v1/users/:id', auth, (req, res) => ok(res, { id: req.params.id, ...req.body }));
app.post('/api/v1/users/:id/reset-password', auth, (req, res) => ok(res, null, 'Password reset'));
app.delete('/api/v1/users/:id', auth, (req, res) => ok(res, null, 'Deleted'));

// ─── Tenants (Super Admin) ────────────────────────────────────
const TENANTS = [
  { id: 't1', name: 'Global Edu Consultancy', slug: 'global-edu', email: 'admin@global-edu.com', plan: 'PROFESSIONAL', status: 'ACTIVE', country: 'USA', createdAt: new Date(Date.now() - 86400000).toISOString(), _count: { users: 5, students: 248, applications: 412 } },
  { id: 't2', name: 'Apex Visa Services', slug: 'apex-visa', email: 'admin@apex-visa.com', plan: 'ENTERPRISE', status: 'ACTIVE', country: 'UK', createdAt: new Date(Date.now() - 259200000).toISOString(), _count: { users: 12, students: 891, applications: 1243 } },
  { id: 't3', name: 'StudyPath International', slug: 'studypath', email: 'admin@studypath.com', plan: 'STARTER', status: 'ACTIVE', country: 'Canada', createdAt: new Date(Date.now() - 432000000).toISOString(), _count: { users: 2, students: 43, applications: 67 } },
  { id: 't4', name: 'EduBridge Consultants', slug: 'edubridge', email: 'admin@edubridge.com', plan: 'PROFESSIONAL', status: 'SUSPENDED', country: 'Australia', createdAt: new Date(Date.now() - 604800000).toISOString(), _count: { users: 4, students: 0, applications: 0 } },
  { id: 't5', name: 'Scholars Gate Agency', slug: 'scholars-gate', email: 'admin@scholars-gate.com', plan: 'PROFESSIONAL', status: 'ACTIVE', country: 'Malaysia', createdAt: new Date(Date.now() - 864000000).toISOString(), _count: { users: 7, students: 312, applications: 489 } },
];

app.get('/api/v1/tenants/stats', auth, (req, res) => ok(res, { total: 47, active: 41, suspended: 4, byPlan: [{ plan: 'STARTER', _count: { plan: 18 } }, { plan: 'PROFESSIONAL', _count: { plan: 21 } }, { plan: 'ENTERPRISE', _count: { plan: 8 } }] }));
app.get('/api/v1/tenants', auth, (req, res) => paginated(res, TENANTS, TENANTS.length));
app.post('/api/v1/tenants', auth, (req, res) => res.status(201).json({ success: true, data: { id: `t${Date.now()}`, ...req.body } }));
app.get('/api/v1/tenants/:id', auth, (req, res) => ok(res, TENANTS.find((t) => t.id === req.params.id) || TENANTS[0]));
app.patch('/api/v1/tenants/:id', auth, (req, res) => ok(res, { id: req.params.id, ...req.body }));
app.patch('/api/v1/tenants/:id/suspend', auth, (req, res) => { const t = TENANTS.find((t) => t.id === req.params.id); if (t) t.status = 'SUSPENDED'; ok(res, t, 'Suspended'); });
app.patch('/api/v1/tenants/:id/activate', auth, (req, res) => { const t = TENANTS.find((t) => t.id === req.params.id); if (t) t.status = 'ACTIVE'; ok(res, t, 'Activated'); });
app.delete('/api/v1/tenants/:id', auth, (req, res) => ok(res, null, 'Deleted'));

// ─── Documents & Extraction stubs ────────────────────────────
app.get('/api/v1/documents/student/:id', auth, (req, res) => ok(res, []));
app.post('/api/v1/documents/upload', auth, (req, res) => res.status(201).json({ success: true, data: { id: `d${Date.now()}`, type: 'PASSPORT', status: 'UPLOADED' } }));
app.get('/api/v1/documents/:id', auth, (req, res) => ok(res, {}));
app.patch('/api/v1/documents/:id/status', auth, (req, res) => ok(res, {}));
app.delete('/api/v1/documents/:id', auth, (req, res) => ok(res, null));
app.post('/api/v1/extraction/:id/extract', auth, (req, res) => ok(res, { extractedData: { fullName: 'John Doe', passportNumber: 'X1234567' }, confidence: 94.2, processingMs: 1834 }));
app.get('/api/v1/extraction/:id/logs', auth, (req, res) => ok(res, []));

// ─── Activity logs ────────────────────────────────────────────
app.get('/api/v1/analytics/activity-logs', auth, (req, res) => ok(res, []));

// ─── Health ───────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', mode: 'demo', service: 'MashRoute Demo Server' }));

app.listen(PORT, () => {
  console.log(`\n🚀 MashRoute Demo Server running on :${PORT}`);
  console.log(`   Mode: DEMO (in-memory data, no database required)\n`);
  console.log(`   Login credentials:`);
  console.log('   Demo passwords are read from DEMO_ADMIN_PASSWORD, DEMO_SUPER_ADMIN_PASSWORD, and DEMO_STAFF_PASSWORD.\n');
});
