import CatalogoInterativo from './CatalogoInterativo';
import { query } from '../../../lib/db';
import { rotuloCatalogo } from '../../../lib/catalog';

async function getCardapio(slug) {
  const empresas = await query(
    `SELECT
     id,
     nome,
     slug,
     whatsapp,
     segmento,
     ativo,
     bloqueado,
     bloqueado_motivo,
     titulo_publico,
     subtitulo_publico,
     descricao_publica,
     tema_cor,
     tema_cor_secundaria,
     usar_gradiente,
     catalogo_fundo_tipo,
     catalogo_fundo_cor,
     logo_posicao,
     logo_zoom,
     banner_posicao,
     banner_zoom,
     logo_url,
     banner_url,
     instagram_url,
     horario_funcionamento,
     opcoes_pedido
   FROM catalogo_empresas
   WHERE slug = $1
   LIMIT 1`,
  [slug]
);    

  const empresa = empresas.rows[0];

  if (!empresa || empresa.ativo !== true) {
    return { empresa: null, categorias: [], produtos: [] };
  }

  if (empresa.bloqueado === true) {
    return { empresa, bloqueado: true, categorias: [], produtos: [] };
  }

  const categorias = await query(
    `SELECT id, nome
     FROM catalogo_categorias
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
       p.tipo_item,
       p.tipo_preco,
       p.frete_texto,
       p.stock_quantity,
       p.min_stock,
       p.track_stock,
       p.show_when_out_of_stock,
       p.is_available,
       p.replenishment_days,
       p.safety_days,
       p.auto_calculate_min_stock,
       COALESCE(vendas.total_vendido_14_dias, 0) AS total_vendido_14_dias,
       COALESCE(vendas.dias_com_venda, 0) AS dias_com_venda,
       CASE
         WHEN COALESCE(vendas.dias_com_venda, 0) >= 7
         THEN ROUND(COALESCE(vendas.total_vendido_14_dias, 0)::numeric / 14, 2)
         ELSE 0
       END AS average_daily_sales,
       CASE
         WHEN COALESCE(p.track_stock, false) = false THEN 'SEM_CONTROLE'
         WHEN COALESCE(p.stock_quantity, 0) <= 0 THEN 'ESGOTADO'
         WHEN COALESCE(p.stock_quantity, 0) <= (
           CASE
             WHEN COALESCE(p.auto_calculate_min_stock, true) = true
               AND COALESCE(vendas.dias_com_venda, 0) >= 7
             THEN CEIL(
               ROUND(COALESCE(vendas.total_vendido_14_dias, 0)::numeric / 14, 2)
               * (COALESCE(p.replenishment_days, 7) + COALESCE(p.safety_days, 3))
             )
             ELSE COALESCE(p.min_stock, 0)
           END
         ) * 0.5 THEN 'CRITICO'
         WHEN COALESCE(p.stock_quantity, 0) <= (
           CASE
             WHEN COALESCE(p.auto_calculate_min_stock, true) = true
               AND COALESCE(vendas.dias_com_venda, 0) >= 7
             THEN CEIL(
               ROUND(COALESCE(vendas.total_vendido_14_dias, 0)::numeric / 14, 2)
               * (COALESCE(p.replenishment_days, 7) + COALESCE(p.safety_days, 3))
             )
             ELSE COALESCE(p.min_stock, 0)
           END
         ) THEN 'ATENCAO'
         ELSE 'NORMAL'
       END AS stock_status,
       p.imagem_url,
       p.ativo,
       p.destaque,
       p.destaque_ordem,
       p.apelidos,
       p.variacoes,
       c.nome AS categoria_nome
     FROM catalogo_produtos p
     LEFT JOIN catalogo_categorias c ON c.id = p.categoria_id AND c.empresa_id = p.empresa_id
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(SUM(sm.quantity), 0) AS total_vendido_14_dias,
         COUNT(DISTINCT sm.created_at::date) AS dias_com_venda
       FROM stock_movements sm
       WHERE sm.product_id = p.id
         AND sm.type = 'saida'
         AND sm.created_at >= NOW() - INTERVAL '14 days'
     ) vendas ON true
     WHERE p.empresa_id = $1
       AND p.ativo = true
       AND COALESCE(p.is_available, true) = true
       AND (
         COALESCE(p.track_stock, false) = false
         OR COALESCE(p.stock_quantity, 0) > 0
         OR COALESCE(p.show_when_out_of_stock, true) = true
       )
     ORDER BY c.ordem, p.nome`,
    [empresa.id]
  );

    return { empresa, categorias: categorias.rows, produtos: produtos.rows };
  }
  
  export async function generateMetadata({ params }) {
    const { empresa } = await getCardapio(params.slug);
  
    return {
      title: empresa?.nome || 'Catálogo',
      description: empresa
        ? `${rotuloCatalogo(empresa.segmento)} ${empresa.nome}`
        : 'Catálogo digital'
    };
  }
  
  export default async function CardapioPage({ params }) {
    const { empresa, bloqueado, categorias, produtos } = await getCardapio(params.slug);
  
    if (!empresa) {
      return (
        <main className="shell">
          <section className="panel">
            <h1>Catálogo não encontrado</h1>
            <p className="muted">Confira o link enviado pela empresa.</p>
          </section>
        </main>
      );
    }
  
    if (bloqueado) {
      return (
        <main className="shell">
          <section className="panel blocked-panel">
            <h1>Catálogo temporariamente indisponível</h1>
            <p className="muted">
              Este catálogo está passando por uma atualização administrativa.
            </p>
          </section>
        </main>
      );
    }
    
    const produtosPorCategoria = categorias.map((categoria) => ({
      ...categoria,
      produtos: produtos.filter((produto) => produto.categoria_nome === categoria.nome)
    }));
  
    const semCategoria = produtos.filter((produto) => !produto.categoria_nome);
  
    return (
    <main>
      <section className="shell product-list">
        {produtos.length === 0 ? (
          <div className="panel">
            <h2>Catálogo em atualização</h2>
            <p className="muted">
              Em breve os itens estarão disponíveis por aqui.
            </p>
          </div>
        ) : (
          <CatalogoInterativo
            empresa={empresa}
            categorias={produtosPorCategoria}
            semCategoria={semCategoria}
          />
        )}
      </section>
    </main>
  );   
}
