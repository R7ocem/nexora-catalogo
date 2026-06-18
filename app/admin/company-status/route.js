import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { getCurrentUser, isTrustedAdminRequest } from '../../../lib/auth';

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
  const acao = String(formData.get('acao') || '');

  if (!empresaId || !['bloquear', 'desbloquear'].includes(acao)) {
    redirect('/admin');
  }

  const empresaAtual = await query(
    `SELECT id, slug
     FROM catalogo_empresas
     WHERE id = $1
     LIMIT 1`,
    [empresaId]
  );

  const empresa = empresaAtual.rows[0];

  if (!empresa) {
    redirect('/admin');
  }

  if (acao === 'bloquear') {
    await query(
      `UPDATE catalogo_empresas
       SET
         bloqueado = true,
         bloqueado_motivo = 'mensalidade_pendente',
         bloqueado_em = NOW()
       WHERE id = $1`,
      [empresa.id]
    );
  }

  if (acao === 'desbloquear') {
    await query(
      `UPDATE catalogo_empresas
       SET
         bloqueado = false,
         bloqueado_motivo = NULL,
         bloqueado_em = NULL
       WHERE id = $1`,
      [empresa.id]
    );
  }

  redirect(`/admin?slug=${empresa.slug}&painel=empresa#empresa`);
}
