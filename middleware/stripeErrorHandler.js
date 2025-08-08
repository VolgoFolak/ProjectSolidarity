function stripeErrorHandler(err, req, res, next) {
  if (err.type === 'StripeConnectionError') {
    console.error('Error de conexión con Stripe:', err);
    return res.status(503).json({ 
      error: 'Error de conexión con el procesador de pagos',
      code: 'stripe_connection_error'
    });
  }

  if (err.type === 'StripeAPIError') {
    console.error('Error en API Stripe:', err);

    if (err.code === 'account_onboarding_incomplete') {
      return res.status(400).json({
        error: 'Proceso de verificación incompleto',
        solution: 'Complete el onboarding en Stripe',
        link: '/reauth-stripe'
      });
    }

    return res.status(502).json({
      error: 'Error en el procesador de pagos',
      code: err.code || 'stripe_api_error'
    });
  }

  next(err);
}

module.exports = stripeErrorHandler;