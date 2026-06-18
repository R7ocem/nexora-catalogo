'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { money } from '../../../lib/format';

function precoTexto(produto) {
  if (produto.tipo_preco === 'sob_consulta') return 'Consultar valor';
  if (produto.tipo_preco === 'a_partir_de') return `A partir de ${money(produto.preco)}`;
  return money(produto.preco);
}

function tipoItemTexto(tipo) {
  if (tipo === 'servico') return 'Serviço';
  if (tipo === 'pacote') return 'Pacote';
  return 'Produto';
}

function itemTemValor(produto) {
  return produto.tipo_preco !== 'sob_consulta';
}

function estoqueDisponivel(produto) {
  return Math.max(0, Math.floor(Number(produto?.stock_quantity || 0)));
}

function produtoControlaEstoque(produto) {
  return produto?.track_stock === true;
}

function produtoEsgotado(produto) {
  return produtoControlaEstoque(produto) && estoqueDisponivel(produto) <= 0;
}

function rotuloEstoqueCatalogo(status) {
  const rotulos = {
    NORMAL: 'Estoque normal',
    ATENCAO: 'Estoque em atenção',
    CRITICO: 'Estoque crítico',
    ESGOTADO: 'Produto esgotado',
    SEM_CONTROLE: 'Estoque sem controle'
  };

  return rotulos[status] || 'Estoque sem controle';
}

function estoqueStatusVisivel(produto) {
  if (!produtoControlaEstoque(produto)) return null;
  return produto.stock_status || (produtoEsgotado(produto) ? 'ESGOTADO' : 'NORMAL');
}

function normalizarVariacoes(valor) {
  const variacoes = valorJson(valor, []);

  if (!Array.isArray(variacoes)) return [];

  return variacoes
    .map((grupo) => {
      const nome = String(grupo?.nome || '').trim();
      const valores = Array.isArray(grupo?.valores)
        ? grupo.valores.map((opcao) => String(opcao || '').trim()).filter(Boolean)
        : [];

      return nome && valores.length > 0 ? { nome, valores } : null;
    })
    .filter(Boolean);
}

function produtoTemVariacoes(produto) {
  return normalizarVariacoes(produto.variacoes).length > 0;
}

function textoVariacoes(escolhas) {
  return Object.entries(escolhas || {})
    .filter(([, valor]) => valor)
    .map(([nome, valor]) => `${nome}: ${valor}`)
    .join(', ');
}

function nomeComVariacoes(item) {
  const detalhes = textoVariacoes(item.variacoes_escolhidas);
  return detalhes ? `${item.nome} (${detalhes})` : item.nome;
}

function chaveCarrinho(produto, escolhas = {}) {
  const partes = Object.entries(escolhas)
    .filter(([, valor]) => valor)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nome, valor]) => `${nome}:${valor}`);

  return `${produto.id}:${partes.join('|')}`;
}

function montarMensagem(empresa, itens, detalhesPedido) {
  const nomeEmpresa = empresa.titulo_publico || empresa.nome;

  const linhas = itens.map((item) => {
    const nomeItem = nomeComVariacoes(item);

    if (itemTemValor(item)) {
      return `${item.quantidade}x ${nomeItem} - ${money(Number(item.preco) * item.quantidade)}`;
    }

    return `${item.quantidade}x ${nomeItem} - Consultar valor`;
  });

  const total = itens.reduce((soma, item) => {
    if (!itemTemValor(item)) return soma;
    return soma + Number(item.preco || 0) * item.quantidade;
  }, 0);

  const temConsulta = itens.some((item) => !itemTemValor(item));

  return [
    `Olá! Vim pelo catálogo da ${nomeEmpresa}.`,
    '',
    'Meu pedido:',
    ...linhas,
    '',
    detalhesPedido?.tipoEntrega ? `Forma de recebimento: ${detalhesPedido.tipoEntrega}` : null,
    detalhesPedido?.pagamento ? `Pagamento: ${detalhesPedido.pagamento}` : null,
    '',
    total > 0 ? `Total aproximado: ${money(total)}` : null,
    temConsulta ? 'Alguns itens estão sob consulta.' : null
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizarInstagramUrl(valor) {
  const instagram = String(valor || '').trim();

  if (!instagram) return '';
  if (/^https?:\/\//i.test(instagram)) return instagram;

  const semArroba = instagram.replace(/^@+/, '');

  if (semArroba.includes('instagram.com')) {
    return `https://${semArroba}`;
  }

  return `https://instagram.com/${semArroba.replace(/^\/+/, '')}`;
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

function getOpcoesPedido(valor) {
  const opcoes = valorJson(valor, {});

  return {
    tiposEntrega: [
      opcoes.retirada !== false ? 'Retirada' : null,
      opcoes.entrega !== false ? 'Entrega' : null
    ].filter(Boolean),
    pagamentos: [
      opcoes.pix !== false ? 'Pix' : null,
      opcoes.dinheiro !== false ? 'Dinheiro' : null,
      opcoes.cartao !== false ? 'Cartão' : null
    ].filter(Boolean)
  };
}

function estaAbertoAgora(valor) {
  const horarios = valorJson(valor, {});
  const agora = new Date();
  const dia = String(agora.getDay());
  const hoje = horarios[dia];

  if (!hoje?.ativo || !hoje.abre || !hoje.fecha) return false;

  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  const [abreHora, abreMinuto] = String(hoje.abre).split(':').map(Number);
  const [fechaHora, fechaMinuto] = String(hoje.fecha).split(':').map(Number);
  const minutosAbre = abreHora * 60 + abreMinuto;
  const minutosFecha = fechaHora * 60 + fechaMinuto;

  if (!Number.isFinite(minutosAbre) || !Number.isFinite(minutosFecha)) return false;

  if (minutosFecha < minutosAbre) {
    return minutosAgora >= minutosAbre || minutosAgora <= minutosFecha;
  }

  return minutosAgora >= minutosAbre && minutosAgora <= minutosFecha;
}

function zoomImagem(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return 1;

  return Math.min(2, Math.max(1, numero));
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="20" r="1.8" fill="currentColor" />
      <circle cx="18" cy="20" r="1.8" fill="currentColor" />
      <path d="M3 4h2.6l2.2 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4l1.5-5.4H7.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6.5 7l.8 13h9.4l.8-13M9 7l.7-3h4.6l.7 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.1 18.9 6 15.6a7.6 7.6 0 1 1 2.7 2.7l-3.6.6Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.1 8.7c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.3.1.5-.1.7l-.4.5c-.1.2-.2.3 0 .6.4.7 1.2 1.6 2.3 2.1.3.2.5.1.6-.1l.6-.7c.2-.2.4-.3.7-.2l1.6.8c.3.1.4.3.4.6 0 .7-.5 1.5-1.1 1.7-.8.3-2.3 0-4.1-1.1-1.8-1.1-3.3-3-3.8-4.8-.3-1 .1-1.4.4-1.6Z" fill="currentColor" />
    </svg>
  );
}

 export default function CatalogoInterativo({ empresa, categorias, semCategoria }) {
  const [carrinho, setCarrinho] = useState([]);
  const [pedidoAberto, setPedidoAberto] = useState(false);
  const [categoriasAberto, setCategoriasAberto] = useState(false);
  const [produtoAberto, setProdutoAberto] = useState(null);
  const [variacoesSelecionadas, setVariacoesSelecionadas] = useState({});
  const [quantidadeProdutoAberto, setQuantidadeProdutoAberto] = useState(1);
  const [tipoEntrega, setTipoEntrega] = useState('');
  const [pagamento, setPagamento] = useState('');
  const [boasVindasAberta, setBoasVindasAberta] = useState(true);
  const categoriasRef = useRef(null);
  const destaquesRef = useRef(null);

  const nomeEmpresa = empresa.titulo_publico || empresa.nome;
  const corPrincipal = empresa.tema_cor || '#0f766e';
  const corSecundaria = empresa.tema_cor_secundaria || '#14b8a6';
  const usarGradiente = empresa.usar_gradiente !== false;
  const catalogoFundoTipo = ['claro', 'escuro', 'personalizado'].includes(empresa.catalogo_fundo_tipo)
    ? empresa.catalogo_fundo_tipo
    : 'claro';
  const catalogoFundoCor = catalogoFundoTipo === 'escuro'
    ? '#000000'
    : catalogoFundoTipo === 'personalizado'
      ? (empresa.catalogo_fundo_cor || '#f7f4ef')
      : '#f7f4ef';
  const logoZoom = zoomImagem(empresa.logo_zoom);
  const bannerZoom = zoomImagem(empresa.banner_zoom);
  const instagramUrl = normalizarInstagramUrl(empresa.instagram_url);
  const estabelecimentoAberto = estaAbertoAgora(empresa.horario_funcionamento);
  const opcoesPedido = getOpcoesPedido(empresa.opcoes_pedido);
  const avisoPersonalizado = Boolean(String(empresa.aviso_titulo || empresa.aviso_texto || '').trim());
  const tituloBoasVindas = empresa.aviso_titulo || `Como pedir na ${nomeEmpresa}`;
  const textoBoasVindas = empresa.aviso_texto || `Escolha seus produtos, adicione ao carrinho e envie seu pedido pelo WhatsApp em poucos segundos.`;
  const imagemBoasVindas = empresa.aviso_imagem_url || empresa.banner_url;

  const categoriasVisiveis = [
    ...categorias.filter((categoria) => categoria.produtos.length > 0),
    ...(semCategoria.length > 0
      ? [{ id: 'sem-categoria', nome: 'Produtos e serviços', produtos: semCategoria }]
      : [])
  ];

  const todosProdutosVisiveis = categoriasVisiveis
    .flatMap((categoria) => categoria.produtos)
    .filter((produto) => produto.ativo !== false);

  const produtosEscolhidosDestaque = todosProdutosVisiveis.filter((produto) => produto.destaque);
  const produtosComPosicaoDestaque = produtosEscolhidosDestaque
    .filter((produto) => Number(produto.destaque_ordem || 0) >= 1 && Number(produto.destaque_ordem || 0) <= 6)
    .sort((a, b) => (Number(a.destaque_ordem || 0) - Number(b.destaque_ordem || 0)) || a.nome.localeCompare(b.nome));
  const produtosDestaqueRestantes = produtosEscolhidosDestaque
    .filter((produto) => Number(produto.destaque_ordem || 0) < 1 || Number(produto.destaque_ordem || 0) > 6)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const produtosDestaque = (produtosEscolhidosDestaque.length > 0
    ? [...produtosComPosicaoDestaque, ...produtosDestaqueRestantes]
    : todosProdutosVisiveis
  ).slice(0, 30);

  useEffect(() => {
  if (!categoriasAberto) return;

  function fecharAoRolar() {
    setCategoriasAberto(false);
  }

  function fecharAoClicarFora(event) {
    if (!categoriasRef.current) return;

    if (!categoriasRef.current.contains(event.target)) {
      setCategoriasAberto(false);
    }
  }

  window.addEventListener('scroll', fecharAoRolar, { passive: true });
  document.addEventListener('mousedown', fecharAoClicarFora);

  return () => {
    window.removeEventListener('scroll', fecharAoRolar);
    document.removeEventListener('mousedown', fecharAoClicarFora);
  };
}, [categoriasAberto]);

  useEffect(() => {
    setVariacoesSelecionadas({});
    setQuantidadeProdutoAberto(1);
  }, [produtoAberto?.id]);

  function adicionar(produto, escolhas = {}, quantidade = 1) {
    if (produtoEsgotado(produto)) return;

    const variacoesProduto = normalizarVariacoes(produto.variacoes);
    const escolhasValidas = variacoesProduto.reduce((acc, grupo) => {
      if (escolhas[grupo.nome]) {
        acc[grupo.nome] = escolhas[grupo.nome];
      }

      return acc;
    }, {});
    const carrinhoKey = chaveCarrinho(produto, escolhasValidas);
    const quantidadeSolicitada = Math.max(1, Math.floor(Number(quantidade) || 1));
    const estoque = estoqueDisponivel(produto);
    const quantidadeFinal = produtoControlaEstoque(produto)
      ? Math.min(quantidadeSolicitada, estoque)
      : quantidadeSolicitada;

    if (quantidadeFinal <= 0) return;

    setCarrinho((atual) => {
      const existente = atual.find((item) => item.carrinho_key === carrinhoKey);

      if (existente) {
        return atual.map((item) =>
          item.carrinho_key === carrinhoKey
            ? {
              ...item,
              quantidade: produtoControlaEstoque(item)
                ? Math.min(item.quantidade + quantidadeFinal, estoqueDisponivel(item))
                : item.quantidade + quantidadeFinal
            }
            : item
        );
      }

      return [
        ...atual,
        {
          ...produto,
          quantidade: quantidadeFinal,
          carrinho_key: carrinhoKey,
          variacoes_escolhidas: escolhasValidas
        }
      ];
    });
  }

  function alterarQuantidade(carrinhoKey, quantidade) {
    if (quantidade <= 0) {
      setCarrinho((atual) => atual.filter((item) => item.carrinho_key !== carrinhoKey));
      return;
    }

    setCarrinho((atual) =>
      atual.map((item) =>
        item.carrinho_key === carrinhoKey
          ? {
            ...item,
            quantidade: produtoControlaEstoque(item)
              ? Math.min(quantidade, estoqueDisponivel(item))
              : quantidade
          }
          : item
      )
    );
  }

  function irParaCategoria(id) {
    if (!id) return;

    setCategoriasAberto(false);

    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  const total = useMemo(() => {
    return carrinho.reduce((soma, item) => {
      if (!itemTemValor(item)) return soma;
      return soma + Number(item.preco || 0) * item.quantidade;
    }, 0);
  }, [carrinho]);

  const quantidadeItens = carrinho.reduce((soma, item) => soma + item.quantidade, 0);
  const whatsapp = String(empresa.whatsapp || '').replace(/\D/g, '');
  const precisaTipoEntrega = opcoesPedido.tiposEntrega.length > 0;
  const precisaPagamento = opcoesPedido.pagamentos.length > 0;
  const pedidoPodeEnviar = carrinho.length > 0
    && (!precisaTipoEntrega || tipoEntrega)
    && (!precisaPagamento || pagamento);
  const mensagem = encodeURIComponent(montarMensagem(empresa, carrinho, { tipoEntrega, pagamento }));
  const whatsappUrl = whatsapp && carrinho.length > 0
    ? `https://wa.me/${whatsapp}?text=${mensagem}`
    : '#';
  const mensagemAjuda = encodeURIComponent(
    `Olá! Não estou conseguindo finalizar meu pedido pelo catálogo ${empresa.titulo_publico || empresa.nome}. Pode me ajudar?`
  );
  const whatsappAjudaUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${mensagemAjuda}`
    : '#';

  function renderProduto(produto) {
    const nomesVariacoes = normalizarVariacoes(produto.variacoes).map((grupo) => grupo.nome);
    const esgotado = produtoEsgotado(produto);
    const stockStatus = estoqueStatusVisivel(produto);

    return (
      <button
        key={produto.id}
        className={esgotado
          ? 'product-card premium-product-card catalog-item-card out-of-stock'
          : 'product-card premium-product-card catalog-item-card'}
        type="button"
        onClick={() => setProdutoAberto(produto)}
      >
        <div className="product-image-wrap">
          {produto.imagem_url ? (
            <img src={produto.imagem_url} alt={produto.nome} />
          ) : (
            <div className="product-placeholder">Sem foto</div>
          )}
        </div>

        <div className="product-info">
          <div className="product-title-row">
            <h3>{produto.nome}</h3>
          </div>

          {esgotado ? (
            <span className="product-stock-badge">Esgotado</span>
          ) : null}

          {nomesVariacoes.length > 0 ? (
            <p className="product-options-hint">
              Opções: {nomesVariacoes.join(', ')}
            </p>
          ) : null}

          <div className="product-price-line">
            <strong>{precoTexto(produto)}</strong>
          </div>

          {produto.frete_texto ? (
            <span className="product-shipping-line">{produto.frete_texto}</span>
          ) : null}
        </div>

        {stockStatus ? (
          <span
            className={`stock-card-dot catalog-stock-dot stock-${stockStatus}`}
            title={rotuloEstoqueCatalogo(stockStatus)}
            aria-label={rotuloEstoqueCatalogo(stockStatus)}
          />
        ) : null}
      </button>
    );
  }

  function renderDestaque(produto) {
    const nomesVariacoes = normalizarVariacoes(produto.variacoes).map((grupo) => grupo.nome);
    const esgotado = produtoEsgotado(produto);
    const stockStatus = estoqueStatusVisivel(produto);
  
    return (
      <button
        key={produto.id}
        className={esgotado ? 'highlight-card catalog-item-card out-of-stock' : 'highlight-card catalog-item-card'}
        type="button"
        onClick={() => setProdutoAberto(produto)}
      >
        <div className="highlight-image">
          {produto.imagem_url ? (
            <img src={produto.imagem_url} alt={produto.nome} />
          ) : (
            <div className="product-placeholder">Sem foto</div>
          )}
        </div>
  
        <div className="highlight-info">
          <h3>{produto.nome}</h3>

          {esgotado ? (
            <span className="product-stock-badge">Esgotado</span>
          ) : null}

          {nomesVariacoes.length > 0 ? (
            <p className="highlight-options-hint">
              Opções: {nomesVariacoes.join(', ')}
            </p>
          ) : null}
  
          <div className="highlight-bottom">
            <strong>{precoTexto(produto)}</strong>
          </div>

          {produto.frete_texto ? (
            <span className="product-shipping-line">{produto.frete_texto}</span>
          ) : null}
        </div>

        {stockStatus ? (
          <span
            className={`stock-card-dot catalog-stock-dot stock-${stockStatus}`}
            title={rotuloEstoqueCatalogo(stockStatus)}
            aria-label={rotuloEstoqueCatalogo(stockStatus)}
          />
        ) : null}
      </button>
    );
  }

  const variacoesProdutoAberto = produtoAberto ? normalizarVariacoes(produtoAberto.variacoes) : [];
  const variacoesProdutoAbertoCompletas = variacoesProdutoAberto.every((grupo) =>
    Boolean(variacoesSelecionadas[grupo.nome])
  );
  const produtoAbertoEsgotado = produtoAberto ? produtoEsgotado(produtoAberto) : false;
  const estoqueProdutoAberto = produtoAberto ? estoqueDisponivel(produtoAberto) : 0;

  return (
    <div
      className={`catalog-page catalog-bg-${catalogoFundoTipo}`}
      style={{
        '--catalog-brand': corPrincipal,
        '--catalog-brand-2': corSecundaria,
        '--catalog-bg-custom': catalogoFundoCor,
        '--catalog-gradient': usarGradiente
          ? `linear-gradient(135deg, ${corPrincipal}, ${corSecundaria})`
          : corPrincipal
      }}
    >
      {boasVindasAberta ? (
        <div className="catalog-welcome-overlay" role="dialog" aria-modal="true" aria-label={tituloBoasVindas}>
          <div className="catalog-welcome-card">
            <div className="catalog-welcome-visual">
              {imagemBoasVindas ? (
                <img src={imagemBoasVindas} alt="" />
              ) : (
                <div className="catalog-welcome-gradient">
                  <span>{avisoPersonalizado ? 'Aviso' : 'Guia rapido'}</span>
                  <strong>{nomeEmpresa}</strong>
                </div>
              )}
            </div>
            <span className="catalog-welcome-orbit" aria-hidden="true" />
            <span className="catalog-welcome-kicker">
              {avisoPersonalizado ? 'Aviso da loja' : 'Guia rÃ¡pido'}
            </span>
            <h2>{tituloBoasVindas}</h2>
            <p>{textoBoasVindas}</p>

            {!avisoPersonalizado ? (
              <div className="catalog-welcome-steps" aria-label="Como usar o catalogo">
                <span>1. Escolha</span>
                <span>2. Adicione</span>
                <span>3. Envie</span>
              </div>
            ) : null}

            <button className="catalog-welcome-button" type="button" onClick={() => setBoasVindasAberta(false)}>
              Entendi, continuar
            </button>
          </div>
        </div>
      ) : null}

      <nav className="catalog-topbar catalog-topbar-compact">
        <div className="category-menu-wrap" ref={categoriasRef}>
          <button
            className="category-icon-button"
            type="button"
            aria-label="Categorias"
            onClick={() => setCategoriasAberto((aberto) => !aberto)}
          >
            <span className="category-icon-lines" />
          </button>

          {categoriasAberto ? (
            <div className="category-popover">
              <strong>Categorias</strong>

              {categoriasVisiveis.map((categoria) => (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() => irParaCategoria(`categoria-${categoria.id}`)}
                >
                  {categoria.nome}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="catalog-order-summary">
          <span className="bag-icon" aria-hidden="true" />

          <div className="catalog-order-totals">
            <strong>{quantidadeItens} item{quantidadeItens === 1 ? '' : 's'}</strong>
            <span>{total > 0 ? money(total) : 'R$ 0,00'}</span>
          </div>

          <button type="button" onClick={() => setPedidoAberto(true)}>
            Ver pedido
          </button>
        </div>
      </nav>

      <section className="catalog-hero">
        {empresa.banner_url ? (
          <img
            src={empresa.banner_url}
            alt={nomeEmpresa}
            style={{
              objectPosition: '50% 50%',
              transform: `scale(${bannerZoom})`
            }}
          />
        ) : (
          <div className="catalog-banner-placeholder" />
        )}
      </section>

      <section className="catalog-brand-card">
        <div className="catalog-logo">
          {empresa.logo_url ? (
            <img
              src={empresa.logo_url}
              alt={nomeEmpresa}
              style={{
                objectPosition: '50% 50%',
                transform: `scale(${logoZoom})`
              }}
            />
          ) : (
            <span>{nomeEmpresa.slice(0, 1)}</span>
          )}
        </div>

        <div>
          <div className="catalog-brand-title-row">
            <h1>{nomeEmpresa}</h1>

            {instagramUrl ? (
              <a
                className="catalog-instagram-link"
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`Instagram ${nomeEmpresa}`}
                title={`Instagram ${nomeEmpresa}`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="17.5" cy="6.5" r="1.3" fill="currentColor" />
                </svg>
              </a>
            ) : null}
          </div>
          <span className={estabelecimentoAberto ? 'open-status open' : 'open-status closed'}>
            {estabelecimentoAberto ? 'Aberto' : 'Fechado'}
          </span>
        </div>
      </section>
          
      {produtosDestaque.length > 0 ? (
        <section className="catalog-highlights shell">
          <div className="section-title-row">
            <h2>Destaques</h2>
            <p>Itens selecionados para facilitar sua escolha.</p>
          </div>

         <div className="highlights-wrap">
            <button
              className="highlights-arrow highlights-prev"
              type="button"
              aria-label="Voltar destaques"
              onClick={() => {
                destaquesRef.current?.scrollBy({
                  left: -220,
                  behavior: 'smooth'
                });
              }}
            >
              ‹
            </button>
          
            <div className="highlights-scroll" ref={destaquesRef}>
              {produtosDestaque.map(renderDestaque)}
            </div>
          
            <button
              className="highlights-arrow highlights-next"
              type="button"
              aria-label="Ver mais destaques"
              onClick={() => {
                destaquesRef.current?.scrollBy({
                  left: 220,
                  behavior: 'smooth'
                });
              }}
            >
              ›
            </button>
          </div>
        </section>
      ) : null}

      {categoriasVisiveis.map((categoria) => (
        <section
          key={categoria.id}
          id={`categoria-${categoria.id}`}
          className="category-block catalog-category-block"
        >
          <h2>{categoria.nome}</h2>

          <div className="product-grid">
            {categoria.produtos.map(renderProduto)}
          </div>
        </section>
      ))}

      {empresa.descricao_publica ? (
        <section className="catalog-about shell">
          <h2>Sobre {empresa.titulo_publico || empresa.nome}</h2>
          <p>{empresa.descricao_publica}</p>
        </section>
      ) : null}

      {produtoAberto ? (
        <div className="order-overlay" onClick={() => setProdutoAberto(null)}>
          <aside className="product-detail-modal" onClick={(event) => event.stopPropagation()}>
            <button className="detail-close" type="button" onClick={() => setProdutoAberto(null)}>
              Fechar
            </button>
      
            {produtoAberto.imagem_url ? (
              <img src={produtoAberto.imagem_url} alt={produtoAberto.nome} />
            ) : null}
      
            <div className="product-detail-content">
              <span>{tipoItemTexto(produtoAberto.tipo_item)}</span>
              <h2>{produtoAberto.nome}</h2>
      
              {produtoAberto.descricao ? (
                <p>{produtoAberto.descricao}</p>
              ) : null}
      
              <strong>{precoTexto(produtoAberto)}</strong>

              {produtoAberto.frete_texto ? (
                <span className="product-detail-shipping">{produtoAberto.frete_texto}</span>
              ) : null}

              {produtoAbertoEsgotado ? (
                <span className="product-detail-stock out">Produto esgotado no momento</span>
              ) : produtoControlaEstoque(produtoAberto) ? (
                <span className="product-detail-stock">
                  Disponível: {estoqueProdutoAberto} unidade{estoqueProdutoAberto === 1 ? '' : 's'}
                </span>
              ) : null}

              <div className="product-detail-quantity">
                <strong>Quantidade</strong>
                <div className="product-detail-quantity-control">
                  <button
                    type="button"
                    onClick={() => setQuantidadeProdutoAberto((atual) => Math.max(1, atual - 1))}
                  >
                    -
                  </button>
                  <span>{quantidadeProdutoAberto}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantidadeProdutoAberto((atual) =>
                        produtoControlaEstoque(produtoAberto)
                          ? Math.min(estoqueProdutoAberto, atual + 1)
                          : atual + 1
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              {variacoesProdutoAberto.length > 0 ? (
                <div className="product-variation-groups">
                  {variacoesProdutoAberto.map((grupo) => (
                    <div key={grupo.nome} className="product-variation-group">
                      <strong>{grupo.nome}</strong>
                      <div className="product-variation-options">
                        {grupo.valores.map((opcao) => (
                          <button
                            key={opcao}
                            className={variacoesSelecionadas[grupo.nome] === opcao
                              ? 'product-variation-option active'
                              : 'product-variation-option'}
                            type="button"
                            onClick={() =>
                              setVariacoesSelecionadas((atual) => ({
                                ...atual,
                                [grupo.nome]: opcao
                              }))
                            }
                          >
                            {opcao}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
      
              <button
                className="primary-button"
                style={{ background: usarGradiente ? 'var(--catalog-gradient)' : corPrincipal }}
                type="button"
                disabled={produtoAbertoEsgotado || (variacoesProdutoAberto.length > 0 && !variacoesProdutoAbertoCompletas)}
                onClick={() => {
                  adicionar(produtoAberto, variacoesSelecionadas, quantidadeProdutoAberto);
                  setProdutoAberto(null);
                }}
              >
                {produtoAbertoEsgotado
                  ? 'Esgotado'
                  : variacoesProdutoAberto.length > 0 && !variacoesProdutoAbertoCompletas
                    ? 'Escolha as opções'
                    : produtoAberto.tipo_preco === 'sob_consulta' ? 'Consultar' : 'Adicionar'}
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {pedidoAberto ? (
        <div className="order-overlay" onClick={() => setPedidoAberto(false)}>
          <aside className="order-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="order-drawer-header">
              <span className="order-drawer-icon" aria-hidden="true">
                <CartIcon />
              </span>

              <div>
                <h2>Seu pedido</h2>
                <p>{quantidadeItens} item{quantidadeItens === 1 ? '' : 's'} na sacola</p>
              </div>

              <button type="button" onClick={() => setPedidoAberto(false)}>
                ×
              </button>
            </div>

            {carrinho.length === 0 ? (
              <p className="muted">Nenhum item adicionado ainda.</p>
            ) : (
              <>
                <div className="order-total-card">
                  <span>Total aproximado</span>
                  <strong>{total > 0 ? money(total) : 'Consultar valor'}</strong>
                </div>

                <div className="cart-items order-cart-items">
                  {carrinho.map((item) => (
                    <div key={item.carrinho_key} className="cart-item">
                      <div className="cart-item-main">
                        <strong>{item.nome}</strong>
                        {textoVariacoes(item.variacoes_escolhidas) ? (
                          <small>{textoVariacoes(item.variacoes_escolhidas)}</small>
                        ) : null}
                        <span>{precoTexto(item)}</span>
                      </div>

                      <div className="cart-quantity">
                        <button type="button" onClick={() => alterarQuantidade(item.carrinho_key, item.quantidade - 1)}>
                          -
                        </button>
                        <span>{item.quantidade}</span>
                        <button type="button" onClick={() => alterarQuantidade(item.carrinho_key, item.quantidade + 1)}>
                          +
                        </button>
                        <button
                          className="cart-remove"
                          type="button"
                          aria-label={`Remover ${item.nome}`}
                          onClick={() => alterarQuantidade(item.carrinho_key, 0)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {opcoesPedido.tiposEntrega.length > 0 ? (
                  <div className="order-choice-group">
                    <strong>Como quer receber?</strong>
                    <div className="choice-buttons">
                      {opcoesPedido.tiposEntrega.map((opcao) => (
                        <button
                          key={opcao}
                          type="button"
                          className={tipoEntrega === opcao ? 'choice-button active' : 'choice-button'}
                          onClick={() => setTipoEntrega(opcao)}
                        >
                          {opcao}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {opcoesPedido.pagamentos.length > 0 ? (
                  <div className="order-choice-group">
                    <strong>Forma de Pagamento?</strong>
                    <div className="choice-buttons">
                      {opcoesPedido.pagamentos.map((opcao) => (
                        <button
                          key={opcao}
                          type="button"
                          className={pagamento === opcao ? 'choice-button active' : 'choice-button'}
                          onClick={() => setPagamento(opcao)}
                        >
                          {opcao}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <a
                  className={pedidoPodeEnviar ? 'primary-button order-whatsapp-button' : 'primary-button order-whatsapp-button disabled'}
                  href={pedidoPodeEnviar ? whatsappUrl : '#'}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!pedidoPodeEnviar}
                  onClick={(event) => {
                    if (!pedidoPodeEnviar) event.preventDefault();
                  }}
                >
                  <span className="whatsapp-mark" aria-hidden="true">
                    <WhatsAppIcon />
                  </span>
                  Enviar pelo WhatsApp
                </a>
              </>
            )}
          </aside>
        </div>
      ) : null}

      <button
        className={carrinho.length > 0 ? 'floating-whatsapp active' : 'floating-whatsapp'}
        type="button"
        aria-disabled={carrinho.length === 0}
        onClick={() => {
          if (carrinho.length > 0) setPedidoAberto(true);
        }}
      >
        {total > 0 ? `Enviar pedido • ${money(total)}` : 'Enviar pedido'}
      </button>

      <footer className="catalog-footer">
        {whatsapp ? (
          <div className="catalog-help-card">
            <span>Teve dificuldade para finalizar?</span>
            <a className="catalog-help-whatsapp" href={whatsappAjudaUrl} target="_blank" rel="noreferrer">
              <span className="whatsapp-mark" aria-hidden="true">
                <WhatsAppIcon />
              </span>
              <span>Chamar a loja no WhatsApp</span>
            </a>
          </div>
        ) : null}

        <span className="catalog-created-by">
          Criado por <strong className="nexora-wordmark">Nexora</strong>
        </span>
      </footer>
    </div>
  );
}
