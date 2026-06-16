import { query } from '../../../../lib/db';
import { inventoryAuthorized, inventoryUnauthorized } from '../../../../lib/inventoryAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tiposPermitidos = ['entrada', 'ajuste'];

function inteiro(valor) {
  const numero = Number(valor);

  return Number.isInteger(numero) ? numero : null;
}

export async function POST(request) {
  if (!inventoryAuthorized(request)) {
    return inventoryUnauthorized();
  }

  const body = await request.json().catch(() => ({}));
  const productId = inteiro(body.product_id);
  const quantity = inteiro(body.quantity);
  const type = String(body.type || '').trim().toLowerCase();
  const reason = String(body.reason || '').trim();
  const createdBy = String(body.created_by || 'api').trim();

  if (!productId || !tiposPermitidos.includes(type)) {
    return Response.json(
      { error: 'invalid_request' },
      { status: 400 }
    );
  }

  if (quantity === null || quantity < 0 || (type === 'entrada' && quantity === 0)) {
    return Response.json(
      { error: 'invalid_quantity' },
      { status: 400 }
    );
  }

  const result = await query(
    `WITH produto AS (
       SELECT id, empresa_id, stock_quantity
       FROM catalogo_produtos
       WHERE id = $1
       FOR UPDATE
     ),
     atualizado AS (
       UPDATE catalogo_produtos p
       SET
         stock_quantity = CASE
           WHEN $2 = 'entrada' THEN produto.stock_quantity + $3
           ELSE $3
         END,
         track_stock = true,
         atualizado_em = NOW()
       FROM produto
       WHERE p.id = produto.id
       RETURNING
         p.id AS product_id,
         p.empresa_id AS business_id,
         produto.stock_quantity AS previous_quantity,
         p.stock_quantity AS new_quantity
     ),
     movimento AS (
       INSERT INTO stock_movements (
         product_id,
         business_id,
         type,
         quantity,
         previous_quantity,
         new_quantity,
         reason,
         created_by
       )
       SELECT
         product_id,
         business_id,
         $2,
         $3,
         previous_quantity,
         new_quantity,
         $4,
         $5
       FROM atualizado
       RETURNING id
     )
     SELECT
       atualizado.product_id,
       atualizado.business_id,
       atualizado.previous_quantity,
       atualizado.new_quantity,
       movimento.id AS movement_id
     FROM atualizado
     INNER JOIN movimento ON true`,
    [productId, type, quantity, reason || null, createdBy || 'api']
  );

  const updated = result.rows[0];

  if (!updated) {
    return Response.json(
      { error: 'product_not_found' },
      { status: 404 }
    );
  }

  return Response.json({
    product_id: updated.product_id,
    business_id: updated.business_id,
    previous_quantity: Number(updated.previous_quantity || 0),
    new_quantity: Number(updated.new_quantity || 0),
    movement_id: updated.movement_id
  });
}
