const http = require('http');

const VALID_REASON_CODES = ['item_not_received', 'fraudulent', 'duplicate', 'product_not_as_described'];
const MAX_BODY_BYTES = 1 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MERCHANT_ID_RE = /^merchant_\d{3,}$/;
const TRACKING_MIN_LENGTH = 10;

const chargebacks = {
  chb_n9z0tp: {
    resource: 'chargeback',
    id: 'chb_n9z0tp',
    amount: { value: '-35.00', currency: 'EUR' },
    createdAt: '2025-01-26T11:44:32+00:00',
    paymentId: 'tr_44aKxzEbr8',
    reasonCode: 'item_not_received',
    respondBefore: '2099-02-09T11:44:32+00:00',
    settlementAmount: { value: '-35.00', currency: 'EUR' },
  },
  chb_expired: {
    resource: 'chargeback',
    id: 'chb_expired',
    amount: { value: '-50.00', currency: 'EUR' },
    createdAt: '2024-12-01T11:44:32+00:00',
    paymentId: 'tr_44aKxzEbr8',
    reasonCode: 'fraudulent',
    respondBefore: '2024-12-15T11:44:32+00:00',
    settlementAmount: { value: '-50.00', currency: 'EUR' },
  },
};

const merchants = {
  merchant_001: {
    merchantId: 'merchant_001',
    chargebackRatio: 0.03,
    threshold: 0.005,
    riskLevel: 'high',
    warning: 'Chargeback ratio exceeds acceptable threshold.',
  },
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      raw += chunk;
      if (raw.length > MAX_BODY_BYTES) tooLarge = true;
    });
    req.on('end', () => resolve({ raw, tooLarge }));
  });
}

async function handleEvidenceSubmission(req, res, chargebackId) {
  const { raw, tooLarge } = await readBody(req);

  if (tooLarge) return send(res, 413, { error: 'Payload too large' });
  if (!raw || raw.trim() === '') return send(res, 400, { error: 'Request body is required' });

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return send(res, 400, { error: 'Invalid JSON' });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return send(res, 400, { error: 'Body must be a JSON object' });
  }

  if (!data.trackingNumber) {
    return send(res, 400, { error: 'trackingNumber is required' });
  }
  if (typeof data.trackingNumber !== 'string' || data.trackingNumber.trim().length < TRACKING_MIN_LENGTH) {
    return send(res, 400, { error: `trackingNumber must be at least ${TRACKING_MIN_LENGTH} characters` });
  }
  if (data.customerEmail !== undefined && !EMAIL_RE.test(data.customerEmail)) {
    return send(res, 400, { error: 'customerEmail format is invalid' });
  }

  const cb = chargebacks[chargebackId];
  if (!cb) return send(res, 404, { error: 'Chargeback not found' });
  if (new Date(cb.respondBefore).getTime() < Date.now()) {
    return send(res, 422, { error: 'Dispute deadline has passed', respondBefore: cb.respondBefore });
  }

  return send(res, 201, {
    evidenceSubmitted: true,
    status: 'evidence_submitted',
    chargebackId,
    submissionId: 'evd_' + Math.random().toString(36).slice(2, 10),
    submittedAt: new Date().toISOString(),
  });
}

const server = http.createServer((req, res) => {
  const evidenceMatch = req.url.match(/^\/v2\/payments\/([^/]+)\/chargebacks\/([^/]+)\/evidence$/);
  if (req.method === 'POST' && evidenceMatch) {
    return handleEvidenceSubmission(req, res, evidenceMatch[2]);
  }

  const cbMatch = req.url.match(/^\/v2\/payments\/([^/]+)\/chargebacks\/([^/]+)$/);
  if (req.method === 'GET' && cbMatch) {
    const cb = chargebacks[cbMatch[2]];
    if (!cb) return send(res, 404, { error: 'Chargeback not found' });
    return send(res, 200, cb);
  }

  const listMatch = req.url.match(/^\/v2\/payments\/([^/]+)\/chargebacks$/);
  if (req.method === 'GET' && listMatch) {
    return send(res, 200, {
      count: 2,
      _embedded: {
        chargebacks: [
          { resource: 'chargeback', id: 'chb_n9z0tp', amount: { value: '-35.00', currency: 'EUR' }, reasonCode: 'item_not_received' },
          { resource: 'chargeback', id: 'chb_m8y1up', amount: { value: '-120.00', currency: 'EUR' }, reasonCode: 'fraudulent' },
        ],
      },
    });
  }

  const merchantMatch = req.url.match(/^\/v2\/merchants\/([^/]+)\/chargeback-ratio$/);
  if (req.method === 'GET' && merchantMatch) {
    const merchantId = merchantMatch[1];
    if (!MERCHANT_ID_RE.test(merchantId)) {
      return send(res, 400, { error: 'Invalid merchant ID format' });
    }
    const m = merchants[merchantId];
    if (!m) return send(res, 404, { error: 'Merchant not found' });
    return send(res, 200, m);
  }

  return send(res, 404, { error: 'Not found' });
});

server.listen(3001, () => console.log('Mock server running on port 3001'));
