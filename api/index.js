const serverless = require('serverless-http');

module.exports = serverless(async (req, res) => {
  res.status(200).json({ status: 'ok', brand: 'NexaBot', message: 'API is live' });
});