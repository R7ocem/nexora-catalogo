import { query } from '../../../../lib/db';
import { inventoryAuthorized, inventoryUnauthorized } from '../../../../lib/inventoryAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!inventoryAuthorized(request)) {
    return inventoryUnauthorized();
  }

  const result = await query(
    `SELECT
       e.id AS business_id,
       e.nome AS business_name,
       e.whatsapp AS business_phone,
       p.id AS product_id,
       p.nome AS product_name,
       p.stock_quantity,
       p.min_stock,
       CASE
         WHEN p.stock_quantity <= 0 THEN 'esgotado'
         ELSE 'baixo'
       END AS status
     FROM catalogo_produtos p
     INNER JOIN catalogo_empresas e ON e.id = p.empresa_id
     WHERE p.track_stock = true
       AND p.ativo = true
       AND COALESCE(p.is_available, true) = true
       AND e.ativo = true
       AND p.stock_quantity <= p.min_stock
     ORDER BY e.nome, status DESC, p.nome`
  );

  const lojas = result.rows.reduce((acc, row) => {
    let loja = acc.find((item) => item.business_id === row.business_id);

    if (!loja) {
      loja = {
        business_id: row.business_id,
        business_name: row.business_name,
        business_phone: row.business_phone,
        products: []
      };

      acc.push(loja);
    }

    loja.products.push({
      product_id: row.product_id,
      product_name: row.product_name,
      stock_quantity: Number(row.stock_quantity || 0),
      min_stock: Number(row.min_stock || 0),
      status: row.status
    });

    return acc;
  }, []);

  return Response.json({ lojas });
}
