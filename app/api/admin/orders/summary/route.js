import { query } from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statusPermitidos = ['novo', 'em_preparo', 'pronto', 'saiu_entrega', 'finalizado'];

function statusPedido(pedido) {
  if (pedido.status === 'finalizado') return 'finalizado';
  if (pedido.status_preparo) return pedido.status_preparo;
  if (pedido.status === 'confirmado') return 'novo';
  return pedido.status || 'novo';
}

export async function GET(request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const company = String(url.searchParams.get('company') || '').trim();
  const filter = String(url.searchParams.get('filter') || 'novo').trim();

  if (!company) {
    return Response.json({ error: 'missing_company' }, { status: 400 });
  }

  const empresaResult = await query(
    `SELECT id, slug
     FROM catalogo_empresas
     WHERE slug = $1
       AND ($2 = 'nexora_admin' OR id = $3)
     LIMIT 1`,
    [company, user.papel, user.empresa_id]
  );

  const empresa = empresaResult.rows[0];

  if (!empresa) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const pedidosResult = await query(
    `SELECT pedido_id, status, status_preparo, atualizado_em, confirmado_em, criado_em
     FROM pedidos
     WHERE company = $1
       AND COALESCE(status, 'rascunho') <> 'rascunho'
       AND COALESCE(data_pedido, CURRENT_DATE) >= CURRENT_DATE - INTERVAL '400 days'
     ORDER BY COALESCE(atualizado_em, confirmado_em, criado_em) DESC
     LIMIT 1000`,
    [empresa.slug]
  );

  const counts = statusPermitidos.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  for (const pedido of pedidosResult.rows) {
    const status = statusPedido(pedido);
    counts[status] = (counts[status] || 0) + 1;
  }

  const latest = pedidosResult.rows[0];
  const signature = JSON.stringify({
    filter,
    counts,
    latest: latest
      ? [
        latest.pedido_id,
        latest.status,
        latest.status_preparo,
        latest.atualizado_em,
        latest.confirmado_em,
        latest.criado_em
      ].join('|')
      : ''
  });

  return Response.json({
    counts,
    total: pedidosResult.rows.length,
    signature
  });
}
