const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('WhatsApp webhook verification request', {
    mode,
    hasToken: Boolean(token),
    hasChallenge: Boolean(challenge),
  });

  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return res.status(200).type('text/plain').send(String(challenge));
  }

  return res.sendStatus(403);
});

router.post('/', async (req, res) => {
  res.sendStatus(200);

  try {
    console.log('WhatsApp webhook event received', {
      object: req.body?.object,
      entryCount: Array.isArray(req.body?.entry)
        ? req.body.entry.length
        : 0,
    });

    // Do not expose access tokens or sensitive personal data in logs.
    // Later processing belongs here for incoming messages and status updates:
    // sent, delivered, read, and failed.
  } catch (error) {
    console.error('WhatsApp webhook processing failed', error);
  }
});

module.exports = router;
