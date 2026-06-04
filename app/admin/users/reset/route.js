import { redirect } from 'next/navigation';
import { query } from '../../../../lib/db';
import { getCurrentUser, hashPassword, isTrustedAdminRequest } from '../../../../lib/auth';
import { emailValido, normalizarEmail } from '../../../../lib/validation';

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
  const usuarioId = Number(formData.get('usuario_id'));
  const nome = texto(formData.get('nome'));
  const email = normalizarEmail(formData.get('email'));
  const senha = texto(formData.get('senha'));

  if (!empresaId || !usuarioId || !nome || !email) {
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
       AND id <> $2
     LIMIT 1`,
    [email, usuarioId]
  );

  if (emailExistente.rows.length > 0) {
    redirect(`/admin?slug=${empresaAtual.slug}&erro=email`);
  }

  if (senha && senha.length < 8) {
    redirect(`/admin?slug=${empresaAtual.slug}&erro=senha`);
  }

  const senhaHash = senha ? hashPassword(senha) : null;

  await query(
    `UPDATE catalogo_usuarios
     SET nome = $3,
         email = $4,
         senha_hash = COALESCE($5, senha_hash),
         ativo = true,
         atualizado_em = NOW()
     WHERE id = $1
       AND empresa_id = $2
       AND papel = 'empresa_admin'`,
    [usuarioId, empresaId, nome, email, senhaHash]
  );

  redirect(`/admin?slug=${empresaAtual.slug}&senha=redefinida`);
}
