const http = require('http');

const routes = {
  'GET /v2/payments/tr_44aKxzEbr8/chargebacks/chb_n9z0tp': {
    status: 200,
    body: { resource: 'chargeback', id: 'chb_n9z0tp', amount: { value: '-35.00', currency: 'EUR' }, createdAt: '2025-01-26T11:44:32+00:00', paymentId: 'tr_44aKxzEbr8', reasonCode: 'item_not_received', respondBefore: '2025-02-09T11:44:32+00:00', settlementAmount: { value: '-35.00', currency: 'EUR' } }
  },
  'GET /v2/payments/tr_44aKxzEbr8/chargebacks': {
    status: 200,
    body: { count: 2, _embedded: { chargebacks: [{ resource: 'chargeback', id: 'chb_n9z0tp', amount: { value: '-35.00', currency: 'EUR' }, reasonCode: 'item_not_received' }, { resource: 'chargeback', id: 'chb_m8y1up', amount: { value: '-120.00', currency: 'EUR' }, reasonCode: 'fraudulent' }] } }
  },
  'GET /v2/merchants/merchant_001/chargeback-ratio': {
    status: 200,
    body: { merchantId: 'merchant_001', chargebackRatio: 0.03, threshold: 0.005, riskLevel: 'high', warning: 'Chargeback ratio exceeds acceptable threshold.' }
  }
};

const server = http.createServer((req, res) => {
  const key = `${req.method} ${req.url}`;
  const route = routes[key];
  res.setHeader('Content-Type', 'application/json');
  if (route) {
    res.writeHead(route.status);
    res.end(JSON.stringify(route.body));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(3001, () => console.log('Mock server running on port 3001'));