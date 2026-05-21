import { query } from '../../../lib/db';
import { money } from '../../../lib/format';

async function getMenu(slug) {
  const empresaResult = await query(
    `SELECT id, nome, slug, whatsapp, logo_url
     FROM food_empresas
     WHERE slug = $1 AND ativo = true
     LIMIT 1`,
    [slug]
  );

  const empresa = empresaResult.rows[0];
  if (!empresa) return null;

  const produtosResult = await query(
    `SELECT
       p.id,
       p.codigo,
       p.nome,
       p.descricao,
       p.preco,
       p.imagem_url,
       COALESCE(c.nome, 'Produtos') AS categoria_nome,
       COALESCE(c.ordem, 999) AS categoria_ordem
     FROM food_produtos p
     LEFT JOIN food_categorias c ON c.id = p.categoria_id
     WHERE p.empresa_id = $1
       AND p.ativo = true
       AND COALESCE(c.ativo, true) = true
     ORDER BY categoria_ordem, categoria_nome, p.nome`,
    [empresa.id]
  );

  return { empresa, produtos: produtosResult.rows };
}

export default async function CardapioPage({ params }) {
  const data = await getMenu(params.slug);

  if (!data) {
    return (
      <main className="shell hero">
        <h1>Cardapio indisponivel</h1>
        <p className="muted">Nao encontramos essa empresa ou ela esta inativa.</p>
      </main>
    );
  }

  const grupos = data.produtos.reduce((acc, produto) => {
    acc[produto.categoria_nome] ||= [];
    acc[produto.categoria_nome].push(produto);
    return acc;
  }, {});

  const categorias = Object.keys(grupos);

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <div className="brand">
            <strong>{data.empresa.nome}</strong>
            <span>Cardapio digital</span>
          </div>
          {data.empresa.whatsapp ? (
            <a className="button" href={`https://wa.me/${data.empresa.whatsapp}`} target="_blank" rel="noreferrer">
              Pedir pelo WhatsApp
            </a>
          ) : null}
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <h1>Escolha seu pedido</h1>
          <p className="muted">Veja fotos, precos e descricoes. Depois envie seu pedido pelo WhatsApp.</p>
        </section>

        {categorias.length ? (
          <nav className="tabs" aria-label="Categorias">
            {categorias.map((categoria) => (
              <a className="tab" href={`#${categoria}`} key={categoria}>{categoria}</a>
            ))}
          </nav>
        ) : null}

        {categorias.map((categoria) => (
          <section className="category" id={categoria} key={categoria}>
            <h2>{categoria}</h2>
            <div className="grid">
              {grupos[categoria].map((produto) => (
                <article className="product" key={produto.id}>
                  {produto.imagem_url ? (
                    <img src={produto.imagem_url} alt={produto.nome} />
                  ) : (
                    <div className="image-placeholder">Sem foto</div>
                  )}
                  <div className="product-body">
                    <h3>{produto.nome}</h3>
                    <p className="description">{produto.descricao || 'Produto disponivel no cardapio.'}</p>
                    <div className="price">{money(produto.preco)}</div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
