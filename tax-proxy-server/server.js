require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const port = Number(process.env.PORT || 3000);

const allowedOrigins = new Set([
  'https://radinotech-beep.github.io',
  'http://127.0.0.1:8787',
  'http://localhost:8787',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'null'
]);

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const requestHeaders = req.headers['access-control-request-headers'] || 'Content-Type';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} origin=${origin || '-'}`);
  if (!origin || allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', requestHeaders);
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '200kb' }));

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.includes('YOUR_') || value.includes('_HERE')) {
    throw new Error(`${name} is not configured in .env`);
  }
  return value;
}

function supplierFromEnv() {
  return {
    identificationNumber: (process.env.SUPPLIER_IDENTIFICATION_NUMBER || '').replace(/[^0-9]/g, ''),
    organizationName: process.env.SUPPLIER_ORGANIZATION_NAME || '(주) 페피페푸',
    representativeName: process.env.SUPPLIER_REPRESENTATIVE_NAME || '김수진',
    manager: {
      email: process.env.SUPPLIER_MANAGER_EMAIL || 'pepipepu2020@gmail.com',
      telephone: process.env.SUPPLIER_TELEPHONE || '010-5395-4977'
    }
  };
}

function validatePayload(body) {
  if (!body || typeof body !== 'object') throw new Error('요청 데이터가 비어 있습니다.');
  if (!body.supplied || !body.supplied.identificationNumber) throw new Error('공급받는자 사업자번호가 필요합니다.');
  if (!Array.isArray(body.items) || body.items.length === 0) throw new Error('세금계산서 품목이 필요합니다.');
  const bizNo = String(body.supplied.identificationNumber).replace(/[^0-9]/g, '');
  if (bizNo.length !== 10) throw new Error('공급받는자 사업자번호는 숫자 10자리여야 합니다.');
  body.supplied.identificationNumber = bizNo;
  return body;
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'pepipepu-bolta-tax-proxy' });
});

app.post('/issue-tax-invoice', async (req, res) => {
  try {
    const apiKey = requiredEnv('BOLTA_API_KEY');
    const supplierKey = requiredEnv('BOLTA_SUPPLIER_KEY');
    const incoming = validatePayload(req.body);
    const supplier = supplierFromEnv();
    if (!supplier.identificationNumber || supplier.identificationNumber.length !== 10) {
      throw new Error('SUPPLIER_IDENTIFICATION_NUMBER must be 10 digits in .env');
    }

    const boltaBody = {
      date: incoming.date,
      purpose: incoming.purpose || 'RECEIPT',
      taxType: incoming.taxType || 'TAXABLE',
      supplier,
      supplied: incoming.supplied,
      items: incoming.items
    };

    const auth = Buffer.from(`${apiKey}:`).toString('base64');
    const referenceId = `pepipepu-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const response = await fetch('https://xapi.bolta.io/v1/taxInvoices/issue', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Supplier-Key': supplierKey,
        'Bolta-Client-Reference-Id': referenceId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(boltaBody)
    });

    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch (_) { data = { raw: text }; }

    if (!response.ok) {
      return res.status(response.status).json({
        message: data.message || data.error || 'Bolta API request failed',
        boltaStatus: response.status,
        boltaResponse: data
      });
    }

    return res.json({
      ok: true,
      issuanceKey: data.issuanceKey,
      boltaResponse: data,
      clientReferenceId: referenceId
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || '세금계산서 발행 요청을 처리하지 못했습니다.' });
  }
});

app.listen(port, () => {
  console.log(`Pepipepu Bolta tax proxy is running at http://127.0.0.1:${port}`);
  console.log('Keep this window open while issuing tax invoices from the quote app.');
});
