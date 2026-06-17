import { redirect } from 'next/navigation';
import { query } from '../../../../lib/db';
import { getCurrentUser, isTrustedAdminRequest } from '../../../../lib/auth';

const acoes = {
  aceitar: {
    statusPreparo: 'em_preparo',
    campoData: 'preparo_em',
    statusPedido: 'confirmado'
  },
  pronto: {
    statusPreparo: 'pronto',
    campoData: 'pronto_em',
    statusPedido: 'confirmado'
  },
  saiu: {
    statusPreparo: 'saiu_entrega',
    campoData: 'saiu_entrega_em',
    statusPedido: 'confirmado'
  },
  finalizar: {
    statusPreparo: 'finalizado',
    campoData: 'finalizado_em',
    statusPedido: 'finalizado'
  }
};

function moeda(valor) {
  return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
}

function numeroPedido(pedido) {
  return pedido?.numero_dia
    ? String(pedido.numero_dia).padStart(2, '0')
    : '--';
}

function textoItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) {
    return 'Itens nao encontrados';
  }

  return itens
    .map((item) => `• ${item.quantidade || 1}x ${item.produto || 'Produto'} — ${moeda(item.subtotal)}`)
    .join('\n');
}

function textoEntrega(pedido) {
  if (pedido.entrega_retirada !== 'entrega') {
    return 'Entrega: Retirada no local';
  }

  const mapa = pedido.latitude_entrega && pedido.longitude_entrega
    ? `\nLocalizacao: https://www.google.com/maps?q=${pedido.latitude_entrega},${pedido.longitude_entrega}`
    : '';

  return `Entrega: Entrega\nEndereco: ${pedido.endereco || 'nao informado'}${mapa}`;
}

function mensagemCliente(acao, pedido) {
  const numero = numeroPedido(pedido);

  if (acao === 'aceitar') {
    return `Pedido recebido com sucesso ✅

Resumo:
${textoItens(pedido.itens)}

Total: ${moeda(pedido.total)}
Pagamento: ${String(pedido.pagamento || 'nao informado').toUpperCase()}
${textoEntrega(pedido)}

Previsao de preparo: 15 a 50 minutos.`;
  }

  if (acao === 'pronto') {
    if (pedido.entrega_retirada === 'entrega') {
      return `Seu pedido #${numero} está pronto 😊

Estamos aguardando o entregador para sair com o pedido.`;
    }

    return `Seu pedido #${numero} está pronto para retirada 😊

Pode passar na loja para buscar.`;
  }

  if (acao === 'saiu') {
    return `Seu pedido #${numero} saiu para entrega 🛵

Daqui a pouco chega aí.`;
  }

  if (acao === 'finalizar') {
    return 'Pedido finalizado. Obrigado pela preferência 😊';
  }

  return null;
}

async function enviarWhatsApp(empresa, pedido, texto) {
  const baseUrl = String(process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE || empresa.slug;
  const numero = String(pedido.telefone || '').replace(/\D/g, '');

  if (!baseUrl || !apiKey || !instance || !numero || !texto) {
    return;
  }

  try {
    await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: numero,
        text: texto
      })
    });
  } catch {
    // O status do pedido nao deve falhar se o WhatsApp estiver temporariamente indisponivel.
  }
}

export async function POST(request) {
  if (!isTrustedAdminRequest(request)) {
    redirect('/admin');
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect('/admin');
  }

  const formData = await request.formData();
  const pedidoId = String(formData.get('pedido_id') || '').trim();
  const empresaId = Number(formData.get('empresa_id'));
  const acao = String(formData.get('acao') || '').trim();
  const filtro = String(formData.get('filtro') || 'novo').trim();
  const config = acoes[acao];

  if (!pedidoId || !empresaId || !config) {
    redirect('/admin');
  }

  const empresaResult = await query(
    `SELECT id, slug
     FROM catalogo_empresas
     WHERE id = $1
       AND ($2 = 'nexora_admin' OR id = $3)
     LIMIT 1`,
    [empresaId, user.papel, user.empresa_id]
  );

  const empresa = empresaResult.rows[0];

  if (!empresa) {
    redirect('/admin');
  }

  const pedidoResult = await query(
    `SELECT
       p.*,
       COALESCE(itens.itens, '[]'::jsonb) AS itens
     FROM pedidos p
     LEFT JOIN LATERAL (
       SELECT
         jsonb_agg(
           jsonb_build_object(
             'produto', i.produto,
             'quantidade', i.quantidade,
             'preco_unitario', i.preco_unitario,
             'subtotal', i.subtotal
           )
           ORDER BY i.id
         ) AS itens
       FROM pedido_itens i
       WHERE i.pedido_id = p.pedido_id
     ) itens ON true
     WHERE p.pedido_id = $1
       AND p.company = $2
     LIMIT 1`,
    [pedidoId, empresa.slug]
  );

  const pedido = pedidoResult.rows[0];

  if (!pedido) {
    redirect(`/admin?slug=${empresa.slug}&painel=pedidos&pedidos=${filtro}#pedidos`);
  }

  await query(
    `UPDATE pedidos
     SET
       status = $3,
       status_preparo = $4,
       ${config.campoData} = COALESCE(${config.campoData}, NOW()),
       atualizado_em = NOW()
     WHERE pedido_id = $1
       AND company = $2`,
    [pedidoId, empresa.slug, config.statusPedido, config.statusPreparo]
  );

  await enviarWhatsApp(empresa, pedido, mensagemCliente(acao, pedido));

  const params = new URLSearchParams();
  params.set('slug', empresa.slug);
  params.set('painel', 'pedidos');
  params.set('pedidos', filtro || config.statusPreparo);

  redirect(`/admin?${params.toString()}#pedidos`);
}
