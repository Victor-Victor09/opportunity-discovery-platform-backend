const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Opportunity Discovery Platform API' });
});

module.exports = router;
