import { redirect } from 'next/navigation';
import { query } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth';

export async function POST(request) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/admin');
  }

  const formData = await request.formData();

  const produtoId = Number(formData.get('produto_id'));
  const empresaId = Number(formData.get('empresa_id'));

  if (!produtoId || !empresaId) {
    redirect('/admin');
  }

  if (user.papel !== 'nexora_admin' && user.empresa_id !== empresaId) {
    redirect('/admin');
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

  await query(
    `DELETE FROM food_produtos
     WHERE id = $1
       AND empresa_id = $2`,
    [produtoId, empresaId]
  );

  redirect(`/admin?slug=${empresaAtual.slug}#itens`);
}
