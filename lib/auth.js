import crypto from 'crypto';
import { cookies } from 'next/headers';
import { query } from './db';

const COOKIE_NAME = 'nexora_catalogo_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function normalizarHost(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
}

function getSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.DATABASE_URL ||
    'nexora-catalogo-dev-secret'
  );
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(value)
    .digest('base64url');
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const iterations = 120000;
  const hash = crypto
    .pbkdf2Sync(String(password), salt, iterations, 32, 'sha256')
    .toString('hex');

  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [algorithm, iterationsRaw, salt, expectedHash] = String(storedHash || '').split('$');
  if (algorithm !== 'pbkdf2_sha256' || !iterationsRaw || !salt || !expectedHash) return false;

  const actualHash = crypto
    .pbkdf2Sync(String(password), salt, Number(iterationsRaw), 32, 'sha256')
    .toString('hex');

  const actualBuffer = Buffer.from(actualHash, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (actualBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function isTrustedAdminRequest(request) {
  const host = normalizarHost(
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host')
  );
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const appHost = normalizarHost(
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL
  );

  const permitidos = [host, appHost].filter(Boolean);
  const origemInformada = origin || referer;

  if (!origemInformada || permitidos.length === 0) {
    return true;
  }

  try {
    const origemHost = new URL(origemInformada).host.toLowerCase();
    return permitidos.includes(origemHost);
  } catch {
    return false;
  }
}

export function setAdminSession(user) {
  const payload = base64url(JSON.stringify({
    id: user.id,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  }));

  cookies().set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearAdminSession() {
  cookies().delete(COOKIE_NAME);
  cookies().delete('nexora_catalogo_admin');
  cookies().delete('nexora_food_session');
  cookies().delete('nexora_food_admin');
}

export async function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature || signature !== sign(payload)) return null;

  let session;
  try {
    session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!session.id || session.exp < Math.floor(Date.now() / 1000)) return null;

  const result = await query(
    `SELECT id, empresa_id, nome, email, papel
     FROM catalogo_usuarios
     WHERE id = $1 AND ativo = true
     LIMIT 1`,
    [session.id]
  );

  return result.rows[0] || null;
}
