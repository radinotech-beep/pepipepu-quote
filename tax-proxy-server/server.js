require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 3000);
const appRoot = path.resolve(__dirname, '..');

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
app.use(express.json({ limit: '30mb' }));

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

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude 응답에서 JSON을 찾지 못했습니다.');
  return JSON.parse(match[0]);
}

function normalizeBizRegResult(data) {
  return {
    business_number: String(data.business_number || '').replace(/[^0-9]/g, ''),
    company_name: String(data.company_name || ''),
    representative_name: String(data.representative_name || ''),
    business_type: String(data.business_type || ''),
    business_category: String(data.business_category || ''),
    address: String(data.address || ''),
    email: String(data.email || '')
  };
}

app.post('/extract-bizreg', async (req, res) => {
  try {
    const apiKey = requiredEnv('ANTHROPIC_API_KEY');
    const mediaType = String(req.body && req.body.mediaType || '').toLowerCase();
    const imageBase64 = String(req.body && req.body.imageBase64 || '').replace(/^data:[^,]+,/, '');
    const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);
    if (!supportedTypes.has(mediaType)) {
      throw new Error('현재는 JPG, PNG, GIF, WebP, PDF 파일만 지원합니다.');
    }
    if (!imageBase64) throw new Error('사업자등록증 이미지가 비어 있습니다.');

    const prompt = `사업자등록증 이미지에서 다음 정보를 추출해서 JSON으로만 반환하세요.
다른 설명 없이 JSON만 출력하세요:
{
  "business_number": "사업자등록번호 (숫자만, 하이픈 없이)",
  "company_name": "상호명",
  "representative_name": "대표자명",
  "business_type": "업태",
  "business_category": "업종",
  "address": "사업장 주소",
  "email": "이메일 (있으면, 없으면 빈 문자열)"
}
정보가 이미지에서 확인되지 않으면 해당 필드를 빈 문자열로 두세요.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1000,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            mediaType === 'application/pdf'
              ? {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: imageBase64
                  }
                }
              : {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: imageBase64
                  }
                },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch (_) { data = { raw: text }; }
    if (!response.ok) {
      return res.status(response.status).json({
        message: data.error && data.error.message || data.message || 'Claude Vision API request failed',
        anthropicStatus: response.status
      });
    }

    const answer = (data.content || []).map(part => part && part.text || '').join('\n').trim();
    const parsed = normalizeBizRegResult(extractJsonObject(answer));
    return res.json(parsed);
  } catch (error) {
    return res.status(400).json({ message: error.message || '사업자등록증 분석 요청을 처리하지 못했습니다.' });
  }
});

app.use(express.static(appRoot, {
  extensions: ['html'],
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(appRoot, 'index.html'));
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
  console.log(`Pepipepu quote app is running at http://127.0.0.1:${port}`);
  console.log('Open that address and keep this window open while issuing tax invoices.');
});
