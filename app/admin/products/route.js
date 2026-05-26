import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/auth';

function texto(valor) {
  return String(valor || '').trim();
}

function numero(valor) {
  const normalizado = String(valor || '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');

  const numeroFinal = Number(normalizado);

  return Number.isFinite(numeroFinal) ? numeroFinal : 0;
}

export async function POST(request) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/admin');
  }

  const formData = await request.formData();

  const produtoId = Number(formData.get('produto_id'));
  const empresaId = Number(formData.get('empresa_id'));

  const codigo = texto(formData.get('codigo'))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_ -]/g, '')
    .replace(/\s+/g, '_');

  const nome = texto(formData.get('nome'));
  const categoriaIdRaw = texto(formData.get('categoria_id'));
  const categoriaId = categoriaIdRaw ? Number(categoriaIdRaw) : null;
  const preco = numero(formData.get('preco'));
  const imagemUrl = texto(formData.get('imagem_url'));
  const descricao = texto(formData.get('descricao'));
  const apelidos = texto(formData.get('apelidos'));
  const ativo = formData.get('ativo') === 'on';

  if (!empresaId || !codigo || !nome) {
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

  if (produtoId) {
    await query(
      `UPDATE food_produtos
       SET
         codigo = $3,
         nome = $4,
         categoria_id = $5,
         preco = $6,
         imagem_url = $7,
         descricao = $8,
         apelidos = $9,
         ativo = $10
       WHERE id = $1
         AND empresa_id = $2`,
      [
        produtoId,
        empresaId,
        codigo,
        nome,
        categoriaId,
        preco,
        imagemUrl,
        descricao,
        apelidos,
        ativo
      ]
    );
  } else {
    await query(
      `INSERT INTO food_produtos (
         empresa_id,
         categoria_id,
         codigo,
         nome,
         descricao,
         preco,
         imagem_url,
         apelidos,
         ativo
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        empresaId,
        categoriaId,
        codigo,
        nome,
        descricao,
        preco,
        imagemUrl,
        apelidos,
        ativo
      ]
    );
  }

  redirect(`/admin?slug=${empresaAtual.slug}`);
}
