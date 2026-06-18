import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { getCurrentUser, isTrustedAdminRequest } from '../../../lib/auth';

function texto(valor) {
  return String(valor || '').trim();
}

async function getEmpresaPermitida(user, empresaId) {
  if (!user || !empresaId) return null;

  if (user.papel !== 'nexora_admin' && user.empresa_id !== empresaId) {
    return null;
  }

  const empresa = await query(
    `SELECT id, slug
     FROM catalogo_empresas
     WHERE id = $1
     LIMIT 1`,
    [empresaId]
  );

  return empresa.rows[0] || null;
}

async function voltar(user, empresaId) {
  const empresa = await getEmpresaPermitida(user, empresaId);
  redirect(empresa?.slug ? `/admin?slug=${empresa.slug}&painel=categorias#categorias` : '/admin?painel=categorias#categorias');
}

export async function POST(request) {
  if (!isTrustedAdminRequest(request)) {
    redirect('/admin');
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect('/admin');
  }

  const formData = await request.formData();

  const acao = texto(formData.get('acao'));
  const empresaId = Number(formData.get('empresa_id'));
  const categoriaId = Number(formData.get('categoria_id'));
  const nome = texto(formData.get('nome'));

  const empresa = await getEmpresaPermitida(user, empresaId);

  if (!empresa) {
    redirect('/admin');
  }

  if (acao === 'criar') {
    if (!nome) {
      redirect(`/admin?slug=${empresa.slug}&painel=categorias&erro=categoria#categorias`);
    }

    const ordem = await query(
      `SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima_ordem
       FROM catalogo_categorias
       WHERE empresa_id = $1`,
      [empresaId]
    );

    await query(
      `INSERT INTO catalogo_categorias (empresa_id, nome, ordem, ativo)
       VALUES ($1, $2, $3, true)`,
      [empresaId, nome, ordem.rows[0].proxima_ordem]
    );

    redirect(`/admin?slug=${empresa.slug}&painel=categorias#categorias`);
  }

  if (acao === 'renomear') {
    if (!categoriaId || !nome) {
     redirect(`/admin?slug=${empresa.slug}&painel=categorias&erro=categoria#categorias`);
    }

    await query(
      `UPDATE catalogo_categorias
       SET nome = $3, atualizado_em = now()
       WHERE id = $1
         AND empresa_id = $2`,
      [categoriaId, empresaId, nome]
    );

    redirect(`/admin?slug=${empresa.slug}&painel=categorias#categorias`);
  }

  if (acao === 'excluir') {
    if (!categoriaId) {
     redirect(`/admin?slug=${empresa.slug}&painel=categorias#categorias`);
    }

    await query(
      `DELETE FROM catalogo_categorias
       WHERE id = $1
         AND empresa_id = $2`,
      [categoriaId, empresaId]
    );

    redirect(`/admin?slug=${empresa.slug}&painel=categorias#categorias`);
  }

  if (acao === 'subir' || acao === 'descer') {
    if (!categoriaId) {
      redirect(`/admin?slug=${empresa.slug}&painel=categorias#categorias`);
    }

    const categorias = await query(
      `SELECT id, ordem
       FROM catalogo_categorias
       WHERE empresa_id = $1
       ORDER BY ordem, nome`,
      [empresaId]
    );

    const lista = categorias.rows;
    const index = lista.findIndex((categoria) => categoria.id === categoriaId);
    const outroIndex = acao === 'subir' ? index - 1 : index + 1;

    if (index >= 0 && outroIndex >= 0 && outroIndex < lista.length) {
      const atual = lista[index];
      const outro = lista[outroIndex];

      await query(
        `UPDATE catalogo_categorias SET ordem = $2 WHERE id = $1 AND empresa_id = $3`,
        [atual.id, outro.ordem, empresaId]
      );

      await query(
        `UPDATE catalogo_categorias SET ordem = $2 WHERE id = $1 AND empresa_id = $3`,
        [outro.id, atual.ordem, empresaId]
      );
    }

    redirect(`/admin?slug=${empresa.slug}&painel=categorias#categorias`);
  }

  await voltar(user, empresaId);
}
