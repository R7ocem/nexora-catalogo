import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { slugify } from '../../../lib/format';

function parsePrice(value) {
  return Number(String(value || '0').replace(',', '.')) || 0;
}

function parseAliases(value, fallback) {
  const aliases = String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return aliases.length ? aliases : [fallback].filter(Boolean);
}

export async function POST(request) {
  const formData = await request.formData();
  const empresaId = Number(formData.get('empresa_id'));
  const nome = String(formData.get('nome') || '').trim();
  const codigo = slugify(formData.get('codigo') || nome);
  const descricao = String(formData.get('descricao') || '').trim();
  const preco = parsePrice(formData.get('preco'));
  const imagemUrl = String(formData.get('imagem_url') || '').trim();
  const categoriaId = formData.get('categoria_id') ? Number(formData.get('categoria_id')) : null;
  const ativo = formData.get('ativo') === 'on';
  const aliases = parseAliases(formData.get('aliases'), nome.toLowerCase());

  if (!empresaId || !codigo || !nome) redirect('/admin');

  await query(
    `INSERT INTO food_produtos (
       empresa_id, categoria_id, codigo, nome, descricao, preco, imagem_url, aliases, ativo
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     ON CONFLICT (empresa_id, codigo)
     DO UPDATE SET
       categoria_id = EXCLUDED.categoria_id,
       nome = EXCLUDED.nome,
       descricao = EXCLUDED.descricao,
       preco = EXCLUDED.preco,
       imagem_url = EXCLUDED.imagem_url,
       aliases = EXCLUDED.aliases,
       ativo = EXCLUDED.ativo,
       atualizado_em = NOW()`,
    [empresaId, categoriaId, codigo, nome, descricao || null, preco, imagemUrl || null, JSON.stringify(aliases), ativo]
  );

  redirect('/admin');
}
