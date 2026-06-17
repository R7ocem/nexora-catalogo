import { query } from '../../lib/db';
import { money } from '../../lib/format';
import { getCurrentUser } from '../../lib/auth';
import { caminhoCatalogo } from '../../lib/catalog';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const segmentos = {
  alimentacao: 'Alimentação',
  festas_decoracao: 'Festas e decoração',
  moda: 'Moda',
  beleza: 'Beleza',
  saude: 'Saúde',
  educacao: 'Educação',
  servicos_gerais: 'Serviços gerais',
  automotivo: 'Automotivo',
  casa_construcao: 'Casa e construção',
  tecnologia: 'Tecnologia',
  outros: 'Outros'
};

const tiposOferta = {
  produtos: 'Produtos',
  servicos: 'Serviços',
  misto: 'Produtos e serviços'
};

const fundosCatalogo = [
  ['claro', 'Claro'],
  ['escuro', 'Escuro'],
  ['personalizado', 'Personalizado']
];

const diasSemana = [
  ['0', 'Domingo'],
  ['1', 'Segunda'],
  ['2', 'Terça'],
  ['3', 'Quarta'],
  ['4', 'Quinta'],
  ['5', 'Sexta'],
  ['6', 'Sábado']
];

const estadosBrasil = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO'
];

function getCompanyDraft(searchParams) {
  if (!searchParams?.erro) return {};

  const valor = cookies().get('nexora_company_draft')?.value;

  if (!valor) return {};

  try {
    return JSON.parse(valor);
  } catch {
    return {};
  }
}

function getHorariosFuncionamento(valor) {
  const horarios = valor && typeof valor === 'object' ? valor : {};

  return diasSemana.map(([dia, nome]) => ({
    dia,
    nome,
    ativo: Boolean(horarios[dia]?.ativo),
    abre: horarios[dia]?.abre || '08:00',
    fecha: horarios[dia]?.fecha || '18:00'
  }));
}

function getOpcoesPedido(valor) {
  const opcoes = valor && typeof valor === 'object' ? valor : {};

  return {
    retirada: opcoes.retirada !== false,
    entrega: opcoes.entrega !== false,
    pix: opcoes.pix !== false,
    dinheiro: opcoes.dinheiro !== false,
    cartao: opcoes.cartao !== false
  };
}

function variacoesParaTexto(valor) {
  let variacoes = Array.isArray(valor) ? valor : [];

  if (!Array.isArray(valor) && typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);
      variacoes = Array.isArray(parsed) ? parsed : [];
    } catch {
      variacoes = [];
    }
  }

  return variacoes
    .map((grupo) => {
      const nome = String(grupo?.nome || '').trim();
      const valores = Array.isArray(grupo?.valores)
        ? grupo.valores.map((opcao) => String(opcao || '').trim()).filter(Boolean)
        : [];

      return nome && valores.length > 0 ? `${nome}: ${valores.join(', ')}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function rotuloEstoque(status) {
  const rotulos = {
    NORMAL: 'Normal',
    ATENCAO: 'Atenção',
    CRITICO: 'Crítico',
    ESGOTADO: 'Esgotado',
    SEM_CONTROLE: 'Sem controle'
  };

  return rotulos[status] || 'Sem controle';
}

function numeroEstoque(valor, casas = 0) {
  const numero = Number(valor || 0);

  return Number.isFinite(numero) ? numero.toFixed(casas).replace('.', ',') : '0';
}

function statusPedido(pedido) {
  const status = String(pedido?.status_preparo || '').trim();

  if (status) return status;
  if (pedido?.status === 'finalizado') return 'finalizado';
  return 'novo';
}

function rotuloStatusPedido(status) {
  const rotulos = {
    novo: 'Novo',
    em_preparo: 'Em preparo',
    pronto: 'Pronto',
    saiu_entrega: 'Saiu',
    finalizado: 'Finalizado'
  };

  return rotulos[status] || 'Novo';
}

function numeroPedido(pedido) {
  return pedido?.numero_dia
    ? String(pedido.numero_dia).padStart(2, '0')
    : '--';
}

function textoEntregaPedido(pedido) {
  return pedido?.entrega_retirada === 'entrega' ? 'Entrega' : 'Retirada';
}

function mapaPedidoUrl(pedido) {
  if (!pedido?.latitude_entrega || !pedido?.longitude_entrega) return null;

  return `https://www.google.com/maps?q=${pedido.latitude_entrega},${pedido.longitude_entrega}`;
}

function wazePedidoUrl(pedido) {
  if (!pedido?.latitude_entrega || !pedido?.longitude_entrega) return null;

  return `https://waze.com/ul?ll=${pedido.latitude_entrega}%2C${pedido.longitude_entrega}&navigate=yes`;
}

async function getAdminData(user, selectedSlug) {
  const empresasResult = await query(
    `SELECT
       id,
       nome,
       slug,
       whatsapp,
       email_empresa,
       proprietario_nome,
       cpf_cnpj,
       endereco,
       cidade,
       estado,
       ativo,
       bloqueado,
       bloqueado_motivo,
       segmento,
       tipo_oferta,
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
       titulo_publico,
       subtitulo_publico,
       descricao_publica,
       horario_funcionamento,
       opcoes_pedido
     FROM catalogo_empresas
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
    return { empresas, empresa: null, categorias: [], produtos: [], usuarios: [] };
  }

  const categorias = await query(
    `SELECT id, nome
     FROM catalogo_categorias
     WHERE empresa_id = $1
     ORDER BY ordem, nome`,
    [empresa.id]
  );

  const produtos = await query(
    `WITH produtos_base AS (
       SELECT
         p.*,
         c.nome AS categoria_nome,
         c.ordem AS categoria_ordem,
         COALESCE(vendas.total_vendido_14_dias, 0) AS total_vendido_14_dias,
         COALESCE(vendas.dias_com_venda, 0) AS dias_com_venda,
         CASE
           WHEN COALESCE(vendas.dias_com_venda, 0) >= 7 THEN ROUND(COALESCE(vendas.total_vendido_14_dias, 0)::numeric / 14, 2)
           ELSE 0
         END AS average_daily_sales
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
     ),
     produtos_metricas AS (
       SELECT
         *,
         CASE
           WHEN COALESCE(auto_calculate_min_stock, true) = true
             AND dias_com_venda >= 7
             THEN CEIL(average_daily_sales * (COALESCE(replenishment_days, 7) + COALESCE(safety_days, 3)))
           ELSE COALESCE(min_stock, 0)
         END AS stock_minimum_calculated,
         CASE
           WHEN average_daily_sales > 0 THEN ROUND(COALESCE(stock_quantity, 0)::numeric / average_daily_sales, 1)
           ELSE NULL
         END AS days_remaining
       FROM produtos_base
     )
     SELECT
       id,
       codigo,
       nome,
       descricao,
       preco,
       tipo_item,
       tipo_preco,
       frete_texto,
       stock_quantity,
       min_stock,
       track_stock,
       replenishment_days,
       safety_days,
       auto_calculate_min_stock,
       show_when_out_of_stock,
       is_available,
       total_vendido_14_dias,
       dias_com_venda,
       average_daily_sales,
       stock_minimum_calculated,
       days_remaining,
       CASE
         WHEN COALESCE(track_stock, false) = false THEN 'SEM_CONTROLE'
         WHEN COALESCE(stock_quantity, 0) <= 0 THEN 'ESGOTADO'
         WHEN COALESCE(stock_quantity, 0) <= stock_minimum_calculated * 0.5 THEN 'CRITICO'
         WHEN COALESCE(stock_quantity, 0) <= stock_minimum_calculated THEN 'ATENCAO'
         ELSE 'NORMAL'
       END AS stock_status,
       imagem_url,
       ativo,
       destaque,
       destaque_ordem,
       apelidos,
       variacoes,
       categoria_id,
       categoria_nome
     FROM produtos_metricas
     ORDER BY ativo DESC, categoria_ordem, nome`,
    [empresa.id]
  );

  const usuarios = user.papel === 'nexora_admin'
    ? await query(
      `SELECT id, nome, email, papel, ativo, criado_em
       FROM catalogo_usuarios
       WHERE empresa_id = $1
       ORDER BY ativo DESC, nome`,
      [empresa.id]
    )
    : { rows: [] };

  const pedidos = await query(
    `SELECT
       p.pedido_id,
       p.numero_dia,
       p.session_id,
       p.company,
       p.cliente,
       p.telefone,
       p.status,
       p.status_preparo,
       p.total,
       p.entrega_retirada,
       p.endereco,
       p.pagamento,
       p.tempo_preparo_minutos,
       p.confirmado_em,
       p.criado_em,
       p.atualizado_em,
       p.latitude_entrega,
       p.longitude_entrega,
       COALESCE(
         jsonb_agg(
           jsonb_build_object(
             'produto', i.produto,
             'quantidade', i.quantidade,
             'preco_unitario', i.preco_unitario,
             'subtotal', i.subtotal
           )
           ORDER BY i.id
         ) FILTER (WHERE i.id IS NOT NULL),
         '[]'::jsonb
       ) AS itens
     FROM pedidos p
     LEFT JOIN pedido_itens i ON i.pedido_id = p.pedido_id
     WHERE p.company = $1
       AND COALESCE(p.status, 'rascunho') <> 'rascunho'
       AND COALESCE(p.data_pedido, CURRENT_DATE) >= CURRENT_DATE - INTERVAL '7 days'
     GROUP BY
       p.pedido_id,
       p.numero_dia,
       p.session_id,
       p.company,
       p.cliente,
       p.telefone,
       p.status,
       p.status_preparo,
       p.total,
       p.entrega_retirada,
       p.endereco,
       p.pagamento,
       p.tempo_preparo_minutos,
       p.confirmado_em,
       p.criado_em,
       p.atualizado_em,
       p.latitude_entrega,
       p.longitude_entrega
     ORDER BY COALESCE(p.confirmado_em, p.criado_em, p.atualizado_em) DESC
     LIMIT 80`,
    [empresa.slug]
  );

  return {
    empresas,
    empresa,
    categorias: categorias.rows,
    produtos: produtos.rows,
    usuarios: usuarios.rows,
    pedidos: pedidos.rows
  };
}

function Login({ erro, limite }) {
  return (
    <main className="shell admin-shell">
      <section className="panel">
        <h1>Painel Nexora Catálogos</h1>
        <p className="muted">Entre para gerenciar empresas, produtos, serviços e catálogos.</p>

        {erro ? <p className="error-text">Email ou senha inválidos.</p> : null}

        {limite ? (
          <p className="error-text">Muitas tentativas. Aguarde alguns minutos e tente novamente.</p>
        ) : null}

        <form action="/admin/login" method="post" className="admin-form">
          <label>
            Email
            <input name="email" type="email" required />
          </label>

          <label>
            Senha
            <input name="password" type="password" required />
          </label>

          <button className="primary-button" type="submit">
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}

function EmpresaBloqueada({ empresa }) {
  return (
    <main className="shell admin-shell">
      <section className="panel">
        <h1>Painel bloqueado</h1>
        <p className="muted">
          O painel da empresa {empresa.nome} está temporariamente bloqueado.
        </p>
        <p className="muted">Entre em contato com a Nexora para regularizar o acesso.</p>

        <form action="/admin/logout" method="post">
          <button className="secondary-button" type="submit">
            Sair
          </button>
        </form>
      </section>
    </main>
  );
}

export default async function AdminPage({ searchParams }) {
  const user = await getCurrentUser();
  const erro = searchParams?.erro === 'login';
  const limite = searchParams?.erro === 'limite';

  if (!user) {
    return <Login erro={erro} limite={limite} />;
  }

  const selectedSlug = user.papel === 'nexora_admin' ? searchParams?.slug : null;

  const { empresas, empresa, categorias, produtos, usuarios, pedidos } = await getAdminData(
    user,
    selectedSlug
  );

  if (!empresa) {
    return (
      <main className="shell admin-shell">
        <section className="panel">
          <h1>Nenhuma empresa encontrada</h1>
          <p className="muted">Cadastre uma empresa para começar.</p>

          <form action="/admin/logout" method="post">
            <button className="secondary-button" type="submit">
              Sair
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (empresa.bloqueado === true && user.papel !== 'nexora_admin') {
    return <EmpresaBloqueada empresa={empresa} />;
  }

  const isNexoraAdmin = user.papel === 'nexora_admin';
  const nomePublico = empresa.titulo_publico || empresa.nome;
  const linkPublico = caminhoCatalogo(empresa);
  const horariosFuncionamento = getHorariosFuncionamento(empresa.horario_funcionamento);
  const opcoesPedido = getOpcoesPedido(empresa.opcoes_pedido);
  const companyDraft = getCompanyDraft(searchParams);
  const painelPedidosAberto = searchParams?.painel === 'pedidos';
  const filtrosPedidosAtivos = ['novo', 'em_preparo', 'pronto', 'saiu_entrega'];
  const filtrosPedidos = [...filtrosPedidosAtivos, 'finalizado'];
  const filtroSolicitado = String(searchParams?.pedidos || 'novo');
  const filtroPedidos = filtrosPedidos.includes(filtroSolicitado) ? filtroSolicitado : 'novo';
  const pedidosFiltrados = pedidos.filter((pedido) => statusPedido(pedido) === filtroPedidos);
  const contagemPedidos = filtrosPedidos.reduce((acc, status) => {
    acc[status] = pedidos.filter((pedido) => statusPedido(pedido) === status).length;
    return acc;
  }, {});
  const totalPedidosEmAndamento = filtrosPedidosAtivos.reduce(
    (total, status) => total + (contagemPedidos[status] || 0),
    0
  );

  return (
    <main className={`shell admin-shell${painelPedidosAberto ? ' orders-mode' : ''}`}>
      <section className="panel admin-header-panel">
  <div>
    <h1>{isNexoraAdmin ? 'Painel Nexora Catálogos' : `Painel ${nomePublico}`}</h1>

    <p className="muted">
      {isNexoraAdmin
        ? 'Gerencie os catálogos das empresas clientes.'
        : 'Gerencie itens, fotos, preços e disponibilidade.'}
    </p>

    {empresa.bloqueado ? (
      <p className="warning-text">
        Empresa bloqueada. O catálogo público e o painel do cliente estão indisponíveis.
      </p>
    ) : null}
  </div>

  <div className="admin-header-actions">
    {painelPedidosAberto ? (
      <a className="secondary-button" href={`/admin?slug=${empresa.slug}`}>
        Fechar pedidos
      </a>
    ) : (
      <a className="primary-button orders-open-button" href={`/admin?slug=${empresa.slug}&painel=pedidos&pedidos=novo#pedidos`}>
        Administrar pedidos
        <span>{totalPedidosEmAndamento}</span>
      </a>
    )}

    <form action="/admin/logout" method="post">
      <button className="secondary-button" type="submit">
        Sair
      </button>
    </form>
  </div>
</section>

      {painelPedidosAberto ? (
      <section className="panel orders-panel" id="pedidos">
        <div className="section-title-row orders-title-row">
          <div>
            <h2>Pedidos</h2>
            <p>Receba, acompanhe e avance os pedidos sem digitar comandos no WhatsApp.</p>
          </div>
        </div>

        <div className="orders-filters" aria-label="Filtrar pedidos por status">
          {filtrosPedidos.map((status) => (
            <a
              key={status}
              className={filtroPedidos === status ? 'orders-filter active' : 'orders-filter'}
              href={`/admin?slug=${empresa.slug}&painel=pedidos&pedidos=${status}#pedidos`}
            >
              {rotuloStatusPedido(status)}
              <span>{contagemPedidos[status] || 0}</span>
            </a>
          ))}
        </div>

        {pedidosFiltrados.length === 0 ? (
          <p className="muted">Nenhum pedido neste status agora.</p>
        ) : (
          <div className="orders-list">
            {pedidosFiltrados.map((pedido) => {
              const status = statusPedido(pedido);
              const itensPedido = Array.isArray(pedido.itens) ? pedido.itens : [];
              const mapsUrl = mapaPedidoUrl(pedido);
              const wazeUrl = wazePedidoUrl(pedido);
              const isEntrega = pedido.entrega_retirada === 'entrega';

              return (
                <article key={pedido.pedido_id} className={`order-card order-${status}`}>
                  <div className="order-card-header">
                    <div>
                      <span className="order-number">#{numeroPedido(pedido)}</span>
                      <h3>{pedido.cliente || 'Cliente'}</h3>
                      <p>{pedido.telefone || 'Telefone nao informado'}</p>
                    </div>

                    <span className={`order-status-pill status-${status}`}>
                      {rotuloStatusPedido(status)}
                    </span>
                  </div>

                  <div className="order-meta-grid">
                    <div>
                      <span>Total</span>
                      <strong>{money(pedido.total || 0)}</strong>
                    </div>
                    <div>
                      <span>Recebimento</span>
                      <strong>{textoEntregaPedido(pedido)}</strong>
                    </div>
                    <div>
                      <span>Pagamento</span>
                      <strong>{pedido.pagamento || 'Nao informado'}</strong>
                    </div>
                  </div>

                  <div className="order-items">
                    <strong>Resumo</strong>
                    {itensPedido.length > 0 ? (
                      <ul>
                        {itensPedido.map((item, index) => (
                          <li key={`${pedido.pedido_id}-${index}`}>
                            <span>{item.quantidade || 1}x {item.produto || 'Produto'}</span>
                            <strong>{money(item.subtotal || 0)}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">Itens nao encontrados.</p>
                    )}
                  </div>

                  {isEntrega ? (
                    <div className="order-address">
                      <strong>Endereco</strong>
                      <p>{pedido.endereco || 'Endereco nao informado'}</p>

                      <div className="order-map-actions">
                        {mapsUrl ? (
                          <a href={mapsUrl} target="_blank" rel="noreferrer">
                            Abrir Maps
                          </a>
                        ) : null}
                        {wazeUrl ? (
                          <a href={wazeUrl} target="_blank" rel="noreferrer">
                            Abrir Waze
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="order-actions">
                    {status === 'novo' ? (
                      <form action="/admin/orders/status" method="post">
                        <input type="hidden" name="empresa_id" value={empresa.id} />
                        <input type="hidden" name="pedido_id" value={pedido.pedido_id} />
                        <input type="hidden" name="acao" value="aceitar" />
                        <input type="hidden" name="filtro" value={filtroPedidos} />
                        <button className="order-action-button action-accept" type="submit">Aceitar pedido</button>
                      </form>
                    ) : null}

                    {status === 'em_preparo' ? (
                      <form action="/admin/orders/status" method="post">
                        <input type="hidden" name="empresa_id" value={empresa.id} />
                        <input type="hidden" name="pedido_id" value={pedido.pedido_id} />
                        <input type="hidden" name="acao" value="pronto" />
                        <input type="hidden" name="filtro" value={filtroPedidos} />
                        <button className="order-action-button action-ready" type="submit">Pedido pronto</button>
                      </form>
                    ) : null}

                    {status === 'pronto' && isEntrega ? (
                      <form action="/admin/orders/status" method="post">
                        <input type="hidden" name="empresa_id" value={empresa.id} />
                        <input type="hidden" name="pedido_id" value={pedido.pedido_id} />
                        <input type="hidden" name="acao" value="saiu" />
                        <input type="hidden" name="filtro" value={filtroPedidos} />
                        <button className="order-action-button action-delivery" type="submit">Saiu para entrega</button>
                      </form>
                    ) : null}

                    {status === 'pronto' ? (
                      <form action="/admin/orders/status" method="post">
                        <input type="hidden" name="empresa_id" value={empresa.id} />
                        <input type="hidden" name="pedido_id" value={pedido.pedido_id} />
                        <input type="hidden" name="acao" value="voltar_preparo" />
                        <input type="hidden" name="filtro" value="em_preparo" />
                        <button className="order-action-button action-back" type="submit">Voltar para preparo</button>
                      </form>
                    ) : null}

                    {status === 'saiu_entrega' ? (
                      <form action="/admin/orders/status" method="post">
                        <input type="hidden" name="empresa_id" value={empresa.id} />
                        <input type="hidden" name="pedido_id" value={pedido.pedido_id} />
                        <input type="hidden" name="acao" value="voltar_pronto" />
                        <input type="hidden" name="filtro" value="pronto" />
                        <button className="order-action-button action-back" type="submit">Voltar para pronto</button>
                      </form>
                    ) : null}

                    {['pronto', 'saiu_entrega'].includes(status) ? (
                      <form action="/admin/orders/status" method="post">
                        <input type="hidden" name="empresa_id" value={empresa.id} />
                        <input type="hidden" name="pedido_id" value={pedido.pedido_id} />
                        <input type="hidden" name="acao" value="finalizar" />
                        <input type="hidden" name="filtro" value={filtroPedidos} />
                        <button className="order-action-button action-finish" type="submit">Finalizar</button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      ) : null}

      <section className="panel">
        <h2>Minha senha</h2>

        {searchParams?.erro === 'senha' ? (
          <p className="error-text">
            A nova senha precisa ter pelo menos 8 caracteres e a confirmação deve ser igual.
          </p>
        ) : null}

        {searchParams?.erro === 'senha_atual' ? (
          <p className="error-text">
            Senha atual incorreta.
          </p>
        ) : null}

        {searchParams?.senha === 'alterada' ? (
          <p className="warning-text">
            Senha alterada com sucesso.
          </p>
        ) : null}

        {searchParams?.senha === 'redefinida' ? (
          <p className="warning-text">
            Senha do usuário redefinida com sucesso.
          </p>
        ) : null}

        <form action="/admin/password" method="post" className="admin-form">
          <label>
            Senha atual
            <input name="senha_atual" type="password" required />
          </label>

          <label>
            Nova senha
            <input name="senha_nova" type="password" required />
          </label>

          <label>
            Confirmar senha
            <input name="confirmar_senha" type="password" required />
          </label>

          <button className="secondary-button" type="submit">
            Alterar senha
          </button>
        </form>
      </section>

      {isNexoraAdmin ? (
        <section className="panel">
          <h2>Acessos da empresa</h2>
          <p className="muted">
            As senhas não podem ser visualizadas. Para ajudar um cliente, defina uma senha temporária.
          </p>


          {usuarios.length > 0 ? (
            <div className="admin-products editable-products">
              {usuarios.map((usuario) => (
                <form
                  key={usuario.id}
                  action="/admin/users/reset"
                  method="post"
                  className="admin-form compact-form"
                >
                  <input type="hidden" name="empresa_id" value={empresa.id} />
                  <input type="hidden" name="usuario_id" value={usuario.id} />

                  <label>
                    Nome do usuario
                    <input name="nome" defaultValue={usuario.nome || ''} required />
                  </label>

                  <label>
                    Email de acesso
                    <input
                      name="email"
                      type="email"
                      defaultValue={usuario.email || ''}
                      required
                    />
                  </label>

                  <label>
                    Nova senha temporaria
                    <input name="senha" type="text" minLength="8" placeholder="Deixe vazio para manter" />
                  </label>

                  <button className="secondary-button" type="submit">
                    Salvar acesso
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <p className="muted">Nenhum acesso cadastrado para esta empresa.</p>
          )}

          {usuarios.length === 0 ? (
            <form action="/admin/users" method="post" className="admin-form compact-form">
              <input type="hidden" name="empresa_id" value={empresa.id} />

              <label>
                Nome do usuario
                <input name="nome" placeholder="Nome de quem vai acessar" required />
              </label>

              <label>
                Email de acesso
                <input
                  name="email"
                  type="email"
                  placeholder="cliente@email.com"
                  required
                />
              </label>

              <label>
                Senha temporaria
                <input name="senha" type="text" minLength="8" placeholder="Minimo 8 caracteres" required />
              </label>

              <button className="primary-button" type="submit">
                Criar acesso
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
      
      {isNexoraAdmin ? (
        <section className="panel">
          <h2>Criar nova empresa</h2>

          {searchParams?.erro === 'email' ? (
            <p className="error-text">Este email já está cadastrado.</p>
          ) : null}

          {searchParams?.erro === 'slug' ? (
            <p className="error-text">Este link de catálogo já está em uso.</p>
          ) : null}

          {searchParams?.erro === 'email_invalido' ? (
            <p className="error-text">Informe um email valido. Exemplo: cliente@email.com.</p>
          ) : null}

          {searchParams?.erro === 'whatsapp' ? (
            <p className="error-text">Informe um WhatsApp valido com DDD. Exemplo: 61999999999.</p>
          ) : null}

          {searchParams?.erro === 'documento' ? (
            <p className="error-text">Informe CPF com 11 digitos ou CNPJ com 14 digitos.</p>
          ) : null}

          {searchParams?.erro === 'empresa' ? (
            <p className="error-text">Preencha todos os dados obrigatorios da empresa.</p>
          ) : null}

          <form action="/admin/companies" method="post" className="admin-form">
            <label>
              Nome da empresa
              <input name="nome" defaultValue={companyDraft.nome || ''} placeholder="Nome do cliente" required />
            </label>

            <label>
              Link do catalogo
              <input name="slug" defaultValue={companyDraft.slug || ''} placeholder="ex: viva-festas" />
            </label>

            <label>
              Nome do Proprietario da empresa
              <input name="proprietario_nome" defaultValue={companyDraft.proprietario_nome || ''} placeholder="Nome completo" required />
            </label>

            <label>
              CPF/CNPJ
              <input
                name="documento"
                defaultValue={companyDraft.documento || ''}
                inputMode="numeric"
                minLength="11"
                maxLength="18"
                pattern="(?:\D*\d\D*){11}|(?:\D*\d\D*){14}"
                title="Informe CPF com 11 digitos ou CNPJ com 14 digitos."
                placeholder="CPF ou CNPJ"
                required
              />
            </label>

            <label>
              Endereco
              <input name="endereco" defaultValue={companyDraft.endereco || ''} placeholder="Rua, numero e bairro" required />
            </label>

            <label>
              Cidade
              <input name="cidade" defaultValue={companyDraft.cidade || ''} placeholder="Cidade" required />
            </label>

            <label>
              Estado
              <select name="estado" defaultValue={companyDraft.estado || ''} required>
                <option value="">UF</option>
                {estadosBrasil.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </label>

            <label>
              WhatsApp
              <input
                name="whatsapp"
                inputMode="numeric"
                minLength="10"
                maxLength="15"
                pattern="\d{10,15}"
                title="Informe apenas numeros, com DDD. Exemplo: 61999999999"
                defaultValue={companyDraft.whatsapp || ''}
                placeholder="DDD + numero. Ex: 61999999999"
                required
              />
            </label>
            
            <label>
              Email de acesso
              <input
                name="usuario_email"
                type="email"
                defaultValue={companyDraft.usuario_email || ''}
                placeholder="cliente@email.com"
                required
              />
            </label>
            
            <label>
              Senha temporaria
              <input name="usuario_senha" type="text" defaultValue={companyDraft.usuario_senha || ''} placeholder="Senha inicial do cliente" required />
            </label>
            <button className="primary-button" type="submit">
              Criar empresa e acesso
            </button>
          </form>
        </section>
      ) : null}

     <section className="panel" id="empresa">
        <h2>Empresa</h2>
    
      {isNexoraAdmin ? (
        <form method="get" action="/admin" className="admin-form compact-form">
          <label>
            Escolher empresa
            <select name="slug" defaultValue={empresa.slug}>
              {empresas.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.nome}
                  {item.bloqueado ? ' - bloqueada' : ''}
                </option>
              ))}
            </select>
          </label>
    
          <button className="secondary-button" type="submit">
            Abrir
          </button>
        </form>
      ) : null}
    
      <div className="company-summary">
        <div>
          <span>Segmento</span>
          <strong>{segmentos[empresa.segmento] || empresa.segmento}</strong>
        </div>
    
        <div>
          <span>Oferta</span>
          <strong>{tiposOferta[empresa.tipo_oferta] || empresa.tipo_oferta}</strong>
        </div>

        <div>
          <span>Link publico</span>
          <strong>{linkPublico}</strong>
        </div>
    
      </div>

      {searchParams?.erro === 'whatsapp' ? (
        <p className="error-text">Informe um WhatsApp valido com DDD. Exemplo: 61999999999.</p>
      ) : null}

      {searchParams?.erro === 'email_invalido' ? (
        <p className="error-text">Informe um email valido. Exemplo: cliente@email.com.</p>
      ) : null}

      {searchParams?.erro === 'documento' ? (
        <p className="error-text">Informe CPF com 11 digitos ou CNPJ com 14 digitos.</p>
      ) : null}

      {searchParams?.erro === 'excluir_empresa' ? (
        <p className="error-text">Para excluir, a empresa precisa estar bloqueada e a confirmacao deve ser EXCLUIR.</p>
      ) : null}

      {searchParams?.empresa === 'excluida' ? (
        <p className="warning-text">Empresa excluida com sucesso.</p>
      ) : null}
    
      <form id={`company-edit-form-${empresa.id}`} action="/admin/company" method="post" className="admin-form company-edit-form">
        <input type="hidden" name="empresa_id" value={empresa.id} />

        {isNexoraAdmin ? (
          <>
            <h3>Dados cadastrais</h3>

            <label>
              Proprietario
              <input name="proprietario_nome" defaultValue={empresa.proprietario_nome || ''} placeholder="Nome completo" />
            </label>

            <label>
              CPF/CNPJ
              <input
                name="cpf_cnpj"
                defaultValue={empresa.cpf_cnpj || ''}
                inputMode="numeric"
                minLength="11"
                maxLength="18"
                pattern="(?:\D*\d\D*){11}|(?:\D*\d\D*){14}"
                title="Informe CPF com 11 digitos ou CNPJ com 14 digitos."
                placeholder="CPF ou CNPJ"
              />
            </label>

            <label>
              Endereco
              <input name="endereco" defaultValue={empresa.endereco || ''} placeholder="Rua, numero e bairro" />
            </label>

            <label>
              Cidade
              <input name="cidade" defaultValue={empresa.cidade || ''} placeholder="Cidade" />
            </label>

            <label>
              Estado
              <select name="estado" defaultValue={empresa.estado || ''}>
                <option value="">UF</option>
                {estadosBrasil.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <input type="hidden" name="proprietario_nome" value={empresa.proprietario_nome || ''} />
            <input type="hidden" name="cpf_cnpj" value={empresa.cpf_cnpj || ''} />
            <input type="hidden" name="endereco" value={empresa.endereco || ''} />
            <input type="hidden" name="cidade" value={empresa.cidade || ''} />
            <input type="hidden" name="estado" value={empresa.estado || ''} />
          </>
        )}
    
        <label>
          Nome da empresa
          <input name="nome" defaultValue={empresa.nome || ''} required />
        </label>
    
        <label>
          WhatsApp
          <input
            name="whatsapp"
            defaultValue={empresa.whatsapp || ''}
            inputMode="numeric"
            minLength="10"
            maxLength="15"
            placeholder="DDD + numero. Ex: 61999999999"
            required
          />
        </label>

        <label>
          Email da empresa
          <input
            name="email_empresa"
            type="email"
            defaultValue={empresa.email_empresa || ''}
            placeholder="contato@empresa.com"
          />
        </label>
    
        <label>
          Segmento
          <select name="segmento" defaultValue={empresa.segmento || 'outros'}>
            <option value="alimentacao">Alimentação</option>
            <option value="festas_decoracao">Festas e decoração</option>
            <option value="moda">Moda</option>
            <option value="beleza">Beleza</option>
            <option value="saude">Saúde</option>
            <option value="educacao">Educação</option>
            <option value="servicos_gerais">Serviços gerais</option>
            <option value="automotivo">Automotivo</option>
            <option value="casa_construcao">Casa e construção</option>
            <option value="tecnologia">Tecnologia</option>
            <option value="outros">Outros</option>
          </select>
        </label>
    
        <label>
          Tipo de oferta
          <select name="tipo_oferta" defaultValue={empresa.tipo_oferta || 'produtos'}>
            <option value="produtos">Produtos</option>
            <option value="servicos">Serviços</option>
            <option value="misto">Produtos e serviços</option>
          </select>
        </label>
    
        <label>
          Título público
          <input name="titulo_publico" defaultValue={empresa.titulo_publico || empresa.nome || ''} />
        </label>
    
        <label>
          Subtítulo público
          <input name="subtitulo_publico" defaultValue={empresa.subtitulo_publico || ''} />
        </label>

        <label>
          Instagram
          <input name="instagram_url" defaultValue={empresa.instagram_url || ''} placeholder="@sua_loja ou link completo" />
        </label>
    
        <label className="full-span">
          Descrição da empresa
          <textarea
            name="descricao_publica"
            defaultValue={empresa.descricao_publica || ''}
            placeholder="Conte um pouco sobre a empresa, história, diferenciais ou informações importantes para o cliente."
          />
        </label>
    
        <div className="full-span theme-builder">
          <div>
            <span className="field-title">Sistema de cores</span>
            <small className="media-hint">Escolha duas cores para criar um visual com gradiente tecnológico no catálogo.</small>
          </div>

          <div className="theme-grid">
            <label>
              Cor principal
              <input name="tema_cor" type="color" defaultValue={empresa.tema_cor || '#0f766e'} />
            </label>

            <label>
              Cor secundária
              <input name="tema_cor_secundaria" type="color" defaultValue={empresa.tema_cor_secundaria || '#14b8a6'} />
            </label>

            <label className="checkbox-field">
              <input name="usar_gradiente" type="checkbox" defaultChecked={empresa.usar_gradiente !== false} />
              Usar gradiente no catálogo
            </label>
          </div>

          <div
            className="theme-preview"
            style={{
              background: empresa.usar_gradiente === false
                ? (empresa.tema_cor || '#0f766e')
                : `linear-gradient(135deg, ${empresa.tema_cor || '#0f766e'}, ${empresa.tema_cor_secundaria || '#14b8a6'})`
            }}
          >
            Prévia do tema
          </div>
        </div>

        <div className="full-span admin-options-panel">
          <span className="field-title">Fundo do catalogo</span>
          <small className="media-hint">Escolha um fundo claro, escuro ou uma cor personalizada para a tela do cliente.</small>

          <div className="theme-grid">
            <label>
              Tipo de fundo
              <select name="catalogo_fundo_tipo" defaultValue={empresa.catalogo_fundo_tipo || 'claro'}>
                {fundosCatalogo.map(([valor, label]) => (
                  <option key={valor} value={valor}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Cor personalizada
              <input name="catalogo_fundo_cor" type="color" defaultValue={empresa.catalogo_fundo_cor || '#f7f4ef'} />
            </label>
          </div>
        </div>

        <div className="full-span admin-options-panel">
          <span className="field-title">Horários de funcionamento</span>
          <small className="media-hint">Marque os dias de atendimento. O catálogo mostra Aberto ou Fechado automaticamente.</small>

          <div className="hours-grid">
            {horariosFuncionamento.map((horario) => (
              <div key={horario.dia} className="hours-row">
                <label className="checkbox-field">
                  <input name={`dia_${horario.dia}_ativo`} type="checkbox" defaultChecked={horario.ativo} />
                  {horario.nome}
                </label>

                <input name={`dia_${horario.dia}_abre`} type="time" defaultValue={horario.abre} />
                <input name={`dia_${horario.dia}_fecha`} type="time" defaultValue={horario.fecha} />
              </div>
            ))}
          </div>
        </div>

        <div className="full-span admin-options-panel">
          <span className="field-title">Opções do pedido</span>
          <small className="media-hint">O cliente escolhe antes de enviar o pedido pelo WhatsApp.</small>

          <div className="option-checks">
            <label className="checkbox-field">
              <input name="pedido_retirada" type="checkbox" defaultChecked={opcoesPedido.retirada} />
              Retirada
            </label>

            <label className="checkbox-field">
              <input name="pedido_entrega" type="checkbox" defaultChecked={opcoesPedido.entrega} />
              Entrega
            </label>

            <label className="checkbox-field">
              <input name="pagamento_pix" type="checkbox" defaultChecked={opcoesPedido.pix} />
              Pix
            </label>

            <label className="checkbox-field">
              <input name="pagamento_dinheiro" type="checkbox" defaultChecked={opcoesPedido.dinheiro} />
              Dinheiro
            </label>

            <label className="checkbox-field">
              <input name="pagamento_cartao" type="checkbox" defaultChecked={opcoesPedido.cartao} />
              Cartão
            </label>
          </div>
        </div>
    
             <div className="full-span company-media-grid">
        <div className="company-media-card">
          <span className="field-title">Logo da empresa</span>
          <small className="media-hint">Ideal: imagem quadrada, 600 x 600 px.</small>

          <input
            type="hidden"
            name="logo_posicao"
            form={`company-edit-form-${empresa.id}`}
            defaultValue="50% 50%"
          />

          {empresa.logo_url ? (
            <div className="media-adjust-frame logo-adjust-frame" data-position-input="logo_posicao">
              <img
                className="company-logo-preview"
                src={empresa.logo_url}
                alt={`Logo ${empresa.nome}`}
                style={{
                  objectPosition: '50% 50%',
                  transform: `scale(${Number(empresa.logo_zoom || 1) || 1})`
                }}
              />
            </div>
          ) : (
            <span className="muted">Nenhuma logo cadastrada.</span>
          )}

          <label className="media-zoom-field">
            Zoom da logo
            <input
              name="logo_zoom"
              data-media-zoom-field="logo_zoom"
              form={`company-edit-form-${empresa.id}`}
              type="range"
              min="1"
              max="2"
              step="0.05"
              defaultValue={empresa.logo_zoom || 1}
            />
          </label>
      
       <div className="photo-actions">
          <label className="secondary-button photo-button">
            {empresa.logo_url ? 'Escolher nova logo' : 'Escolher logo'}
            <input
              className="file-hidden"
              type="file"
              name="foto"
              accept="image/*"
              form={`company-logo-form-${empresa.id}`}
            />
          </label>
        
          <button
            className="primary-button"
            type="submit"
            form={`company-logo-form-${empresa.id}`}
          >
            Salvar logo
          </button>
        
          {empresa.logo_url ? (
            <button
              className="danger-button"
              type="submit"
              form={`company-logo-delete-form-${empresa.id}`}
            >
             Excluir logo
            </button>
          ) : null}
        </div>
      </div>
      
        <div className="company-media-card">
          <span className="field-title">Banner do catálogo</span>
          <small className="media-hint">Ideal: imagem horizontal, 1600 x 600 px ou 1920 x 720 px.</small>
      
          <input
            type="hidden"
            name="banner_posicao"
            form={`company-edit-form-${empresa.id}`}
            defaultValue="50% 50%"
          />

          {empresa.banner_url ? (
            <div className="media-adjust-frame banner-adjust-frame" data-position-input="banner_posicao">
              <img
                className="company-banner-preview"
                src={empresa.banner_url}
                alt={`Banner ${empresa.nome}`}
                style={{
                  objectPosition: '50% 50%',
                  transform: `scale(${Number(empresa.banner_zoom || 1) || 1})`
                }}
              />
            </div>
          ) : (
            <span className="muted">Nenhum banner cadastrado.</span>
          )}

          <label className="media-zoom-field">
            Zoom do banner
            <input
              name="banner_zoom"
              data-media-zoom-field="banner_zoom"
              form={`company-edit-form-${empresa.id}`}
              type="range"
              min="1"
              max="2"
              step="0.05"
              defaultValue={empresa.banner_zoom || 1}
            />
          </label>
      
        <div className="photo-actions">
          <label className="secondary-button photo-button">
            {empresa.banner_url ? 'Escolher novo banner' : 'Escolher banner'}
            <input
              className="file-hidden"
              type="file"
              name="foto"
              accept="image/*"
              form={`company-banner-form-${empresa.id}`}
            />
          </label>
        
          <button
            className="primary-button"
            type="submit"
            form={`company-banner-form-${empresa.id}`}
          >
            Salvar banner
          </button>
        
          {empresa.banner_url ? (
            <button
              className="danger-button"
              type="submit"
              form={`company-banner-delete-form-${empresa.id}`}
            >
              Excluir banner
           </button>
         ) : null}
      </div>
   </div>
 </div>
      
      </form>

       <form id={`company-logo-form-${empresa.id}`} action="/admin/company-media" method="post" encType="multipart/form-data">
       <input type="hidden" name="empresa_id" value={empresa.id} />
       <input type="hidden" name="tipo" value="logo" />
       <input type="hidden" name="logo_posicao" value="50% 50%" />
       <input type="hidden" name="logo_zoom" value={empresa.logo_zoom || 1} />
      </form>
      
       <form id={`company-logo-delete-form-${empresa.id}`} action="/admin/company-media" method="post">
        <input type="hidden" name="empresa_id" value={empresa.id} />
        <input type="hidden" name="tipo" value="logo" />
        <input type="hidden" name="acao" value="excluir" />
      </form>
      
       <form id={`company-banner-form-${empresa.id}`} action="/admin/company-media" method="post" encType="multipart/form-data">
        <input type="hidden" name="empresa_id" value={empresa.id} />
        <input type="hidden" name="tipo" value="banner" />
        <input type="hidden" name="banner_posicao" value="50% 50%" />
        <input type="hidden" name="banner_zoom" value={empresa.banner_zoom || 1} />
      </form>
      
       <form id={`company-banner-delete-form-${empresa.id}`} action="/admin/company-media" method="post">
        <input type="hidden" name="empresa_id" value={empresa.id} />
        <input type="hidden" name="tipo" value="banner" />
        <input type="hidden" name="acao" value="excluir" />
      </form>
          

          <div className="company-action-bar">
            {isNexoraAdmin ? (
              empresa.bloqueado ? (
                <form action="/admin/company-status" method="post">
                  <input type="hidden" name="empresa_id" value={empresa.id} />
                  <input type="hidden" name="acao" value="desbloquear" />
                  <button className="primary-button" type="submit">
                    Desbloquear empresa
                  </button>
                </form>
              ) : (
                <form action="/admin/company-status" method="post">
                  <input type="hidden" name="empresa_id" value={empresa.id} />
                  <input type="hidden" name="acao" value="bloquear" />
                  <button className="danger-button" type="submit">
                    Bloquear por mensalidade
                  </button>
                </form>
              )
            ) : <span />}

            <button className="primary-button" type="submit" form={`company-edit-form-${empresa.id}`}>
              Salvar dados da empresa
            </button>
          </div>
        </section>

        {isNexoraAdmin && empresa.bloqueado ? (
          <section className="panel">
            <h2>Excluir empresa</h2>
            <p className="muted">
              Use somente quando a empresa nao for mais cliente. A exclusao remove empresa, usuarios, categorias, itens e imagens.
            </p>

            <form action="/admin/companies/delete" method="post" className="admin-form compact-form">
              <input type="hidden" name="empresa_id" value={empresa.id} />

              <label>
                Digite EXCLUIR para confirmar
                <input name="confirmar" placeholder="EXCLUIR" required />
              </label>

              <button className="danger-button" type="submit">
                Excluir empresa definitivamente
              </button>
            </form>
          </section>
        ) : null}
      
        <section className="panel" id="categorias">
         <h2>Categorias</h2>

  {searchParams?.erro === 'categoria' ? (
    <p className="error-text">
      Informe o nome da categoria.
    </p>
  ) : null}

  <form action="/admin/categories" method="post" className="admin-form compact-form">
    <input type="hidden" name="empresa_id" value={empresa.id} />
    <input type="hidden" name="acao" value="criar" />

    <label>
      Nova categoria
      <input name="nome" placeholder="Ex: Salgados, Bebidas, Decoração" required />
    </label>

    <button className="primary-button" type="submit">
      Criar categoria
    </button>
  </form>

  {categorias.length === 0 ? (
    <p className="muted">Nenhuma categoria criada ainda.</p>
  ) : (
    <div className="category-admin-list">
      {categorias.map((categoria) => (
        <div key={categoria.id} className="category-admin-item">
          <form action="/admin/categories" method="post" className="category-admin-name">
            <input type="hidden" name="empresa_id" value={empresa.id} />
            <input type="hidden" name="categoria_id" value={categoria.id} />
            <input type="hidden" name="acao" value="renomear" />

            <input name="nome" defaultValue={categoria.nome} required />

            <button className="secondary-button" type="submit">
              Renomear
            </button>
          </form>

          <div className="category-admin-actions">
            <form action="/admin/categories" method="post">
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <input type="hidden" name="categoria_id" value={categoria.id} />
              <input type="hidden" name="acao" value="subir" />

              <button className="secondary-button" type="submit">
                Subir
              </button>
            </form>

            <form action="/admin/categories" method="post">
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <input type="hidden" name="categoria_id" value={categoria.id} />
              <input type="hidden" name="acao" value="descer" />

              <button className="secondary-button" type="submit">
                Descer
              </button>
            </form>

            <form action="/admin/categories" method="post">
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <input type="hidden" name="categoria_id" value={categoria.id} />
              <input type="hidden" name="acao" value="excluir" />

              <button className="danger-button" type="submit">
                Excluir
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  )}
</section>

      <section className="panel" id="novo-item">
        <h2>Novo item</h2>

        {searchParams?.erro === 'preco' ? (
         <p className="error-text">
           Informe o preço quando o tipo de preço for Preço fixo ou A partir de.
         </p>
        ) : null}

          <form action="/admin/products" method="post" className="admin-form product-form" encType="multipart/form-data">
          <input type="hidden" name="empresa_id" value={empresa.id} />

          <label>
            Código
            <input name="codigo" placeholder="code prod" required />
          </label>

          <label>
            Nome
            <input name="nome" placeholder="Produto/serviço" required />
          </label>

          <label>
            Categoria
            <select name="categoria_id" defaultValue="">
              <option value="">Sem categoria</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            Preço
            <input name="preco" placeholder="50.00" />
          </label>

           <label>
            Tipo do item
            <select name="tipo_item" defaultValue="produto">
              <option value="produto">Produto</option>
              <option value="servico">Serviço</option>
              <option value="pacote">Pacote/Combo</option>
            </select>
          </label>

          <label>
            Tipo de preço
            <select name="tipo_preco" defaultValue="fixo">
              <option value="fixo">Preço fixo</option>
              <option value="a_partir_de">A partir de</option>
              <option value="sob_consulta">Sob consulta</option>
            </select>
          </label>

          <label>
            Frete no card
            <input name="frete_texto" placeholder="Ex: Frete grátis" />
          </label>

          <div className="full-span inventory-fields">
            <label className="checkbox-field">
              <input name="track_stock" type="checkbox" />
              Controlar estoque
            </label>

            <label>
              Quantidade em estoque
              <input name="stock_quantity" type="number" min="0" step="1" defaultValue="0" />
            </label>

            <label>
              Estoque minimo para alerta
              <input name="min_stock" type="number" min="0" step="1" defaultValue="0" />
            </label>

            <label>
              Dias para reposicao
              <input name="replenishment_days" type="number" min="1" step="1" defaultValue="7" />
            </label>

            <label>
              Dias de seguranca
              <input name="safety_days" type="number" min="0" step="1" defaultValue="3" />
            </label>

            <label className="checkbox-field">
              <input name="auto_calculate_min_stock" type="checkbox" defaultChecked />
              Calcular minimo inteligente
            </label>

            <label className="checkbox-field">
              <input name="show_when_out_of_stock" type="checkbox" defaultChecked />
              Mostrar produto quando esgotado
            </label>
          </div>
          <div className="full-span photo-editor">
            <span className="field-title">Foto do item</span>
          
          <div className="photo-actions">
            <label className="photo-primary-button photo-button">
              Adicionar foto
              <input className="file-hidden photo-file-name-input" type="file" name="foto" accept="image/*" />
            </label>
          
            <span className="photo-file-name muted">Nenhuma foto selecionada.</span>
          </div>
          
            <input type="hidden" name="imagem_url" />
          </div>

          <label className="full-span">
            Descrição
            <textarea name="descricao" placeholder="Descrição curta do item" />
          </label>

          <label className="full-span">
            Variações
            <textarea
              name="variacoes_texto"
              placeholder="Digite as opções que o cliente poderá escolher"
            />
            <small className="media-hint">
              Uma variação por linha. Exemplo: Cor: Vermelho, Azul, Dourado
            </small>
          </label>

          <label className="full-span">
            Apelidos para o bot
            <input name="apelidos" placeholder="Opcional. Se vazio, usa o nome do item" />
          </label>

           <label>
            Ativo
            <input name="ativo" type="checkbox" defaultChecked />
          </label>

          <label className="checkbox-field">
            <input name="destaque" type="checkbox" />
            Mostrar nos destaques
          </label>

          <label>
            Posicao no destaque
            <select name="destaque_ordem" defaultValue="0">
              <option value="0">Automatico</option>
              <option value="1">Primeiro</option>
              <option value="2">Segundo</option>
              <option value="3">Terceiro</option>
              <option value="4">Quarto</option>
              <option value="5">Quinto</option>
              <option value="6">Sexto</option>
            </select>
          </label>

          <button className="primary-button" type="submit">
            Salvar item
          </button>
        </form>
      </section>

     <section className="panel" id="itens">
        <h2>Itens cadastrados</h2>
      
        {produtos.length === 0 ? (
          <p className="muted">Nenhum item cadastrado ainda.</p>
        ) : (
          <div className="admin-products editable-products">
            {produtos.map((produto) => (
              <div key={produto.id} className="admin-product-edit-wrap">
                <span
                  className={`stock-card-dot stock-${produto.stock_status || 'SEM_CONTROLE'}`}
                  title={`Estoque: ${rotuloEstoque(produto.stock_status)}`}
                />

                <form
                  action="/admin/products"
                  method="post"
                  className="photo-form"
                  encType="multipart/form-data"
                >
                  <input type="hidden" name="produto_id" value={produto.id} />
                  <input type="hidden" name="empresa_id" value={empresa.id} />
                  <input type="hidden" name="codigo" value={produto.codigo || ''} />
                  <input type="hidden" name="nome" value={produto.nome || ''} />
                  <input type="hidden" name="categoria_id" value={produto.categoria_id || ''} />
                  <input type="hidden" name="preco" value={produto.preco || '0'} />
                  <input type="hidden" name="tipo_item" value={produto.tipo_item || 'produto'} />
                  <input type="hidden" name="tipo_preco" value={produto.tipo_preco || 'fixo'} />
                  <input type="hidden" name="frete_texto" value={produto.frete_texto || ''} />
                  <input type="hidden" name="stock_quantity" value={produto.stock_quantity || 0} />
                  <input type="hidden" name="min_stock" value={produto.min_stock || 0} />
                  <input type="hidden" name="replenishment_days" value={produto.replenishment_days || 7} />
                  <input type="hidden" name="safety_days" value={produto.safety_days || 3} />
                  {produto.track_stock ? <input type="hidden" name="track_stock" value="on" /> : null}
                  {produto.auto_calculate_min_stock !== false ? (
                    <input type="hidden" name="auto_calculate_min_stock" value="on" />
                  ) : null}
                  {produto.show_when_out_of_stock !== false ? (
                    <input type="hidden" name="show_when_out_of_stock" value="on" />
                  ) : null}
                  {produto.is_available !== false ? <input type="hidden" name="is_available" value="on" /> : null}
                  <input type="hidden" name="descricao" value={produto.descricao || ''} />
                  <input type="hidden" name="variacoes_texto" value={variacoesParaTexto(produto.variacoes)} />
                  <input type="hidden" name="apelidos" value={produto.apelidos || ''} />
                  <input type="hidden" name="imagem_url" value={produto.imagem_url || ''} />
                  {produto.ativo ? <input type="hidden" name="ativo" value="on" /> : null}
                  {produto.destaque ? <input type="hidden" name="destaque" value="on" /> : null}
                  <input type="hidden" name="destaque_ordem" value={produto.destaque_ordem || 0} />
      
                  <div className="photo-editor">
                    <span className="field-title">Foto do item</span>
      
                    {produto.imagem_url ? (
                      <img className="admin-image-preview" src={produto.imagem_url} alt={produto.nome} />
                    ) : (
                      <span className="muted">Nenhuma foto cadastrada.</span>
                    )}
      
                    <div className="photo-actions">
                      <label className="photo-primary-button photo-button">
                        {produto.imagem_url ? 'Trocar foto' : 'Adicionar foto'}
                        <input className="file-hidden photo-auto-submit" type="file" name="foto" accept="image/*" />
                      </label>

                    <button className="file-hidden photo-submit-button" type="submit">
                      Salvar foto
                    </button>
      
                      {produto.imagem_url ? (
                        <button
                          className="danger-button"
                          type="submit"
                          name="remover_imagem"
                          value="1"
                        >
                          Excluir foto
                        </button>
                      ) : null}
                    </div>
                  </div>
                </form>
      
                <form
                  action="/admin/products"
                  method="post"
                  className="admin-product-edit product-form"
                >
                  <input type="hidden" name="produto_id" value={produto.id} />
                  <input type="hidden" name="empresa_id" value={empresa.id} />
                  <input type="hidden" name="imagem_url" value={produto.imagem_url || ''} />
      
                  <div className="edit-grid">
                    <label>
                      Código
                      <input name="codigo" defaultValue={produto.codigo || ''} required />
                    </label>
      
                    <label>
                      Nome
                      <input name="nome" defaultValue={produto.nome || ''} required />
                    </label>
      
                    <label>
                      Categoria
                      <select name="categoria_id" defaultValue={produto.categoria_id || ''}>
                        <option value="">Sem categoria</option>
                        {categorias.map((categoria) => (
                          <option key={categoria.id} value={categoria.id}>
                            {categoria.nome}
                          </option>
                        ))}
                      </select>
                    </label>
      
                    <label>
                      Preço
                      <input name="preco" defaultValue={produto.preco || '0'} />
                    </label>
      
                    <label>
                      Tipo do item
                      <select name="tipo_item" defaultValue={produto.tipo_item || 'produto'}>
                        <option value="produto">Produto</option>
                        <option value="servico">Serviço</option>
                        <option value="pacote">Pacote/Combo</option>
                      </select>
                    </label>
      
                    <label>
                      Tipo de preço
                      <select name="tipo_preco" defaultValue={produto.tipo_preco || 'fixo'}>
                        <option value="fixo">Preço fixo</option>
                        <option value="a_partir_de">A partir de</option>
                        <option value="sob_consulta">Sob consulta</option>
                      </select>
                    </label>

                    <label>
                      Frete no card
                      <input name="frete_texto" defaultValue={produto.frete_texto || ''} placeholder="Ex: Frete grátis" />
                    </label>
      
                    <div className="full-span inventory-fields">
                      <label className="checkbox-field">
                        <input name="track_stock" type="checkbox" defaultChecked={produto.track_stock === true} />
                        Controlar estoque
                      </label>

                      <label>
                        Quantidade em estoque
                        <input
                          name="stock_quantity"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={produto.stock_quantity || 0}
                        />
                      </label>

                      <label>
                        Estoque minimo para alerta
                        <input
                          name="min_stock"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={produto.min_stock || 0}
                        />
                      </label>

                      <label>
                        Dias para reposicao
                        <input
                          name="replenishment_days"
                          type="number"
                          min="1"
                          step="1"
                          defaultValue={produto.replenishment_days || 7}
                        />
                      </label>

                      <label>
                        Dias de seguranca
                        <input
                          name="safety_days"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={produto.safety_days || 3}
                        />
                      </label>

                      <label className="checkbox-field">
                        <input
                          name="auto_calculate_min_stock"
                          type="checkbox"
                          defaultChecked={produto.auto_calculate_min_stock !== false}
                        />
                        Calcular minimo inteligente
                      </label>

                      <label className="checkbox-field">
                        <input
                          name="show_when_out_of_stock"
                          type="checkbox"
                          defaultChecked={produto.show_when_out_of_stock !== false}
                        />
                        Mostrar produto quando esgotado
                      </label>
                    </div>

                    <div className="full-span smart-stock-summary">
                      <div className="smart-stock-status">
                        <span className={`stock-dot stock-${produto.stock_status || 'SEM_CONTROLE'}`} />
                        <strong>{rotuloEstoque(produto.stock_status)}</strong>
                      </div>

                      <div>
                        <span>Estoque atual</span>
                        <strong>{numeroEstoque(produto.stock_quantity)} un.</strong>
                      </div>

                      <div>
                        <span>Minimo recomendado</span>
                        <strong>{numeroEstoque(produto.stock_minimum_calculated)} un.</strong>
                      </div>

                      <div>
                        <span>Media diaria</span>
                        <strong>{numeroEstoque(produto.average_daily_sales, 2)} un./dia</strong>
                      </div>

                      <div>
                        <span>Dias restantes</span>
                        <strong>
                          {produto.days_remaining === null || produto.days_remaining === undefined
                            ? 'Sem historico'
                            : `${numeroEstoque(produto.days_remaining, 1)} dias`}
                        </strong>
                      </div>
                    </div>

                    <label className="full-span">
                      Descrição
                      <textarea name="descricao" defaultValue={produto.descricao || ''} />
                    </label>

                    <label className="full-span">
                      Variações
                      <textarea
                        name="variacoes_texto"
                        defaultValue={variacoesParaTexto(produto.variacoes)}
                        placeholder="Digite as opções que o cliente poderá escolher"
                      />
                      <small className="media-hint">
                        Uma variação por linha. Exemplo: Cor: Vermelho, Azul, Dourado
                      </small>
                    </label>
      
                    <label className="full-span">
                      Apelidos para o bot
                      <input name="apelidos" defaultValue={produto.apelidos || produto.nome || ''} placeholder="Opcional. Se vazio, usa o nome do item" />
                    </label>
      
                    <label>
                      Ativo
                      <input name="ativo" type="checkbox" defaultChecked={produto.ativo} />
                    </label>

                    <label className="checkbox-field">
                      <input name="destaque" type="checkbox" defaultChecked={produto.destaque} />
                      Mostrar nos destaques
                    </label>

                    <label>
                      Posicao no destaque
                      <select name="destaque_ordem" defaultValue={String(Math.min(6, Math.max(0, Number(produto.destaque_ordem || 0))))}>
                        <option value="0">Automatico</option>
                        <option value="1">Primeiro</option>
                        <option value="2">Segundo</option>
                        <option value="3">Terceiro</option>
                        <option value="4">Quarto</option>
                        <option value="5">Quinto</option>
                        <option value="6">Sexto</option>
                      </select>
                    </label>
                  </div>
      
                  <div className="admin-actions-row">
                    <button className="primary-button" type="submit">
                      Salvar alterações
                    </button>
      
                    <span className={produto.ativo ? 'status-pill active' : 'status-pill'}>
                      {produto.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </form>
      
                <form action="/admin/products/delete" method="post" className="delete-product-form admin-actions-row">
                  <input type="hidden" name="produto_id" value={produto.id} />
                  <input type="hidden" name="empresa_id" value={empresa.id} />
                  <button className="danger-button" type="submit">
                    Excluir item
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
                <script
        dangerouslySetInnerHTML={{
          __html: `
            document.querySelectorAll('.product-form').forEach(function (form) {
              var tipoPreco = form.querySelector('[name="tipo_preco"]');
              var preco = form.querySelector('[name="preco"]');

              if (!tipoPreco || !preco) return;

              function atualizarObrigatorio() {
                if (tipoPreco.value === 'sob_consulta') {
                  preco.required = false;
                  preco.setCustomValidity('');
                } else {
                  preco.required = true;
                }
              }

              tipoPreco.addEventListener('change', atualizarObrigatorio);

              form.addEventListener('submit', function (event) {
                atualizarObrigatorio();

                var valor = Number(String(preco.value || '').replace(',', '.'));

                if (tipoPreco.value !== 'sob_consulta' && (!preco.value || valor <= 0)) {
                  event.preventDefault();
                  preco.setCustomValidity('Informe o preço para preço fixo ou a partir de.');
                  preco.reportValidity();
                  return;
                }

                preco.setCustomValidity('');
              });

              atualizarObrigatorio();
            });

            document.querySelectorAll('.photo-auto-submit').forEach(function (input) {
              input.addEventListener('change', function () {
                if (!input.files || input.files.length === 0) return;

               var form = input.closest('form');
                if (!form) return;
                
                var submitButton = form.querySelector('.photo-submit-button');
                if (submitButton) {
                  submitButton.click();
                }
              });
            });
          
                    document.querySelectorAll('.photo-file-name-input').forEach(function (input) {
                      input.addEventListener('change', function () {
                        var label = input.closest('.photo-actions')?.querySelector('.photo-file-name');
              
                        if (!label) return;
              
                        if (input.files && input.files.length > 0) {
                          label.textContent = 'Foto selecionada: ' + input.files[0].name;
                        } else {
                          label.textContent = 'Nenhuma foto selecionada.';
                        }
                      });
                    });
          
                    document.querySelectorAll('.company-media-auto-submit').forEach(function (input) {
            input.addEventListener('change', function () {
              if (!input.files || input.files.length === 0) return;
          
              var formId = input.getAttribute('form');
              var form = formId ? document.getElementById(formId) : null;
              var button = input.closest('.photo-button');
          
              if (button) {
                button.textContent = 'Enviando imagem...';
              }
          
              if (form) {
                form.requestSubmit();
              }
            });
          });

          document.querySelectorAll('.company-media-card').forEach(function (card) {
            var zoomInput = card.querySelector('[data-media-zoom-field]');
            var zoomName = zoomInput ? zoomInput.name : '';

            function image() {
              return card.querySelector('img');
            }

            function syncFields(name, value) {
              if (!name) return;

              document.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
                input.value = value;
              });
            }

            function applyZoom() {
              var preview = image();
              if (!preview || !zoomInput) return;

              preview.style.objectPosition = '50% 50%';
              preview.style.transform = 'scale(' + (zoomInput.value || '1') + ')';
              syncFields(zoomName, zoomInput.value || '1');
            }

            if (zoomInput) {
              zoomInput.addEventListener('input', applyZoom);
              applyZoom();
            }
          });
          
          document.querySelectorAll('.company-media-card input[type="file"]').forEach(function (input) {
            input.addEventListener('change', function () {
              if (!input.files || input.files.length === 0) return;
          
              var file = input.files[0];
              var card = input.closest('.company-media-card');
          
              if (!card || !file.type.startsWith('image/')) return;
          
              var frame = card.querySelector('.media-adjust-frame');
              var preview = card.querySelector('img');
              var emptyText = card.querySelector('.muted');
              var url = URL.createObjectURL(file);
          
              if (!preview) {
                preview = document.createElement('img');
                preview.className = card.textContent.includes('Banner') ? 'company-banner-preview' : 'company-logo-preview';
                preview.alt = 'Prévia da imagem';
                if (!frame) {
                  frame = document.createElement('div');
                  frame.className = card.textContent.includes('Banner')
                    ? 'media-adjust-frame banner-adjust-frame'
                    : 'media-adjust-frame logo-adjust-frame';
                  card.insertBefore(frame, card.querySelector('.media-zoom-field'));
                }

                frame.appendChild(preview);
              }
          
              preview.src = url;
          
              if (emptyText) {
                emptyText.style.display = 'none';
              }
            });
          });                    
         `
       }}
      />
   </main>
  );
}
