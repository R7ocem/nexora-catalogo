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

function normalizarBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function textoBuscaProduto(produto) {
  const variacoes = normalizarVariacoes(produto?.variacoes)
    .flatMap((grupo) => [grupo.nome, ...grupo.valores])
    .join(' ');

  return [
    produto?.nome,
    produto?.descricao,
    produto?.categoria_nome,
    produto?.tipo_item,
    produto?.codigo,
    produto?.apelidos,
    variacoes
  ].filter(Boolean).join(' ');
}

function scoreBusca(produto, termo) {
  const nome = normalizarBusca(produto?.nome);
  const categoria = normalizarBusca(produto?.categoria_nome);
  const apelidos = normalizarBusca(produto?.apelidos);
  const variacoes = normalizarBusca(
    normalizarVariacoes(produto?.variacoes)
      .flatMap((grupo) => [grupo.nome, ...grupo.valores])
      .join(' ')
  );
  const descricao = normalizarBusca(produto?.descricao);
  const textoCompleto = normalizarBusca(textoBuscaProduto(produto));

  if (!termo || !textoCompleto.includes(termo)) return 0;
  if (nome === termo) return 100;
  if (nome.startsWith(termo)) return 90;
  if (nome.includes(termo)) return 80;
  if (categoria.includes(termo)) return 65;
  if (apelidos.includes(termo)) return 58;
  if (variacoes.includes(termo)) return 52;
  if (descricao.includes(termo)) return 40;
  return 20;
}

function partesDestacadas(texto, termo) {
  const original = String(texto || '');
  const termoNormalizado = normalizarBusca(termo);

  if (!original || !termoNormalizado) return [original];

  const inicio = normalizarBusca(original).indexOf(termoNormalizado);
  if (inicio < 0) return [original];

  return [
    original.slice(0, inicio),
    original.slice(inicio, inicio + termoNormalizado.length),
    original.slice(inicio + termoNormalizado.length)
  ];
}
function itemTemValor(produto) {
  return produto.tipo_preco !== 'sob_consulta';
}

function estoqueDisponivel(produto) {
  return Math.max(0, Math.floor(Number(produto?.stock_quantity || 0)));
}

function precoProduto(produto) {
  return Number(produto?.preco || 0);
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
    .filter((grupo) => grupo?.tipo !== 'combinacoes')
    .map((grupo) => {
      const nome = String(grupo?.nome || '').trim();
      const valores = Array.isArray(grupo?.valores)
        ? grupo.valores.map((opcao) => String(opcao || '').trim()).filter(Boolean)
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
        sku: String(combinacao?.sku || '').trim(),
        preco: combinacao?.preco === null || combinacao?.preco === undefined
          ? null
          : Number(combinacao.preco),
        stock_quantity: combinacao?.stock_quantity === null || combinacao?.stock_quantity === undefined
          ? null
          : Math.max(0, Math.floor(Number(combinacao.stock_quantity || 0)))
      };
    })
    .filter((combinacao) => Object.keys(combinacao.escolhas).length > 0);
}

function combinacaoCorresponde(combinacao, escolhas, exigirCompleta = true) {
  const entradas = Object.entries(combinacao?.escolhas || {});

  if (entradas.length === 0) return false;

  if (exigirCompleta && entradas.some(([nome]) => !escolhas[nome])) {
    return false;
  }

  return entradas.every(([nome, valor]) => !escolhas[nome] || escolhas[nome] === valor);
}

function combinacaoSelecionada(produto, escolhas) {
  return normalizarCombinacoes(produto?.variacoes).find((combinacao) =>
    combinacaoCorresponde(combinacao, escolhas, true)
  ) || null;
}

function produtoComCombinacao(produto, combinacao) {
  if (!combinacao) return produto;

  return {
    ...produto,
    sku_variacao: combinacao.sku || '',
    preco: Number.isFinite(combinacao.preco) ? combinacao.preco : produto.preco,
    stock_quantity: combinacao.stock_quantity !== null ? combinacao.stock_quantity : produto.stock_quantity,
    track_stock: combinacao.stock_quantity !== null ? true : produto.track_stock
  };
}

function opcaoIndisponivel(produto, grupoNome, opcao, escolhasAtuais) {
  const combinacoes = normalizarCombinacoes(produto?.variacoes);
  if (combinacoes.length === 0) return false;

  const escolhas = {
    ...escolhasAtuais,
    [grupoNome]: opcao
  };

  const candidatas = combinacoes.filter((combinacao) => combinacaoCorresponde(combinacao, escolhas, false));
  if (candidatas.length === 0) return false;

  return candidatas.every((combinacao) =>
    combinacao.stock_quantity !== null && combinacao.stock_quantity <= 0
  );
}

function produtoTemVariacoes(produto) {
  return normalizarVariacoes(produto.variacoes).length > 0;
}

function rotuloStatusCliente(pedido) {
  const status = String(pedido?.status_preparo || pedido?.status || 'confirmado').trim();
  const rotulos = {
    rascunho: 'Pedido iniciado',
    confirmado: 'Pedido recebido',
    em_preparo: 'Em preparo',
    pronto: pedido?.entrega_retirada === 'entrega' ? 'Pronto para entrega' : 'Pronto para retirada',
    saiu_entrega: 'Saiu para entrega',
    finalizado: 'Finalizado',
    cancelado: 'Cancelado'
  };

  return rotulos[status] || 'Pedido recebido';
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
      return `${item.quantidade}x ${nomeItem} - ${money(precoProduto(item) * item.quantidade)}`;
    }

    return `${item.quantidade}x ${nomeItem} - Consultar valor`;
  });

  const total = itens.reduce((soma, item) => {
    if (!itemTemValor(item)) return soma;
    return soma + precoProduto(item) * item.quantidade;
  }, 0);

  const temConsulta = itens.some((item) => !itemTemValor(item));

  return [
    `Olá! Vim pelo catálogo da ${nomeEmpresa}.`,
    '',
    'Meu pedido:',
    ...linhas,
    '',
    detalhesPedido?.nomeCliente ? `Cliente: ${detalhesPedido.nomeCliente}` : null,
    detalhesPedido?.telefoneCliente ? `WhatsApp: ${detalhesPedido.telefoneCliente}` : null,
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

function gerarClientOrderKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `pedido-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function storagePedidosKey(slug) {
  return `nexoraPedidos:${slug}`;
}

function storageCarrinhoKey(slug) {
  return `nexoraCarrinho:${slug}`;
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4h10a2 2 0 0 1 2 2v14l-3-1.8-3 1.8-3-1.8L7 20V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 8h5M10 12h5M10 16h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [boasVindasAberta, setBoasVindasAberta] = useState(true);
  const [avisoCarrinho, setAvisoCarrinho] = useState('');
  const [pedidoEnviado, setPedidoEnviado] = useState(false);
  const [pedidoSalvando, setPedidoSalvando] = useState(false);
  const [pedidoErro, setPedidoErro] = useState('');
  const [pedidoAviso, setPedidoAviso] = useState('');
  const [pedidoConfirmado, setPedidoConfirmado] = useState(null);
  const [whatsappConfirmacaoUrl, setWhatsappConfirmacaoUrl] = useState('');
  const [pedidosCliente, setPedidosCliente] = useState([]);
  const [pedidosAberto, setPedidosAberto] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [termoBuscaDebounced, setTermoBuscaDebounced] = useState('');
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [buscaAtivaIndex, setBuscaAtivaIndex] = useState(-1);
  const [termoResultados, setTermoResultados] = useState('');
  const categoriasRef = useRef(null);
  const destaquesRef = useRef(null);
  const buscaRef = useRef(null);
  const resultadosBuscaRef = useRef(null);
  const clientOrderKeyRef = useRef('');

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
      ? [{ id: 'sem-categoria', nome: 'Produtos e servicos', produtos: semCategoria }]
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

  const termoBuscaNormalizado = normalizarBusca(termoBuscaDebounced);
  const termoResultadosNormalizado = normalizarBusca(termoResultados);
  const buscaDigitando = normalizarBusca(termoBusca).length >= 2
    && normalizarBusca(termoBusca) !== termoBuscaNormalizado;

  const resultadosBusca = useMemo(() => {
    if (termoBuscaNormalizado.length < 2) return [];

    return todosProdutosVisiveis
      .map((produto) => ({ produto, score: scoreBusca(produto, termoBuscaNormalizado) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.produto.nome.localeCompare(b.produto.nome))
      .map((item) => item.produto);
  }, [termoBuscaNormalizado, todosProdutosVisiveis]);

  const sugestoesBusca = resultadosBusca.slice(0, 6);

  const resultadosCompletosBusca = useMemo(() => {
    if (termoResultadosNormalizado.length < 2) return [];

    return todosProdutosVisiveis
      .map((produto) => ({ produto, score: scoreBusca(produto, termoResultadosNormalizado) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.produto.nome.localeCompare(b.produto.nome))
      .map((item) => item.produto);
  }, [termoResultadosNormalizado, todosProdutosVisiveis]);

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
    const timeout = window.setTimeout(() => {
      setTermoBuscaDebounced(termoBusca);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [termoBusca]);

  useEffect(() => {
    function fecharBuscaAoClicarFora(event) {
      if (!buscaRef.current) return;

      if (!buscaRef.current.contains(event.target)) {
        setSugestoesAbertas(false);
        setBuscaAtivaIndex(-1);
      }
    }

    document.addEventListener('mousedown', fecharBuscaAoClicarFora);

    return () => {
      document.removeEventListener('mousedown', fecharBuscaAoClicarFora);
    };
  }, []);

  useEffect(() => {
    setVariacoesSelecionadas({});
    setQuantidadeProdutoAberto(1);
    setAvisoCarrinho('');
  }, [produtoAberto?.id]);

  useEffect(() => {
    clientOrderKeyRef.current = gerarClientOrderKey();

    try {
      const pedidosSalvos = JSON.parse(localStorage.getItem(storagePedidosKey(empresa.slug)) || '[]');
      if (Array.isArray(pedidosSalvos)) {
        setPedidosCliente(pedidosSalvos);
      }
    } catch {
      setPedidosCliente([]);
    }
  }, [empresa.slug]);

  useEffect(() => {
    const ids = pedidosCliente.map((pedido) => pedido?.pedido_id).filter(Boolean);
    if (ids.length === 0) return;

    let cancelado = false;
    const idsKey = ids.join(',');

    async function atualizarPedidos() {
      try {
        const params = new URLSearchParams({
          company: empresa.slug,
          ids: idsKey
        });
        const resposta = await fetch(`/api/catalog/orders?${params.toString()}`, {
          cache: 'no-store'
        });
        const dados = await resposta.json();

        if (!cancelado && Array.isArray(dados.orders)) {
          setPedidosCliente(dados.orders);
          localStorage.setItem(storagePedidosKey(empresa.slug), JSON.stringify(dados.orders));
        }
      } catch {
        // A area de pedidos recentes continua exibindo o ultimo snapshot local.
      }
    }

    atualizarPedidos();
    const intervalo = window.setInterval(atualizarPedidos, 7000);

    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
    };
  }, [empresa.slug, pedidosCliente.map((pedido) => pedido?.pedido_id).filter(Boolean).join(',')]);

  function abrirProdutoDaBusca(produto) {
    if (!produto) return;

    setProdutoAberto(produto);
    setSugestoesAbertas(false);
    setBuscaAtivaIndex(-1);
  }

  function mostrarTodosResultados(termo = termoBusca) {
    const termoLimpo = String(termo || '').trim();
    if (normalizarBusca(termoLimpo).length < 2) return;

    setTermoResultados(termoLimpo);
    setSugestoesAbertas(false);
    setBuscaAtivaIndex(-1);

    window.setTimeout(() => {
      resultadosBuscaRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 50);
  }

  function limparBusca() {
    setTermoBusca('');
    setTermoBuscaDebounced('');
    setTermoResultados('');
    setSugestoesAbertas(false);
    setBuscaAtivaIndex(-1);
  }

  function lidarTeclaBusca(event) {
    const temSugestoes = sugestoesBusca.length > 0;

    if (event.key === 'Escape') {
      setSugestoesAbertas(false);
      setBuscaAtivaIndex(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSugestoesAbertas(true);
      setBuscaAtivaIndex((atual) => Math.min(atual + 1, temSugestoes ? sugestoesBusca.length - 1 : 0));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setBuscaAtivaIndex((atual) => Math.max(atual - 1, -1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      if (temSugestoes && buscaAtivaIndex >= 0) {
        abrirProdutoDaBusca(sugestoesBusca[buscaAtivaIndex]);
        return;
      }

      mostrarTodosResultados();
    }
  }

  function adicionar(produto, escolhas = {}, quantidade = 1) {
    if (produtoEsgotado(produto)) return;

    const variacoesProduto = normalizarVariacoes(produto.variacoes);
    const escolhasValidas = variacoesProduto.reduce((acc, grupo) => {
      if (escolhas[grupo.nome]) {
        acc[grupo.nome] = escolhas[grupo.nome];
      }

      return acc;
    }, {});
    const combinacao = combinacaoSelecionada(produto, escolhasValidas);
    const produtoFinal = produtoComCombinacao(produto, combinacao);

    if (produtoControlaEstoque(produtoFinal) && estoqueDisponivel(produtoFinal) <= 0) {
      setAvisoCarrinho('Esta opcao esta indisponivel no momento. Escolha outra variacao.');
      return;
    }

    const carrinhoKey = chaveCarrinho(produto, escolhasValidas);
    const quantidadeSolicitada = Math.max(1, Math.floor(Number(quantidade) || 1));
    const estoque = estoqueDisponivel(produtoFinal);
    const quantidadeFinal = produtoControlaEstoque(produtoFinal)
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
          ...produtoFinal,
          quantidade: quantidadeFinal,
          carrinho_key: carrinhoKey,
          variacoes_escolhidas: escolhasValidas
        }
      ];
    });

    setAvisoCarrinho('');
    setPedidoErro('');
    setPedidoAviso('');
    setPedidoEnviado(false);
  }

  function alterarQuantidade(carrinhoKey, quantidade) {
    setPedidoErro('');
    setPedidoAviso('');

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
      return soma + precoProduto(item) * item.quantidade;
    }, 0);
  }, [carrinho]);

  const quantidadeItens = carrinho.reduce((soma, item) => soma + item.quantidade, 0);
  const whatsapp = String(empresa.whatsapp || '').replace(/\D/g, '');
  const telefoneClienteLimpo = String(telefoneCliente || '').replace(/\D/g, '');
  const precisaTipoEntrega = opcoesPedido.tiposEntrega.length > 0;
  const precisaPagamento = opcoesPedido.pagamentos.length > 0;
  const pedidoPodeEnviar = carrinho.length > 0
    && telefoneClienteLimpo.length >= 10
    && (!precisaTipoEntrega || tipoEntrega)
    && (!precisaPagamento || pagamento);
  const mensagem = encodeURIComponent(montarMensagem(empresa, carrinho, {
    tipoEntrega,
    pagamento,
    nomeCliente,
    telefoneCliente: telefoneClienteLimpo
  }));
  const whatsappUrl = whatsapp && carrinho.length > 0
    ? `https://wa.me/${whatsapp}?text=${mensagem}`
    : '#';
  const mensagemAjuda = encodeURIComponent(
    `Olá! Não estou conseguindo finalizar meu pedido pelo catálogo ${empresa.titulo_publico || empresa.nome}. Pode me ajudar?`
  );
  const whatsappAjudaUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${mensagemAjuda}`
    : '#';

  function limparCarrinho() {
    setCarrinho([]);
    setTipoEntrega('');
    setPagamento('');
    setPedidoAberto(false);
    setAvisoCarrinho('');

    try {
      localStorage.removeItem(storageCarrinhoKey(empresa.slug));
      sessionStorage.removeItem(storageCarrinhoKey(empresa.slug));
    } catch {
      // O carrinho atual nao usa persistencia, mas limpamos chaves antigas se existirem.
    }
  }

  async function finalizarPedido(event) {
    event.preventDefault();

    if (!pedidoPodeEnviar || pedidoSalvando || pedidoEnviado) {
      return;
    }

    setPedidoSalvando(true);
    setPedidoErro('');
    setPedidoAviso('');

    try {
      if (!clientOrderKeyRef.current) {
        clientOrderKeyRef.current = gerarClientOrderKey();
      }

      const resposta = await fetch('/api/catalog/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company: empresa.slug,
          client_order_key: clientOrderKeyRef.current,
          customer_name: nomeCliente,
          customer_phone: telefoneClienteLimpo,
          delivery_type: tipoEntrega,
          payment: pagamento,
          items: carrinho.map((item) => ({
            product_id: item.id,
            quantity: item.quantidade,
            selected_options: item.variacoes_escolhidas || {}
          }))
        })
      });
      const dados = await resposta.json().catch(() => ({}));

      if (!resposta.ok || !dados.success || !dados.order) {
        throw new Error(dados.message || 'Nao foi possivel criar o pedido agora. Tente novamente.');
      }

      const pedidoCriado = dados.order;
      const whatsappEnvioUrl = whatsappUrl;
      const pedidosAtualizados = [
        pedidoCriado,
        ...pedidosCliente.filter((pedido) => pedido?.pedido_id !== pedidoCriado.pedido_id)
      ].slice(0, 10);

      setPedidoEnviado(true);
      setPedidoConfirmado(pedidoCriado);
      setWhatsappConfirmacaoUrl(whatsappEnvioUrl);
      setPedidosCliente(pedidosAtualizados);
      localStorage.setItem(storagePedidosKey(empresa.slug), JSON.stringify(pedidosAtualizados));
      limparCarrinho();
      clientOrderKeyRef.current = gerarClientOrderKey();

      const janelaWhatsApp = window.open(whatsappEnvioUrl, '_blank', 'noopener,noreferrer');
      if (!janelaWhatsApp) {
        setPedidoAviso('Pedido criado com sucesso. Se quiser enviar a mensagem tambem, toque em Abrir WhatsApp.');
      }
    } catch (error) {
      setPedidoErro(error.message || 'Nao foi possivel criar o pedido agora. Tente novamente.');
    } finally {
      setPedidoSalvando(false);
    }
  }

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
  const combinacaoProdutoAberto = produtoAberto
    ? combinacaoSelecionada(produtoAberto, variacoesSelecionadas)
    : null;
  const produtoAbertoComPrecoEstoque = produtoAberto
    ? produtoComCombinacao(produtoAberto, combinacaoProdutoAberto)
    : null;
  const variacoesProdutoAbertoCompletas = variacoesProdutoAberto.every((grupo) =>
    Boolean(variacoesSelecionadas[grupo.nome])
  );
  const produtoAbertoEsgotado = produtoAbertoComPrecoEstoque ? produtoEsgotado(produtoAbertoComPrecoEstoque) : false;
  const estoqueProdutoAberto = produtoAbertoComPrecoEstoque ? estoqueDisponivel(produtoAbertoComPrecoEstoque) : 0;

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

      <header className="catalog-header">
        <div className="catalog-header-actions">
          <div className="category-menu-wrap" ref={categoriasRef}>
            <button
              className="category-icon-button"
              type="button"
              aria-label="Abrir categorias"
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

          <button
            className={quantidadeItens > 0 ? 'catalog-cart-button has-items' : 'catalog-cart-button'}
            type="button"
            aria-label={`${quantidadeItens} item${quantidadeItens === 1 ? '' : 's'} no carrinho, total ${total > 0 ? money(total) : 'R$ 0,00'}`}
            onClick={() => setPedidoAberto(true)}
          >
            <span className="bag-icon" aria-hidden="true" />
            <span className="catalog-order-totals">
              <strong>{quantidadeItens} item{quantidadeItens === 1 ? '' : 's'}</strong>
              <span>{total > 0 ? money(total) : 'R$ 0,00'}</span>
            </span>
            <span className="cart-count-badge" aria-hidden="true">{quantidadeItens}</span>
          </button>

          <button
            className="catalog-orders-shortcut"
            type="button"
            aria-label="Abrir meus pedidos"
            onClick={() => setPedidosAberto(true)}
          >
            <span className="orders-icon" aria-hidden="true">
              <OrdersIcon />
            </span>
            <span>Meus pedidos</span>
          </button>
        </div>

        <div className="catalog-search-container" ref={buscaRef}>
          <div className="catalog-search-field">
            <span className="catalog-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              value={termoBusca}
              type="search"
              role="combobox"
              aria-label="Buscar no catalogo"
              aria-autocomplete="list"
              aria-expanded={sugestoesAbertas && normalizarBusca(termoBusca).length >= 2}
              aria-controls="catalog-search-suggestions"
              aria-activedescendant={buscaAtivaIndex >= 0 ? `catalog-search-option-${buscaAtivaIndex}` : undefined}
              placeholder="Buscar produtos, categorias, marcas ou servicos..."
              onFocus={() => {
                if (normalizarBusca(termoBusca).length >= 2) setSugestoesAbertas(true);
              }}
              onChange={(event) => {
                setTermoBusca(event.target.value);
                setSugestoesAbertas(normalizarBusca(event.target.value).length >= 2);
                setBuscaAtivaIndex(-1);
              }}
              onKeyDown={lidarTeclaBusca}
            />
            {termoBusca ? (
              <button className="catalog-search-clear" type="button" aria-label="Limpar busca" onClick={limparBusca}>
                x
              </button>
            ) : null}
          </div>

          {sugestoesAbertas && normalizarBusca(termoBusca).length >= 2 ? (
            <div id="catalog-search-suggestions" className="catalog-search-suggestions" role="listbox">
              {buscaDigitando ? (
                <p className="catalog-search-state">Buscando...</p>
              ) : sugestoesBusca.length > 0 ? (
                <>
                  {sugestoesBusca.map((produto, index) => {
                    const partesNome = partesDestacadas(produto.nome, termoBuscaDebounced);
                    const esgotado = produtoEsgotado(produto);

                    return (
                      <button
                        key={produto.id}
                        id={`catalog-search-option-${index}`}
                        className={buscaAtivaIndex === index ? 'catalog-search-suggestion active' : 'catalog-search-suggestion'}
                        type="button"
                        role="option"
                        aria-selected={buscaAtivaIndex === index}
                        onMouseEnter={() => setBuscaAtivaIndex(index)}
                        onClick={() => abrirProdutoDaBusca(produto)}
                      >
                        <span className="catalog-search-thumb">
                          {produto.imagem_url ? (
                            <img src={produto.imagem_url} alt="" loading="lazy" />
                          ) : (
                            <span>Sem foto</span>
                          )}
                        </span>
                        <span className="catalog-search-copy">
                          <strong>
                            {partesNome.map((parte, parteIndex) =>
                              parteIndex === 1 ? <mark key={parteIndex}>{parte}</mark> : <span key={parteIndex}>{parte}</span>
                            )}
                          </strong>
                          <small>{produto.categoria_nome || tipoItemTexto(produto.tipo_item)}</small>
                          <span>{precoTexto(produto)} - {esgotado ? 'Indisponivel' : 'Disponivel'}</span>
                        </span>
                      </button>
                    );
                  })}

                  <button className="catalog-search-all" type="button" onClick={() => mostrarTodosResultados()}>
                    Ver todos os resultados para "{termoBusca.trim()}"
                  </button>
                </>
              ) : (
                <>
                  <p className="catalog-search-state">Nenhum produto, categoria, marca ou servico encontrado.</p>
                  <button className="catalog-search-all" type="button" onClick={() => mostrarTodosResultados()}>
                    Ver todos os resultados para "{termoBusca.trim()}"
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </header>

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

      {termoResultadosNormalizado.length >= 2 ? (
        <section ref={resultadosBuscaRef} className="catalog-search-results shell">
          <div className="section-title-row">
            <div>
              <h2>Resultados para "{termoResultados}"</h2>
              <p>
                {resultadosCompletosBusca.length} item{resultadosCompletosBusca.length === 1 ? '' : 's'} encontrado{resultadosCompletosBusca.length === 1 ? '' : 's'}
              </p>
            </div>

            <button className="secondary-button" type="button" onClick={limparBusca}>
              Limpar busca
            </button>
          </div>

          {resultadosCompletosBusca.length > 0 ? (
            <div className="product-grid">
              {resultadosCompletosBusca.map(renderProduto)}
            </div>
          ) : (
            <p className="catalog-search-empty">Nenhum produto, categoria, marca ou servico encontrado.</p>
          )}
        </section>
      ) : null}

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
      
              <strong>{precoTexto(produtoAbertoComPrecoEstoque || produtoAberto)}</strong>

              {produtoAberto.frete_texto ? (
                <span className="product-detail-shipping">{produtoAberto.frete_texto}</span>
              ) : null}

              {produtoAbertoEsgotado ? (
                <span className="product-detail-stock out">Produto esgotado no momento</span>
              ) : produtoControlaEstoque(produtoAbertoComPrecoEstoque || produtoAberto) ? (
                <span className="product-detail-stock">
                  Disponível: {estoqueProdutoAberto} unidade{estoqueProdutoAberto === 1 ? '' : 's'}
                </span>
              ) : null}

              {avisoCarrinho ? (
                <span className="product-detail-stock out">{avisoCarrinho}</span>
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
                        produtoControlaEstoque(produtoAbertoComPrecoEstoque || produtoAberto)
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
                        {grupo.valores.map((opcao) => {
                          const indisponivel = opcaoIndisponivel(produtoAberto, grupo.nome, opcao, variacoesSelecionadas);

                          return (
                            <button
                              key={opcao}
                              className={[
                                'product-variation-option',
                                variacoesSelecionadas[grupo.nome] === opcao ? 'active' : '',
                                indisponivel ? 'disabled' : ''
                              ].filter(Boolean).join(' ')}
                              type="button"
                              disabled={indisponivel}
                              onClick={() => {
                                if (indisponivel) {
                                  setAvisoCarrinho('Esta opcao esta indisponivel no momento. Escolha outra variacao.');
                                  return;
                                }

                                setAvisoCarrinho('');
                                setVariacoesSelecionadas((atual) => ({
                                  ...atual,
                                  [grupo.nome]: opcao
                                }));
                              }}
                            >
                              {opcao}
                            </button>
                          );
                        })}
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
                  if (!produtoAbertoEsgotado) setProdutoAberto(null);
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

                <div className="order-customer-fields">
                  <label>
                    Nome
                    <input
                      value={nomeCliente}
                      onChange={(event) => setNomeCliente(event.target.value)}
                      placeholder="Seu nome"
                    />
                  </label>

                  <label>
                    WhatsApp para acompanhamento
                    <input
                      value={telefoneCliente}
                      onChange={(event) => setTelefoneCliente(event.target.value)}
                      inputMode="tel"
                      placeholder="DDD + numero"
                    />
                  </label>
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

                {pedidoErro ? (
                  <p className="order-error-message">{pedidoErro}</p>
                ) : null}

                {telefoneClienteLimpo.length > 0 && telefoneClienteLimpo.length < 10 ? (
                  <p className="order-error-message">Informe um WhatsApp valido com DDD.</p>
                ) : null}

                <button
                  className={pedidoPodeEnviar && !pedidoEnviado ? 'primary-button order-whatsapp-button' : 'primary-button order-whatsapp-button disabled'}
                  type="button"
                  disabled={!pedidoPodeEnviar || pedidoSalvando || pedidoEnviado}
                  aria-disabled={!pedidoPodeEnviar || pedidoEnviado}
                  onClick={finalizarPedido}
                >
                  <span className="whatsapp-mark" aria-hidden="true">
                    <WhatsAppIcon />
                  </span>
                  {pedidoSalvando
                    ? 'Criando pedido...'
                    : pedidoEnviado
                      ? 'Pedido enviado'
                      : telefoneClienteLimpo.length < 10 ? 'Informe o WhatsApp' : 'Enviar pelo WhatsApp'}
                </button>
              </>
            )}
          </aside>
        </div>
      ) : null}

      {pedidoConfirmado ? (
        <div className="order-overlay" onClick={() => setPedidoConfirmado(null)}>
          <aside className="order-drawer order-confirmation" onClick={(event) => event.stopPropagation()}>
            <div className="order-drawer-header">
              <div>
                <h2>Pedido criado</h2>
                <p>Seu pedido ja entrou na area de acompanhamento.</p>
              </div>

              <button type="button" onClick={() => setPedidoConfirmado(null)}>
                x
              </button>
            </div>

            <div className="order-total-card">
              <span>Pedido</span>
              <strong>#{pedidoConfirmado.numero_sequencial || pedidoConfirmado.numero_dia || pedidoConfirmado.pedido_id}</strong>
            </div>

            <div className="product-save-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setPedidoConfirmado(null);
                  setPedidosAberto(true);
                }}
              >
                Acompanhar pedido
              </button>

              {whatsappConfirmacaoUrl ? (
                <a className="secondary-button order-confirmation-link" href={whatsappConfirmacaoUrl} target="_blank" rel="noreferrer">
                  Abrir WhatsApp
                </a>
              ) : null}
            </div>

            {pedidoAviso ? (
              <p className="order-info-message">{pedidoAviso}</p>
            ) : null}
          </aside>
        </div>
      ) : null}

      {pedidosAberto ? (
        <div className="order-overlay" onClick={() => setPedidosAberto(false)}>
          <aside className="order-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="order-drawer-header">
              <div>
                <h2>Meus pedidos</h2>
                <p>Acompanhe os pedidos feitos neste aparelho.</p>
              </div>

              <button type="button" onClick={() => setPedidosAberto(false)}>
                x
              </button>
            </div>

            {pedidosCliente.length === 0 ? (
              <p className="muted">Nenhum pedido criado ainda.</p>
            ) : (
              <div className="customer-orders-list">
                {pedidosCliente.map((pedido) => (
                  <article key={pedido.pedido_id} className="customer-order-card">
                    <div>
                      <span>#{pedido.numero_sequencial || pedido.numero_dia || pedido.pedido_id}</span>
                      <strong>{rotuloStatusCliente(pedido)}</strong>
                    </div>
                    <p>{pedido.entrega_retirada || 'Recebimento não informado'} | {pedido.pagamento || 'Pagamento não informado'}</p>
                    <small>{pedido.itens?.length || 0} item{pedido.itens?.length === 1 ? '' : 's'} | {money(pedido.total || 0)}</small>
                    {pedido.itens?.length ? (
                      <ul className="customer-order-items">
                        {pedido.itens.map((item, index) => (
                          <li key={`${pedido.pedido_id}-${index}`}>
                            {item.quantidade || 1}x {item.nome_produto || item.nome || 'Item'}{textoVariacoes(item.variacoes_escolhidas) ? ` (${textoVariacoes(item.variacoes_escolhidas)})` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {carrinho.length > 0 ? (
        <button
          className="floating-whatsapp active"
          type="button"
          onClick={() => setPedidoAberto(true)}
        >
          Enviar pedido - {money(total)}
        </button>
      ) : null}

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
