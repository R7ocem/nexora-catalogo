import { query } from '../../lib/db';
import { money } from '../../lib/format';
import { getCurrentUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getAdminData(user, selectedSlug) {
  const empresasResult = await query(
    `SELECT id, nome, slug, ativo, bloqueado, bloqueado_motivo
     FROM food_empresas
     WHERE ativo = true
     ORDER BY nome`
  );

  let empresas = empresasResult.rows;

  if (user.papel !== 'nexora_admin') {
    empresas = empresas.filter((empresa) => empresa.id === user.empresa_id);
  }

  let empresa = null;

  if (selectedSlug) {
    empresa = empresas.find((item) => item.slug === selectedSlug) || null;
  }

  if (!empresa) {
    empresa = empresas[0] || null;
  }

  if (!empresa) {
    return { empresas, empresa: null, categorias: [], produtos: [] };
  }

  const categorias = await query(
    `SELECT id, nome
     FROM food_categorias
     WHERE empresa_id = $1
     ORDER BY ordem, nome`,
    [empresa.id]
  );

  const produtos = await query(
    `SELECT
       p.id,
       p.codigo,
       p.nome,
       p.descricao,
       p.preco,
       p.imagem_url,
       p.ativo,
       p.apelidos,
       c.nome AS categoria_nome
     FROM food_produtos p
     LEFT JOIN food_categorias c ON c.id = p.categoria_id
     WHERE p.empresa_id = $1
     ORDER BY p.ativo DESC, c.ordem, p.nome`,
    [empresa.id]
  );

  return {
    empresas,
    empresa,
    categorias: categorias.rows,
    produtos: produtos.rows
  };
}
