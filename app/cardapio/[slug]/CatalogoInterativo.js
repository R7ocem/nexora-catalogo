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

function montarMensagem(empresa, itens) {
  const nomeEmpresa = empresa.titulo_publico || empresa.nome;

  const linhas = itens.map((item) => {
    if (itemTemValor(item)) {
      return `${item.quantidade}x ${item.nome} - ${money(Number(item.preco) * item.quantidade)}`;
    }

    return `${item.quantidade}x ${item.nome} - Consultar valor`;
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
    total > 0 ? `Total aproximado: ${money(total)}` : null,
    temConsulta ? 'Alguns itens estão sob consulta.' : null
  ]
    .filter(Boolean)
    .join('\n');
}

export default function CatalogoInterativo({ empresa, categorias, semCategoria }) {
  const [carrinho, setCarrinho] = useState([]);
  const [pedidoAberto, setPedidoAberto] = useState(false);
  const [categoriasAberto, setCategoriasAberto] = useState(false);
  const categoriasRef = useRef(null);

  const nomeEmpresa = empresa.titulo_publico || empresa.nome;
  const subtitulo = empresa.subtitulo_publico || 'Catálogo digital';
  const corPrincipal = empresa.tema_cor || '#0f766e';

  const categoriasVisiveis = [
    ...categorias.filter((categoria) => categoria.produtos.length > 0),
    ...(semCategoria.length > 0
      ? [{ id: 'sem-categoria', nome: 'Produtos e serviços', produtos: semCategoria }]
      : [])
  ];

  const produtosDestaque = categoriasVisiveis
    .flatMap((categoria) => categoria.produtos)
    .slice(0, 8);

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

  function adicionar(produto) {
    setCarrinho((atual) => {
      const existente = atual.find((item) => item.id === produto.id);

      if (existente) {
        return atual.map((item) =>
          item.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }

      return [...atual, { ...produto, quantidade: 1 }];
    });
  }

  function alterarQuantidade(produtoId, quantidade) {
    if (quantidade <= 0) {
      setCarrinho((atual) => atual.filter((item) => item.id !== produtoId));
      return;
    }

    setCarrinho((atual) =>
      atual.map((item) =>
        item.id === produtoId ? { ...item, quantidade } : item
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
  const mensagem = encodeURIComponent(montarMensagem(empresa, carrinho));
  const whatsappUrl = whatsapp && carrinho.length > 0
    ? `https://wa.me/${whatsapp}?text=${mensagem}`
    : '#';

  function renderProduto(produto) {
    const precoSobConsulta = produto.tipo_preco === 'sob_consulta';

    return (
      <article key={produto.id} className="product-card premium-product-card">
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
            <span>{tipoItemTexto(produto.tipo_item)}</span>
          </div>

          {produto.descricao ? (
            <p className="product-description" title={produto.descricao}>
              {produto.descricao}
            </p>
          ) : null}

          <div className="product-buy-row">
            <strong>{precoTexto(produto)}</strong>

            <button
              className="primary-button product-add-button"
              style={{ background: corPrincipal }}
              type="button"
              onClick={() => adicionar(produto)}
            >
              {precoSobConsulta ? 'Consultar' : 'Adicionar'}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="catalog-page" style={{ '--catalog-brand': corPrincipal }}>
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
          <img src={empresa.banner_url} alt={nomeEmpresa} />
        ) : (
          <div className="catalog-banner-placeholder" />
        )}
      </section>

      <section className="catalog-brand-card">
        <div className="catalog-logo">
          {empresa.logo_url ? (
            <img src={empresa.logo_url} alt={nomeEmpresa} />
          ) : (
            <span>{nomeEmpresa.slice(0, 1)}</span>
          )}
        </div>

        <div>
          <h1>{nomeEmpresa}</h1>
          <p>{subtitulo}</p>
        </div>
      </section>

      <section className="catalog-intro shell catalog-intro-modern">
        <h2>Escolha. Envie. Aproveite.</h2>
        
      </section>

      {produtosDestaque.length > 0 ? (
        <section className="catalog-highlights shell">
          <div className="section-title-row">
            <h2>Destaques</h2>
            <p>Itens selecionados para facilitar sua escolha.</p>
          </div>

          <div className="highlights-scroll">
            {produtosDestaque.map(renderProduto)}
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

      {pedidoAberto ? (
        <div className="order-overlay" onClick={() => setPedidoAberto(false)}>
          <aside className="order-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="order-drawer-header">
              <div>
                <h2>Seu pedido</h2>
                <p>{quantidadeItens} item{quantidadeItens === 1 ? '' : 's'} na sacola</p>
              </div>

              <button type="button" onClick={() => setPedidoAberto(false)}>
                Fechar
              </button>
            </div>

            {carrinho.length === 0 ? (
              <p className="muted">Nenhum item adicionado ainda.</p>
            ) : (
              <>
                <div className="cart-items order-cart-items">
                  {carrinho.map((item) => (
                    <div key={item.id} className="cart-item">
                      <div>
                        <strong>{item.nome}</strong>
                        <span>{precoTexto(item)}</span>
                      </div>

                      <div className="cart-quantity">
                        <button type="button" onClick={() => alterarQuantidade(item.id, item.quantidade - 1)}>
                          -
                        </button>
                        <span>{item.quantidade}</span>
                        <button type="button" onClick={() => alterarQuantidade(item.id, item.quantidade + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {total > 0 ? (
                  <strong className="cart-total">Total aproximado: {money(total)}</strong>
                ) : null}

                <a className="primary-button order-whatsapp-button" href={whatsappUrl} target="_blank" rel="noreferrer">
                  Enviar pelo WhatsApp
                </a>
              </>
            )}
          </aside>
        </div>
      ) : null}

      <a
        className={carrinho.length > 0 ? 'floating-whatsapp active' : 'floating-whatsapp'}
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        aria-disabled={carrinho.length === 0}
        onClick={(event) => {
          if (carrinho.length === 0) event.preventDefault();
        }}
      >
        {total > 0 ? `Enviar pedido • ${money(total)}` : 'Enviar pedido'}
      </a>
    </div>
  );
}
