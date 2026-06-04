import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { isTrustedAdminRequest, setAdminSession, verifyPassword } from '../../../lib/auth';

const MAX_TENTATIVAS = 5;
const JANELA_TENTATIVAS_MS = 15 * 60 * 1000;
const tentativasLogin = new Map();

function chaveTentativa(request, email) {
  const ip = String(
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'local'
  ).split(',')[0].trim();

  return `${ip}:${email}`;
}

function limparTentativasAntigas(agora) {
  for (const [chave, tentativa] of tentativasLogin.entries()) {
    if (tentativa.expiraEm <= agora) {
      tentativasLogin.delete(chave);
    }
  }
}

function loginBloqueado(chave, agora) {
  limparTentativasAntigas(agora);

  const tentativa = tentativasLogin.get(chave);

  return Boolean(tentativa && tentativa.total >= MAX_TENTATIVAS && tentativa.expiraEm > agora);
}

function registrarFalhaLogin(chave, agora) {
  const tentativa = tentativasLogin.get(chave);

  if (!tentativa || tentativa.expiraEm <= agora) {
    tentativasLogin.set(chave, {
      total: 1,
      expiraEm: agora + JANELA_TENTATIVAS_MS
    });
    return;
  }

  tentativa.total += 1;
  tentativa.expiraEm = agora + JANELA_TENTATIVAS_MS;
}

export async function POST(request) {
  if (!isTrustedAdminRequest(request)) {
    redirect('/admin');
  }

  const formData = await request.formData();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const agora = Date.now();
  const chave = chaveTentativa(request, email);

  if (loginBloqueado(chave, agora)) {
    redirect('/admin?erro=limite');
  }

  const result = await query(
    `SELECT id, empresa_id, nome, email, senha_hash, papel
     FROM catalogo_usuarios
     WHERE email = $1 AND ativo = true
     LIMIT 1`,
    [email]
  );

  const user = result.rows[0];

  if (!user || !verifyPassword(password, user.senha_hash)) {
    registrarFalhaLogin(chave, agora);
    redirect('/admin?erro=login');
  }

  tentativasLogin.delete(chave);
  setAdminSession(user);

  redirect('/admin');
}
