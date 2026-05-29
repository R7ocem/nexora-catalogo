'use client';

import { useMemo, useState } from 'react';
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
  const linhas = itens.map((item) => {
    const preco = itemTemValor(item)
      ? `${item.quantidade}x ${item.nome} - ${money(Number(item.preco) * item.quantidade)}`
      : `${item.quantidade}x ${item.nome} - Consultar valor`;

    return preco;
  });

  const total = itens.reduce((soma, item) => {
    if (!itemTemValor(item)) return soma;
    return soma + Number(item.preco || 0) * item.quantidade;
  }, 0);

  const temConsulta = itens.some((item) => !itemTemValor(item));

  return [
    `Olá! Vim pelo catálogo da ${empresa.nome}.`,
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

  const total = useMemo(() => {
    return carrinho.reduce((soma, item) => {
      if (!itemTemValor(item)) return soma;
      return soma + Number(item.preco || 0) * item.quantidade;
    }, 0);
  }, [carrinho]);

  const whatsapp = String(empresa.whatsapp || '').replace(/\D/g, '');
  const mensagem = encodeURIComponent(montarMensagem(empresa, carrinho));
  const whatsappUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${mensagem}`
    : '#';

  function renderProduto(produto) {
    return (
      <article key={produto.id} className="product-card">
        {produto.imagem_url ? (
          <img src={produto.imagem_url} alt={produto.nome} />
        ) : (
          <div className="product-placeholder">Sem foto</div>
        )}

        <div className="product-info">
          <h3>{produto.nome}</h3>

          {produto.descricao ? <p>{produto.descricao}</p> : null}

          <div className="product-meta">
            <span>{tipoItemTexto(produto.tipo_item)}</span>
          </div>

          <strong>{precoTexto(produto)}</strong>

          <button className="primary-button product-add-button" type="button" onClick={() => adicionar(produto)}>
            Adicionar
          </button>
        </div>
      </article>
    );
  }

  return (
    <>
      {categorias.map((categoria) =>
        categoria.produtos.length > 0 ? (
          <section key={categoria.id} className="category-block">
            <h2>{categoria.nome}</h2>

            <div className="product-grid">
              {categoria.produtos.map(renderProduto)}
            </div>
          </section>
        ) : null
      )}

      {semCategoria.length > 0 ? (
        <section className="category-block">
          <h2>Produtos e serviços</h2>

          <div className="product-grid">
            {semCategoria.map(renderProduto)}
          </div>
        </section>
      ) : null}

      <section className="cart-panel">
        <h2>Pedido</h2>

        {carrinho.length === 0 ? (
          <p className="muted">Nenhum item adicionado ainda.</p>
        ) : (
          <>
            <div className="cart-items">
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

            <a className="primary-button cart-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
              Enviar pelo WhatsApp
            </a>
          </>
        )}
      </section>
    </>
  );
}
