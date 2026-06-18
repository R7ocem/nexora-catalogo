import { query } from '../../../../lib/db';
import { caminhoCatalogo } from '../../../../lib/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return Response.json(
    { error: 'unauthorized' },
    { status: 401 }
  );
}

function missingToken() {
  return Response.json(
    { error: 'missing_N8N_CATALOG_TOKEN' },
    { status: 500 }
  );
}

function authorized(request) {
  const token = process.env.N8N_CATALOG_TOKEN;
  const header = request.headers.get('authorization') || '';

  if (!token) {
    return 'missing';
  }

  return header === `Bearer ${token}`;
}

function jsonValue(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizarTexto(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasesProduto(produto) {
  const apelidos = String(produto.apelidos || '')
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const aliasesJson = jsonValue(produto.aliases, []);
  const aliasesExtras = Array.isArray(aliasesJson)
    ? aliasesJson.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return Array.from(new Set([
    produto.nome,
    produto.codigo,
    ...apelidos,
    ...aliasesExtras
  ].filter(Boolean)));
}

function moeda(valor) {
  return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
}

function tipoCatalogo(segmento) {
  return segmento === 'alimentacao' ? 'cardapio' : 'catalogo';
}

function labelCatalogo(segmento) {
  return segmento === 'alimentacao' ? 'Cardapio digital' : 'Catalogo digital';
}

export async function GET(request) {
  const auth = authorized(request);

  if (auth === 'missing') {
    return missingToken();
  }

  if (!auth) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const slug = String(url.searchParams.get('slug') || '').trim();

  if (!slug) {
    return Response.json(
      { error: 'missing_slug' },
      { status: 400 }
    );
  }

  const empresas = await query(
    `SELECT
       id,
       nome,
       slug,
       whatsapp,
       email_empresa,
       segmento,
       tipo_oferta,
       titulo_publico,
       subtitulo_publico,
       descricao_publica,
       horario_funcionamento,
       opcoes_pedido,
       ativo,
       bloqueado
     FROM catalogo_empresas
     WHERE slug = $1
     LIMIT 1`,
    [slug]
  );

  const empresa = empresas.rows[0];

  if (!empresa) {
    return Response.json(
      { error: 'business_not_found' },
      { status: 404 }
    );
  }

  if (empresa.ativo !== true || empresa.bloqueado === true) {
    return Response.json(
      {
        error: 'business_unavailable',
        business: {
          id: empresa.id,
          slug: empresa.slug,
          name: empresa.nome,
          active: empresa.ativo === true,
          blocked: empresa.bloqueado === true
        }
      },
      { status: 423 }
    );
  }

  const categorias = await query(
    `SELECT id, nome, ordem
     FROM catalogo_categorias
     WHERE empresa_id = $1
       AND ativo = true
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
       p.apelidos,
       p.aliases,
       p.variacoes,
       c.nome AS categoria_nome,
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
       END AS stock_status
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

  const baseUrl = String(
    process.env.NEXT_PUBLIC_BASE_URL ||
    `${url.protocol}//${url.host}`
  ).replace(/\/$/, '');

  const publicPath = caminhoCatalogo(empresa);
  const publicType = tipoCatalogo(empresa.segmento);
  const opcoesPedido = jsonValue(empresa.opcoes_pedido, {});

  const products = produtos.rows.map((produto) => {
    const aliases = aliasesProduto(produto);
    const variacoes = jsonValue(produto.variacoes, []);
    const stockQuantity = Number(produto.stock_quantity || 0);
    const trackStock = produto.track_stock === true;
    const available = produto.is_available !== false && (!trackStock || stockQuantity > 0);

    return {
      id: produto.id,
      code: produto.codigo,
      name: produto.nome,
      normalized_name: normalizarTexto(produto.nome),
      category: produto.categoria_nome || null,
      description: produto.descricao || '',
      item_type: produto.tipo_item,
      price_type: produto.tipo_preco,
      price: Number(produto.preco || 0),
      price_text: moeda(produto.preco),
      shipping_text: produto.frete_texto || '',
      aliases,
      normalized_aliases: aliases.map(normalizarTexto).filter(Boolean),
      variations: Array.isArray(variacoes) ? variacoes : [],
      stock: {
        track: trackStock,
        quantity: stockQuantity,
        min_stock: Number(produto.min_stock || 0),
        status: produto.stock_status,
        available
      },
      orderable: available
    };
  });

  return Response.json({
    business: {
      id: empresa.id,
      slug: empresa.slug,
      name: empresa.nome,
      public_title: empresa.titulo_publico || empresa.nome,
      public_subtitle: empresa.subtitulo_publico || labelCatalogo(empresa.segmento),
      description: empresa.descricao_publica || '',
      segment: empresa.segmento,
      offer_type: empresa.tipo_oferta,
      whatsapp: empresa.whatsapp || '',
      email: empresa.email_empresa || '',
      opening_hours: jsonValue(empresa.horario_funcionamento, {}),
      order_options: opcoesPedido
    },
    catalog: {
      type: publicType,
      label: labelCatalogo(empresa.segmento),
      public_path: publicPath,
      public_url: `${baseUrl}${publicPath}`,
      cardapio_url: `${baseUrl}/cardapio/${empresa.slug}`,
      catalogo_url: `${baseUrl}/catalogo/${empresa.slug}`
    },
    categories: categorias.rows.map((categoria) => ({
      id: categoria.id,
      name: categoria.nome,
      order: Number(categoria.ordem || 0)
    })),
    products,
    bot_index: products.flatMap((produto) =>
      produto.normalized_aliases.map((alias) => ({
        alias,
        product_id: produto.id,
        product_code: produto.code,
        product_name: produto.name,
        orderable: produto.orderable
      }))
    )
  });
}
