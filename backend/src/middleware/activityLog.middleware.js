const prisma = require('../config/database');
const logger = require('../config/logger');

const logActivity = (action, entity) => async (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    if (data?.success && req.user) {
      const entityId =
        req.params.id ||
        data?.data?.id ||
        data?.data?.application?.id ||
        data?.data?.student?.id;

      prisma.activityLog
        .create({
          data: {
            tenantId: req.tenantId || req.user.tenantId || null,
            userId: req.user.id,
            action,
            entity,
            entityId: entityId || null,
            newValue: req.body ? sanitizeBody(req.body) : null,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']?.substring(0, 255),
          },
        })
        .catch((err) => logger.error('Activity log failed:', err));
    }
    return originalJson(data);
  };

  next();
};

const sanitizeBody = (body) => {
  const sensitive = ['password', 'token', 'secret', 'refreshToken'];
  const cleaned = { ...body };
  sensitive.forEach((key) => {
    if (cleaned[key]) cleaned[key] = '[REDACTED]';
  });
  return cleaned;
};

module.exports = { logActivity };
