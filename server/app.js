import http from 'http';
import crypto from 'crypto';
import { env } from './lib/config/env.js';
import { generateCv } from './app/cv-generator/service.js';
import { cacheProvider } from './lib/cache/init.js';

async function isRateLimited(ip, max = 15, windowMs = 60_000) {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const key = `cv:rl:${ip}`;
  try {
    const count = await cacheProvider.incr(key);
    if (count === 1) {
      await cacheProvider.expire(key, windowSec);
    }
    return count > max;
  } catch (err) {
    console.warn('[rate-limit] Redis unavailable, failing open:', err.message);
    return false;
  }
}

function readJsonBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        const err = new Error('Payload too large');
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        const err = new Error('Invalid JSON body');
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end(JSON.stringify(payload));
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const corrId = String(req.headers['x-correlation-id'] || crypto.randomUUID());
    res.setHeader('X-Correlation-Id', corrId);

    const origin = req.headers.origin;
    if (origin && env.cors.origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-Id');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const urlPath = (req.url || '/').split('?')[0];
    if (req.method === 'GET' && urlPath === '/api/health') {
      return sendJson(res, 200, { status: 'ok', service: 'cv-interactive-app', timestamp: new Date().toISOString() });
    }

    if (req.method === 'POST' && urlPath === '/api/cv/generate') {
      const ip = req.socket?.remoteAddress || 'unknown';
      if (await isRateLimited(ip)) {
        return sendJson(res, 429, { error: 'Too many CV generation requests. Please try again later.' });
      }
      try {
        const body = await readJsonBody(req);
        const result = await generateCv(body);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, err.statusCode || 500, { error: err.message || 'CV generation failed' });
      }
    }

    return sendJson(res, 404, { error: 'Route not found' });
  });
}

