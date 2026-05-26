import { query } from '../../../lib/db';
import { money } from '../../../lib/format';

async function getCardapio(slug) {
  const empresas = await query(
    `SELECT id, nome, slug, whatsapp, ativo, bloqueado, bloqueado_motivo
     FROM food_empresas
     WHERE slug = $1
     LIMIT 1`,
    [slug]
  );

  const empresa = empresas.rows[0];

  if (!empresa || empresa.ativo !== true) {
    return { empresa: null, categorias: [], produtos: [] };
  }

  if (empresa.bloqueado === true) {
    return { empresa, bloqueado: true, categorias: [], produtos: [] };
  }

  const categorias = await query(
    `SELECT id, nome
     FROM food_categorias
     WHERE empresa_id = $1
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
       p.imagem_url,
       p.ativo,
       c.nome AS categoria_nome
     FROM food_produtos p
     LEFT JOIN food_categorias c ON c.id = p.categoria_id
     WHERE p.empresa_id = $1
       AND p.ativo = true
     ORDER BY c.ordem, p.nome`,
    [empresa.id]
  );

  return { empresa, categorias: categorias.rows, produtos: produtos.rows };
}

export async function generateMetadata({ params }) {
  const { empresa } = await getCardapio(params.slug);

  return {
    title: empresa?.nome || 'Cardápio',
    description: empresa
      ? `Cardápio digital ${empresa.nome}`
      : 'Cardápio digital'
  };
}

export default async function CardapioPage({ params }) {
  const { empresa, bloqueado, categorias, produtos } = await getCardapio(params.slug);

  if (!empresa) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Cardápio não encontrado</h1>
          <p className="muted">Confira o link enviado pela empresa.</p>
        </section>
      </main>
    );
  }

  if (bloqueado) {
    return (
      <main className="shell">
        <section className="panel blocked-panel">
          <h1>Cardápio temporariamente indisponível</h1>
          <p className="muted">
            Este cardápio está passando por uma atualização administrativa.
          </p>
        </section>
      </main>
    );
  }

  const whatsapp = empresa.whatsapp || '';
  const whatsappText = encodeURIComponent(
    `Olá! Vi o cardápio da ${empresa.nome} e quero fazer um pedido.`
  );

  const whatsappUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${whatsappText}`
    : '#';

  const produtosPorCategoria = categorias.map((categoria) => ({
    ...categoria,
    produtos: produtos.filter((produto) => produto.categoria_nome === categoria.nome)
  }));

  const semCategoria = produtos.filter((produto) => !produto.categoria_nome);

  return (
    <main>
      <header className="menu-header">
        <div className="menu-header-inner">
          <div>
            <h1>{empresa.nome}</h1>
            <p>Cardápio digital</p>
          </div>

          {whatsapp ? (
            <a className="primary-button" href={whatsappUrl} target="_blank">
              Pedir pelo WhatsApp
            </a>
          ) : null}
        </div>
      </header>

      <section className="shell hero-section">
        <h2>Escolha seu pedido</h2>
        <p className="muted">
          Veja fotos, preços e descrições. Depois envie seu pedido pelo WhatsApp.
        </p>
      </section>

      <section className="shell product-list">
        {produtos.length === 0 ? (
          <div className="panel">
            <h2>Cardápio em atualização</h2>
            <p className="muted">
              Em breve os produtos estarão disponíveis por aqui.
            </p>
          </div>
        ) : (
          <>
            {produtosPorCategoria.map((categoria) =>
              categoria.produtos.length > 0 ? (
                <section key={categoria.id} className="category-block">
                  <h2>{categoria.nome}</h2>

                  <div className="product-grid">
                    {categoria.produtos.map((produto) => (
                      <article key={produto.id} className="product-card">
                        {produto.imagem_url ? (
                          <img src={produto.imagem_url} alt={produto.nome} />
                        ) : (
                          <div className="product-placeholder">Sem foto</div>
                        )}

                        <div className="product-info">
                          <h3>{produto.nome}</h3>

                          {produto.descricao ? (
                            <p>{produto.descricao}</p>
                          ) : null}

                          <strong>{money(produto.preco)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null
            )}

            {semCategoria.length > 0 ? (
              <section className="category-block">
                <h2>Produtos</h2>

                <div className="product-grid">
                  {semCategoria.map((produto) => (
                    <article key={produto.id} className="product-card">
                      {produto.imagem_url ? (
                        <img src={produto.imagem_url} alt={produto.nome} />
                      ) : (
                        <div className="product-placeholder">Sem foto</div>
                      )}

                      <div className="product-info">
                        <h3>{produto.nome}</h3>

                        {produto.descricao ? (
                          <p>{produto.descricao}</p>
                        ) : null}

                        <strong>{money(produto.preco)}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
