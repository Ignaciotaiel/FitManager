// middleware centralizado de manejo de errores
export function errorHandler(err, req, res, next) {
  // log interno seguro sin volcar secretos ni contrasenas
  const status = err.statusCode || err.status || 500;
  const message = status === 500 && process.env.NODE_ENV === 'production'
    ? 'error interno del servidor'
    : err.message || 'error inesperado en el servidor';

  res.status(status).json({
    ok: false,
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR'
    }
  });
}

// middleware para rutas no encontradas (404)
export function notFoundHandler(req, res) {
  res.status(404).json({
    ok: false,
    error: {
      message: `la ruta ${req.method} ${req.originalUrl} no existe`,
      code: 'NOT_FOUND'
    }
  });
}
