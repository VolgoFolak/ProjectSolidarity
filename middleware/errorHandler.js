const fs = require('fs');
const path = require('path');

// Logger para producción
const logError = (error, req) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID,
      userId: req.session?.user?.id
    }
  };

  const logPath = path.join(__dirname, '../logs/errors.log');
  fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
};

// Middleware de manejo de errores
const errorHandler = (err, req, res, next) => {
  // Log del error
  logError(err, req);

  // Verificar si ya se enviaron headers
  if (res.headersSent) {
    return next(err);
  }

  // CSRF token inválido
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ 
      error: 'Token CSRF inválido',
      code: 'INVALID_CSRF'
    });
  }

  // Error de conexión a base de datos
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({ 
      error: 'Servicio temporalmente no disponible',
      code: 'SERVICE_UNAVAILABLE'
    });
  }

  // Respuesta genérica para producción
  const response = {
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    requestId: req.sessionID
  };

  // En desarrollo, incluir detalles
  if (process.env.NODE_ENV !== 'production') {
    response.details = err.message;
    response.stack = err.stack;
  }

  res.status(500).json(response);
};

// Manejo de 404
const notFoundHandler = (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'Endpoint no encontrado',
      code: 'NOT_FOUND',
      path: req.path
    });
  }
  
  res.status(404).render('404', { 
    lang: req.lang, 
    user: req.session?.user,
    requestedPath: req.path
  });
};

module.exports = { errorHandler, notFoundHandler };