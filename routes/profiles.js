const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

router.get('/:identifier', profileController.showPublicProfile);

module.exports = router;