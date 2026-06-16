import { query } from '../../../../lib/db';
import { inventoryAuthorized, inventoryUnauthorized } from '../../../../lib/inventoryAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!inventoryAuthorized(request)) {
    return inventoryUnauthorized();
  }

  const result = await query(
    `WITH produtos_base AS (
       SELECT
         e.id AS business_id,
         e.nome AS business_name,
         e.whatsapp AS business_phone,
         p.id AS product_id,
         p.nome AS product_name,
         p.stock_quantity,
         p.min_stock,
         p.replenishment_days,
         p.safety_days,
         p.auto_calculate_min_stock,
         COALESCE(vendas.total_vendido_14_dias, 0) AS total_vendido_14_dias,
         COALESCE(vendas.dias_com_venda, 0) AS dias_com_venda,
         CASE
           WHEN COALESCE(vendas.dias_com_venda, 0) >= 7 THEN ROUND(COALESCE(vendas.total_vendido_14_dias, 0)::numeric / 14, 2)
           ELSE 0
         END AS average_daily_sales
       FROM catalogo_produtos p
       INNER JOIN catalogo_empresas e ON e.id = p.empresa_id
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(SUM(sm.quantity), 0) AS total_vendido_14_dias,
           COUNT(DISTINCT sm.created_at::date) AS dias_com_venda
         FROM stock_movements sm
         WHERE sm.product_id = p.id
           AND sm.type = 'saida'
           AND sm.created_at >= NOW() - INTERVAL '14 days'
       ) vendas ON true
       WHERE p.track_stock = true
         AND p.ativo = true
         AND COALESCE(p.is_available, true) = true
         AND e.ativo = true
     ),
     produtos_metricas AS (
       SELECT
         *,
         CASE
           WHEN COALESCE(auto_calculate_min_stock, true) = true
             AND dias_com_venda >= 7
             THEN CEIL(average_daily_sales * (COALESCE(replenishment_days, 7) + COALESCE(safety_days, 3)))
           ELSE COALESCE(min_stock, 0)
         END AS minimum_stock,
         CASE
           WHEN average_daily_sales > 0 THEN ROUND(COALESCE(stock_quantity, 0)::numeric / average_daily_sales, 1)
           ELSE NULL
         END AS days_remaining
       FROM produtos_base
     ),
     produtos_status AS (
       SELECT
         *,
         CASE
           WHEN COALESCE(stock_quantity, 0) <= 0 THEN 'ESGOTADO'
           WHEN COALESCE(stock_quantity, 0) <= minimum_stock * 0.5 THEN 'CRITICO'
           WHEN COALESCE(stock_quantity, 0) <= minimum_stock THEN 'ATENCAO'
           ELSE 'NORMAL'
         END AS stock_status
       FROM produtos_metricas
     )
     SELECT
       business_id,
       business_name,
       business_phone,
       product_id,
       product_name,
       stock_quantity,
       average_daily_sales,
       minimum_stock,
       days_remaining,
       stock_status
     FROM produtos_status
     WHERE stock_status IN ('ATENCAO', 'CRITICO', 'ESGOTADO')
     ORDER BY business_name, stock_status DESC, days_remaining NULLS LAST, product_name`
  );

  return Response.json(
    result.rows.map((row) => ({
      business_id: row.business_id,
      business_name: row.business_name,
      business_phone: row.business_phone,
      product_id: row.product_id,
      product_name: row.product_name,
      stock_quantity: Number(row.stock_quantity || 0),
      average_daily_sales: Number(row.average_daily_sales || 0),
      minimum_stock: Number(row.minimum_stock || 0),
      days_remaining: row.days_remaining === null ? null : Number(row.days_remaining),
      stock_status: row.stock_status
    }))
  );
}
