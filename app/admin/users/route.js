import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { getCurrentUser, hashPassword, isTrustedAdminRequest } from '../../../lib/auth';
import { emailValido, normalizarEmail } from '../../../lib/validation';

function texto(valor) {
  return String(valor || '').trim();
}

export async function POST(request) {
  if (!isTrustedAdminRequest(request)) {
    redirect('/admin');
  }

  const user = await getCurrentUser();

  if (!user || user.papel !== 'nexora_admin') {
    redirect('/admin');
  }

  const formData = await request.formData();

  const empresaId = Number(formData.get('empresa_id'));
  const nome = texto(formData.get('nome'));
  const email = normalizarEmail(formData.get('email'));
  const senha = texto(formData.get('senha'));

  if (!empresaId || !nome || !email || !senha) {
    redirect('/admin');
  }

  const empresa = await query(
    `SELECT id, slug
     FROM catalogo_empresas
     WHERE id = $1
     LIMIT 1`,
    [empresaId]
  );

  const empresaAtual = empresa.rows[0];

  if (!empresaAtual) {
    redirect('/admin');
  }

  if (!emailValido(email)) {
    redirect(`/admin?slug=${empresaAtual.slug}&erro=email_invalido`);
  }

  const emailExistente = await query(
    `SELECT id
     FROM catalogo_usuarios
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  if (emailExistente.rows.length > 0) {
    redirect(`/admin?slug=${empresaAtual.slug}&erro=email`);
  }

  const senhaHash = hashPassword(senha);

  await query(
    `INSERT INTO catalogo_usuarios (
       empresa_id,
       nome,
       email,
       senha_hash,
       papel,
       ativo
     )
     VALUES ($1, $2, $3, $4, 'empresa_admin', true)`,
    [
      empresaId,
      nome,
      email,
      senhaHash
    ]
  );

  redirect(`/admin?slug=${empresaAtual.slug}`);
}
