const express = require('express');
const router = express.Router();
const { 
  addImpactPoints, 
  getImpactStats, 
  calculateHistoricPoints,
  getWeeklyRanking,
  forceWeeklyReset
} = require('../controllers/impactpoints');

// Sumar puntos por acción
router.post('/', addImpactPoints);

// Obtener estadísticas de puntos de impacto de un usuario
router.get('/stats/:userId', getImpactStats);

// Obtener ranking semanal por liga
router.get('/weekly-ranking/:leagueLevel', getWeeklyRanking);

// Calcular puntos históricos
router.post('/calculate-historic', calculateHistoricPoints);

// Forzar reset semanal (solo para testing)
router.post('/force-weekly-reset', forceWeeklyReset);

module.exports = router;