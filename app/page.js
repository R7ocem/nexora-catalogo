import { query } from '../../../lib/db';
import { money } from '../../../lib/format';

async function getEmpresa(slug) {
  const empresaResult = await query(
    `SELECT id, nome, slug, whatsapp, logo_url
     FROM food_empresas
     WHERE slug = $1 AND ativo = true
     LIMIT 1`,
    [slug]
  );

  return empresaResult.rows[0] || null;
}

async function getMenu(slug) {
  const empresa = await getEmpresa(slug);
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

export async function generateMetadata({ params }) {
  const empresa = await getEmpresa(params.slug);

  if (!empresa) {
    return {
      title: 'Cardápio indisponível | Nexora Food',
      description: 'Cardápio digital'
    };
  }

  return {
    title: empresa.nome,
    description: `Cardápio digital da ${empresa.nome}`
  };
}

export default async function CardapioPage({ params }) {
  const data = await getMenu(params.slug);

  if (!data) {
    return (
      <main className="shell hero">
        <h1>Cardápio indisponível</h1>
        <p className="muted">Não encontramos essa empresa ou ela está inativa.</p>
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
            <span>Cardápio digital</span>
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
          <p className="muted">Veja fotos, preços e descrições. Depois envie seu pedido pelo WhatsApp.</p>
        </section>

        {categorias.length ? (
