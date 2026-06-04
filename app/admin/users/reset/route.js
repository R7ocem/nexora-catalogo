import { redirect } from 'next/navigation';
import { query } from '../../../../lib/db';
import { getCurrentUser, hashPassword, isTrustedAdminRequest } from '../../../../lib/auth';

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
  const senha = texto(formData.get('senha'));

  if (!empresaId || !usuarioId || senha.length < 8) {
    redirect('/admin?erro=senha');
  }

  const empresa = await query(
    `SELECT id, slug
     FROM food_empresas
     WHERE id = $1
     LIMIT 1`,
    [empresaId]
  );

  const empresaAtual = empresa.rows[0];

  if (!empresaAtual) {
    redirect('/admin');
  }

  const senhaHash = hashPassword(senha);

  await query(
    `UPDATE food_usuarios
     SET senha_hash = $3,
         ativo = true,
         atualizado_em = NOW()
     WHERE id = $1
       AND empresa_id = $2
       AND papel = 'empresa_admin'`,
    [usuarioId, empresaId, senhaHash]
  );

  redirect(`/admin?slug=${empresaAtual.slug}&senha=redefinida`);
}
