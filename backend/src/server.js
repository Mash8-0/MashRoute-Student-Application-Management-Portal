require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Ensure runtime directories exist (a fresh deploy may not include empty dirs).
for (const dir of ['logs', 'uploads/temp', 'uploads/documents', 'uploads/loe']) {
  fs.mkdirSync(path.join(process.cwd(), dir), { recursive: true });
}

const logger = require('./config/logger');
const errorMiddleware = require('./middleware/error.middleware');
const routes = require('./routes');
const { startMdacScheduler } = require('./modules/mdac/mdac.scheduler');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const API_VERSION = process.env.API_VERSION || 'v1';

// Behind Nginx / a reverse proxy in production, trust the first proxy hop so
// rate limiting, secure cookies, and req.ip use the real client address.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
    credentials: true,
  },
});

// Attach io to app so services can emit events via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // Join a room per tenant so events are scoped
  socket.on('join:tenant', (tenantId) => {
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
      logger.info(`Socket ${socket.id} joined tenant:${tenantId}`);
    }
  });

  // Join personal room for user-specific notifications
  socket.on('join:user', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
    if (!origin || allowed.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  message: { success: false, message: 'Too many auth attempts, please try again later' },
});

// Rate limiting is disabled in development to avoid blocking local testing
if (process.env.NODE_ENV === 'production') {
  app.use(globalLimiter);
  app.use(`/api/${API_VERSION}/auth/login`, authLimiter);
  app.use(`/api/${API_VERSION}/auth/forgot-password`, authLimiter);
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MashRoute API',
    version: API_VERSION,
    database: 'neon-postgresql',
    realtime: 'socket.io',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use(`/api/${API_VERSION}`, routes);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorMiddleware);

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  logger.info(`🚀 MashRoute API on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  logger.info(`📡 API: http://localhost:${PORT}/api/${API_VERSION}`);
  logger.info(`🔌 Socket.io: enabled`);
  logger.info(`🗄️  Database: Neon PostgreSQL`);
  startMdacScheduler();
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM — shutting down gracefully');
  httpServer.close(() => process.exit(0));
});

process.on('unhandledRejection', (reason) => logger.error('Unhandled Rejection:', reason));

module.exports = { app, io };
