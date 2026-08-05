import crypto from 'crypto';
import { getPool } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function texto(valor) {
  return String(valor || '').trim();
}

function numero(valor) {
  const numeroFinal = Number(String(valor || '').replace(',', '.'));
  return Number.isFinite(numeroFinal) ? numeroFinal : 0;
}

function inteiroPositivo(valor) {
  return Math.max(1, Math.floor(numero(valor)));
}

function valorJson(valor, fallback) {
  if (!valor) return fallback;
  if (typeof valor === 'object') return valor;

  try {
    return JSON.parse(valor);
  } catch {
    return fallback;
  }
}

function normalizarVariacoes(valor) {
  const variacoes = valorJson(valor, []);
  if (!Array.isArray(variacoes)) return [];

  return variacoes
    .filter((grupo) => grupo?.tipo !== 'combinacoes')
    .map((grupo) => {
      const nome = texto(grupo?.nome);
      const valores = Array.isArray(grupo?.valores)
        ? grupo.valores.map(texto).filter(Boolean)
        : [];

      return nome && valores.length > 0 ? { nome, valores } : null;
    })
    .filter(Boolean);
}

function normalizarCombinacoes(valor) {
  const variacoes = valorJson(valor, []);
  if (!Array.isArray(variacoes)) return [];

  return variacoes
    .filter((grupo) => grupo?.tipo === 'combinacoes' && Array.isArray(grupo.combinacoes))
    .flatMap((grupo) => grupo.combinacoes)
    .map((combinacao) => {
      const escolhas = combinacao?.escolhas && typeof combinacao.escolhas === 'object'
        ? combinacao.escolhas
        : {};

      return {
        escolhas,
        sku: texto(combinacao?.sku),
        preco: combinacao?.preco === null || combinacao?.preco === undefined
          ? null
          : numero(combinacao.preco),
        stock_quantity: combinacao?.stock_quantity === null || combinacao?.stock_quantity === undefined
          ? null
          : Math.max(0, Math.floor(numero(combinacao.stock_quantity)))
      };
    })
    .filter((combinacao) => Object.keys(combinacao.escolhas).length > 0);
}

function escolhasValidas(produto, escolhas) {
  const grupos = normalizarVariacoes(produto.variacoes);

  return grupos.reduce((acc, grupo) => {
    const valor = texto(escolhas?.[grupo.nome]);

    if (valor && grupo.valores.includes(valor)) {
      acc[grupo.nome] = valor;
    }

    return acc;
  }, {});
}

function combinacaoCorresponde(combinacao, escolhas) {
  const entradas = Object.entries(combinacao?.escolhas || {});

  if (entradas.length === 0) return false;

  return entradas.every(([nome, valor]) => escolhas[nome] === valor)
    && Object.keys(escolhas).every((nome) => combinacao.escolhas[nome] === escolhas[nome]);
}

function combinacaoSelecionada(produto, escolhas) {
  return normalizarCombinacoes(produto.variacoes).find((combinacao) =>
    combinacaoCorresponde(combinacao, escolhas)
  ) || null;
}

function tituloVariacao(escolhas) {
  return Object.entries(escolhas || {})
    .filter(([, valor]) => valor)
    .map(([nome, valor]) => `${nome}: ${valor}`)
    .join(', ');
}

function variantId(produtoId, escolhas) {
  const partes = Object.entries(escolhas || {})
    .filter(([, valor]) => valor)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nome, valor]) => `${nome}:${valor}`);

  return partes.length > 0 ? `${produtoId}:${partes.join('|')}` : null;
}

function atualizarEstoqueCombinacao(produto, combinacaoAtual, quantidade) {
  if (!combinacaoAtual || combinacaoAtual.stock_quantity === null) return null;

  const variacoes = valorJson(produto.variacoes, []);
  if (!Array.isArray(variacoes)) return null;

  return variacoes.map((grupo) => {
    if (grupo?.tipo !== 'combinacoes' || !Array.isArray(grupo.combinacoes)) {
      return grupo;
    }

    return {
      ...grupo,
      combinacoes: grupo.combinacoes.map((combinacao) => {
        const normalizada = {
          escolhas: combinacao?.escolhas || {},
          stock_quantity: combinacao?.stock_quantity === null || combinacao?.stock_quantity === undefined
            ? null
            : Math.max(0, Math.floor(numero(combinacao.stock_quantity)))
        };

        if (!combinacaoCorresponde(normalizada, combinacaoAtual.escolhas)) {
          return combinacao;
        }

        return {
          ...combinacao,
          stock_quantity: Math.max(0, normalizada.stock_quantity - quantidade)
        };
      })
    };
  });
}

function pedidoPublico(pedido, itens = []) {
  return {
    pedido_id: pedido.pedido_id,
    numero_dia: pedido.numero_dia,
    numero_sequencial: pedido.numero_sequencial,
    company: pedido.company,
    status: pedido.status,
    status_preparo: pedido.status_preparo,
    total: Number(pedido.total || 0),
    entrega_retirada: pedido.entrega_retirada,
    pagamento: pedido.pagamento,
    criado_em: pedido.criado_em,
    atualizado_em: pedido.atualizado_em,
    itens
  };
}

async function itensPedido(client, pedidoId) {
  const result = await client.query(
    `SELECT
       produto,
       nome_produto,
       variant_id,
       variant_title,
       sku,
       variacoes_escolhidas,
       quantidade,
       preco_unitario,
       subtotal
     FROM pedido_itens
     WHERE pedido_id = $1
     ORDER BY id`,
    [pedidoId]
  );

  return result.rows.map((item) => ({
    ...item,
    quantidade: Number(item.quantidade || 0),
    preco_unitario: Number(item.preco_unitario || 0),
    subtotal: Number(item.subtotal || 0)
  }));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const companySlug = texto(body.company || body.slug);
  const itensEntrada = Array.isArray(body.items) ? body.items : [];
  const clientOrderKey = texto(body.client_order_key) || crypto.randomUUID();

  if (!companySlug || itensEntrada.length === 0) {
    return Response.json(
      { error: 'invalid_order', message: 'Informe ao menos um item para criar o pedido.' },
      { status: 400 }
    );
  }

  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const empresaResult = await client.query(
      `SELECT id, slug, nome, whatsapp, ativo, bloqueado, n8n_next_order_number
       FROM catalogo_empresas
       WHERE slug = $1
       LIMIT 1
       FOR UPDATE`,
      [companySlug]
    );
    const empresa = empresaResult.rows[0];

    if (!empresa || empresa.ativo !== true || empresa.bloqueado === true) {
      await client.query('ROLLBACK');
      return Response.json(
        { error: 'business_unavailable', message: 'Catalogo indisponivel no momento.' },
        { status: 404 }
      );
    }

    const existente = await client.query(
      `SELECT *
       FROM pedidos
       WHERE company = $1
         AND client_order_key = $2
       LIMIT 1`,
      [empresa.slug, clientOrderKey]
    );

    if (existente.rows[0]) {
      const itens = await itensPedido(client, existente.rows[0].pedido_id);
      await client.query('COMMIT');
      return Response.json({
        success: true,
        duplicate: true,
        order: pedidoPublico(existente.rows[0], itens)
      });
    }

    const pedidoId = `CAT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const numeroSequencial = Math.max(Number(empresa.n8n_next_order_number || 77), 77);
    const itensCalculados = [];

    for (const item of itensEntrada) {
      const produtoId = Number(item.product_id || item.id);
      const quantidade = inteiroPositivo(item.quantity || item.quantidade);

      if (!produtoId) throw new Error('invalid_product');

      const produtoResult = await client.query(
        `SELECT *
         FROM catalogo_produtos
         WHERE id = $1
           AND empresa_id = $2
           AND ativo = true
           AND COALESCE(is_available, true) = true
         LIMIT 1
         FOR UPDATE`,
        [produtoId, empresa.id]
      );
      const produto = produtoResult.rows[0];

      if (!produto) throw new Error('product_unavailable');

      const escolhas = escolhasValidas(produto, item.selected_options || item.variacoes_escolhidas || {});
      const grupos = normalizarVariacoes(produto.variacoes);

      if (grupos.length > 0 && grupos.some((grupo) => !escolhas[grupo.nome])) {
        throw new Error('missing_variation');
      }

      const combinacoes = normalizarCombinacoes(produto.variacoes);
      const combinacao = combinacoes.length > 0 ? combinacaoSelecionada(produto, escolhas) : null;

      if (combinacoes.length > 0 && !combinacao) {
        throw new Error('variation_unavailable');
      }

      const estoqueCombinacao = combinacao?.stock_quantity ?? null;
      const controlaEstoque = estoqueCombinacao !== null || produto.track_stock === true;
      const estoqueDisponivel = estoqueCombinacao !== null
        ? estoqueCombinacao
        : Math.max(0, Math.floor(Number(produto.stock_quantity || 0)));

      if (controlaEstoque && estoqueDisponivel < quantidade) {
        throw new Error('out_of_stock');
      }

      const precoUnitario = produto.tipo_preco === 'sob_consulta'
        ? 0
        : Number.isFinite(combinacao?.preco) && combinacao.preco !== null
          ? Number(combinacao.preco)
          : Number(produto.preco || 0);
      const subtotal = precoUnitario * quantidade;
      const variacoesAtualizadas = atualizarEstoqueCombinacao(produto, combinacao, quantidade);

      if (variacoesAtualizadas) {
        await client.query(
          `UPDATE catalogo_produtos
           SET variacoes = $2::jsonb,
               atualizado_em = NOW()
           WHERE id = $1`,
          [produto.id, JSON.stringify(variacoesAtualizadas)]
        );
      } else if (produto.track_stock === true) {
        const estoqueAnterior = Math.max(0, Math.floor(Number(produto.stock_quantity || 0)));
        const estoqueNovo = Math.max(0, estoqueAnterior - quantidade);

        await client.query(
          `UPDATE catalogo_produtos
           SET stock_quantity = $2,
               atualizado_em = NOW()
           WHERE id = $1`,
          [produto.id, estoqueNovo]
        );

        await client.query(
          `INSERT INTO stock_movements (
             product_id,
             business_id,
             type,
             quantity,
             previous_quantity,
             new_quantity,
             reason,
             order_id
           )
           VALUES ($1, $2, 'saida', $3, $4, $5, $6, $7)`,
          [produto.id, empresa.id, quantidade, estoqueAnterior, estoqueNovo, 'Pedido no catalogo', pedidoId]
        );
      }

      itensCalculados.push({
        product_id: produto.id,
        produto: produto.codigo || String(produto.id),
        nome_produto: produto.nome,
        variant_id: variantId(produto.id, escolhas),
        variant_title: tituloVariacao(escolhas),
        sku: combinacao?.sku || '',
        variacoes_escolhidas: escolhas,
        quantidade,
        preco_unitario: precoUnitario,
        subtotal
      });
    }

    const subtotalProdutos = itensCalculados.reduce((soma, item) => soma + item.subtotal, 0);

    await client.query(
      `UPDATE catalogo_empresas
       SET n8n_next_order_number = $2
       WHERE id = $1`,
      [empresa.id, numeroSequencial + 1]
    );

    await client.query(
      `INSERT INTO pedidos (
         pedido_id,
         numero_dia,
         numero_sequencial,
         session_id,
         company,
         cliente,
         telefone,
         status,
         total,
         subtotal_produtos,
         desconto,
         taxa_entrega,
         entrega_retirada,
         pagamento,
         confirmado_em,
         atualizado_em,
         client_order_key
       )
       VALUES ($1, $2, $2, $3, $4, $5, $6, 'confirmado', $7, $7, 0, 0, $8, $9, NOW(), NOW(), $10)`,
      [
        pedidoId,
        numeroSequencial,
        `${texto(body.customer_phone) || 'cliente'}_${empresa.slug}`,
        empresa.slug,
        texto(body.customer_name) || 'Cliente do catalogo',
        texto(body.customer_phone),
        subtotalProdutos,
        texto(body.delivery_type),
        texto(body.payment),
        clientOrderKey
      ]
    );

    for (const item of itensCalculados) {
      await client.query(
        `INSERT INTO pedido_itens (
           pedido_id,
           produto,
           product_id,
           nome_produto,
           variant_id,
           variant_title,
           sku,
           variacoes_escolhidas,
           quantidade,
           preco_unitario,
           subtotal
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
        [
          pedidoId,
          item.produto,
          item.product_id,
          item.nome_produto,
          item.variant_id,
          item.variant_title,
          item.sku,
          JSON.stringify(item.variacoes_escolhidas),
          item.quantidade,
          item.preco_unitario,
          item.subtotal
        ]
      );
    }

    const pedidoResult = await client.query(
      `SELECT *
       FROM pedidos
       WHERE pedido_id = $1
       LIMIT 1`,
      [pedidoId]
    );
    const itens = await itensPedido(client, pedidoId);

    await client.query('COMMIT');

    return Response.json({
      success: true,
      order: pedidoPublico(pedidoResult.rows[0], itens)
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    const mensagens = {
      invalid_product: 'Produto invalido.',
      product_unavailable: 'Um item do pedido nao esta disponivel.',
      missing_variation: 'Escolha todas as opcoes do produto.',
      variation_unavailable: 'Esta combinacao nao esta disponivel.',
      out_of_stock: 'Um item do pedido esta sem estoque suficiente.'
    };

    return Response.json(
      {
        error: error.message || 'order_failed',
        message: mensagens[error.message] || 'Nao foi possivel criar o pedido agora. Tente novamente.'
      },
      { status: 400 }
    );
  } finally {
    client.release();
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const company = texto(url.searchParams.get('company'));
  const ids = texto(url.searchParams.get('ids'))
    .split(',')
    .map(texto)
    .filter(Boolean)
    .slice(0, 20);

  if (!company || ids.length === 0) {
    return Response.json({ orders: [] });
  }

  const client = await getPool().connect();

  try {
    const pedidos = await client.query(
      `SELECT *
       FROM pedidos
       WHERE company = $1
         AND pedido_id = ANY($2::text[])
       ORDER BY COALESCE(confirmado_em, criado_em, atualizado_em) DESC`,
      [company, ids]
    );
    const orders = [];

    for (const pedido of pedidos.rows) {
      orders.push(pedidoPublico(pedido, await itensPedido(client, pedido.pedido_id)));
    }

    return Response.json({ orders });
  } finally {
    client.release();
  }
}
