// Run with: node fix-backend.js [BACKEND_URL]
// Examples:
//   node fix-backend.js
//   node fix-backend.js https://api.cocoacode.dev
//   node fix-backend.js http://localhost:4000

require('dotenv').config();

const { promisify } = require('util');
const dns = require('dns').promises;
const net = require('net');
const url = require('url');

// Node 18+ has global fetch. If you're on <18, uncomment the next line:
// global.fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const DEFAULT_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const BASE = (process.argv[2] || DEFAULT_URL).replace(/\/+$/, '');

const ORIGIN_FOR_TESTS = process.env.FRONTEND_ORIGIN || 'https://www.cocoacode.dev';

const EXPECTED_ENDPOINTS = [
  { path: '/health', method: 'GET', label: 'Health' },
  { path: '/api/availability?month=2025-08', method: 'GET', label: 'Availability' },
  { path: '/api/booking/test', method: 'POST', label: 'Booking Test', body: { ping: true } },
];

function title(t){ console.log(`\n${'='.repeat(8)} ${t} ${'='.repeat(8)}\n`); }
function ok(msg){ console.log(`✅ ${msg}`); }
function warn(msg){ console.log(`⚠️  ${msg}`); }
function err(msg){ console.log(`❌ ${msg}`); }
function info(msg){ console.log(`ℹ️  ${msg}`); }

async function tcpCheck(hostname, port, timeoutMs=3000){
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    function finish(ok, detail){ if (done) return; done = true; socket.destroy(); resolve({ ok, detail }); }
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true, 'Connected'));
    socket.once('timeout', () => finish(false, 'TCP timeout'));
    socket.once('error', (e) => finish(false, e.message));
    socket.connect(port, hostname);
  });
}

async function doRequest(method, fullUrl, options={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);

  try {
    const res = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      redirect: 'manual',
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { ok: true, status: res.status, headers: res.headers, bodyText: text, bodyJson: json };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'Request timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function corsPreflight(fullUrl, method='POST') {
  return doRequest('OPTIONS', fullUrl, {
    headers: {
      'Origin': ORIGIN_FOR_TESTS,
      'Access-Control-Request-Method': method,
      'Access-Control-Request-Headers': 'content-type',
    }
  });
}

async function main(){
  title('Cocoa Code Backend Connectivity Diagnostic');

  info(`Target backend: ${BASE}`);
  info(`Frontend origin used for CORS tests: ${ORIGIN_FOR_TESTS}`);

  // 1) Parse URL / figure out host:port
  title('1) URL & DNS');
  let parsed;
  try {
    parsed = new url.URL(BASE);
    ok(`Parsed URL: protocol=${parsed.protocol} host=${parsed.hostname} port=${parsed.port || (parsed.protocol==='https:'?'443':'80')}`);
  } catch (e) {
    err(`Invalid BACKEND_URL. Try something like https://api.cocoacode.dev or http://localhost:4000`);
    process.exit(1);
  }

  // 1a) DNS resolve (skip for localhost/127.0.0.1)
  if (!['localhost','127.0.0.1','::1'].includes(parsed.hostname)) {
    try {
      const records = await dns.lookup(parsed.hostname, { all: true });
      ok(`DNS resolves: ${records.map(r => `${r.address}`).join(', ')}`);
    } catch (e) {
      err(`DNS lookup failed for ${parsed.hostname}: ${e.message}`);
      warn(`If you just updated DNS, allow propagation (usually minutes—sometimes longer). On Netlify DNS, ensure records exist and are green-ticked.`);
    }
  } else {
    info('Local host detected — DNS resolution skipped.');
  }

  // 2) TCP reachability
  title('2) TCP Reachability');
  const port = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);
  const tcp = await tcpCheck(parsed.hostname, port);
  if (tcp.ok) ok(`TCP connect to ${parsed.hostname}:${port} succeeded`);
  else {
    err(`TCP connect failed: ${tcp.detail}`);
    if (parsed.hostname === 'localhost') {
      warn('Is your server running? Did you bind to 0.0.0.0 instead of 127.0.0.1 when testing from devices?');
    } else {
      warn('If deploying to Railway/Render/Fly/etc., confirm the service is healthy and publicly exposed.');
    }
  }

  // 3) Basic HTTP(S) request to /
  title('3) Base URL Request');
  const root = await doRequest('GET', BASE + '/', { timeoutMs: 8000 });
  if (!root.ok) {
    err(`Base request failed: ${root.error}`);
  } else {
    ok(`Base request responded: ${root.status}`);
    const loc = root.headers.get('location');
    if (root.status >= 300 && root.status < 400 && loc) {
      info(`Redirected to: ${loc}`);
    }
  }

  // 4) Endpoint checks
  title('4) Endpoint Checks');
  for (const ep of EXPECTED_ENDPOINTS) {
    const full = BASE + ep.path;
    info(`Testing ${ep.label} [${ep.method}] ${full}`);

    // 4a) CORS preflight (for non-GET)
    if (ep.method !== 'GET') {
      const pre = await corsPreflight(full, ep.method);
      if (pre.ok) {
        const alo = pre.headers.get('access-control-allow-origin');
        const alm = pre.headers.get('access-control-allow-methods');
        const alh = pre.headers.get('access-control-allow-headers');
        if (alo === '*' || (alo && alo.includes(ORIGIN_FOR_TESTS))) {
          ok(`CORS preflight OK (Allow-Origin: ${alo || 'missing'})`);
        } else {
          err(`CORS preflight responded but Allow-Origin is NOT permitting ${ORIGIN_FOR_TESTS} (got: ${alo || 'missing'})`);
          warn(`Fix: on your backend, set Access-Control-Allow-Origin to ${ORIGIN_FOR_TESTS} (or *) and include 'Content-Type' in Access-Control-Allow-Headers.`);
        }
        if (!alm || !/POST|GET|OPTIONS/i.test(alm)) {
          warn(`Access-Control-Allow-Methods missing/insufficient (got: ${alm || 'missing'})`);
        }
        if (!alh || !/content-type/i.test(alh)) {
          warn(`Access-Control-Allow-Headers missing 'Content-Type' (got: ${alh || 'missing'})`);
        }
      } else {
        err(`CORS preflight failed: ${pre.error}`);
        warn('Your server may not handle OPTIONS requests. Add a global OPTIONS handler (or enable CORS middleware).');
      }
    }

    // 4b) Actual call
    const res = await doRequest(ep.method, full, {
      body: ep.body,
      headers: ep.method !== 'GET' ? { Origin: ORIGIN_FOR_TESTS } : {},
    });

    if (!res.ok) {
      err(`Request failed: ${res.error}`);
      continue;
    }

    const alo = res.headers.get('access-control-allow-origin');
    if (alo !== '*' && alo !== ORIGIN_FOR_TESTS) {
      warn(`CORS header suspicious (Access-Control-Allow-Origin: ${alo || 'missing'})`);
    }

    if (res.status >= 200 && res.status < 300) {
      ok(`${ep.label} returned ${res.status}`);
      if (res.bodyJson) info(`JSON sample: ${JSON.stringify(res.bodyJson).slice(0, 160)}${res.bodyText.length>160?'…':''}`);
    } else {
      err(`${ep.label} returned HTTP ${res.status}`);
      info(`Body: ${res.bodyText.slice(0, 200)}${res.bodyText.length>200?'…':''}`);
    }
  }

  // 5) Mixed-content (HTTPS front vs HTTP API)
  title('5) Mixed-Content (HTTPS Frontend vs HTTP API)');
  if (ORIGIN_FOR_TESTS.startsWith('https://') && BASE.startsWith('http://') && !parsed.hostname.match(/^(localhost|127\.0\.0\.1|::1)$/)) {
    err('Your site is HTTPS but API is HTTP — browsers will block this as mixed content.');
    warn('Fix: put the API behind HTTPS (proxy via Netlify, use Railway TLS domain, or add a reverse proxy).');
  } else {
    ok('No obvious mixed-content issue detected for the provided origins.');
  }

  // 6) Suggested server snippet (Express + CORS)
  title('6) If CORS is the issue, enable it like this');
  console.log(`
/* server.js */
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());

// Be precise in production:
app.use(cors({
  origin: '${ORIGIN_FOR_TESTS}',
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.options('*', cors()); // handle preflight globally

app.get('/health', (req,res)=>res.json({ ok: true, uptime: process.uptime() }));
// ... your routes

app.listen(process.env.PORT || 4000, '0.0.0.0', () => {
  console.log('API listening');
});
  `.trim());

  // 7) Handy curl commands
  title('7) Try these curl commands');
  console.log(`curl -i ${BASE}/health`);
  console.log(`curl -i -X OPTIONS ${BASE}/api/booking/test \\`);
  console.log(`  -H "Origin: ${ORIGIN_FOR_TESTS}" \\`);
  console.log(`  -H "Access-Control-Request-Method: POST" \\`);
  console.log(`  -H "Access-Control-Request-Headers: content-type"`);
  console.log(`curl -i -X POST ${BASE}/api/booking/test \\`);
  console.log(`  -H "Origin: ${ORIGIN_FOR_TESTS}" -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"ping":true}'`);

  title('Diagnostic finished');
}

main().catch(e => {
  err(`Unhandled error: ${e.message}`);
  process.exit(1);
});
