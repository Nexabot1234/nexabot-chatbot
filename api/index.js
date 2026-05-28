module.exports = (req, res) => {
  res.status(200).json({ status: 'ok', brand: 'NexaBot', message: 'API is live' });
};