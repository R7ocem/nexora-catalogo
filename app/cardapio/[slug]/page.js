import CatalogoInterativo from './CatalogoInterativo';
import { query } from '../../../lib/db';

async function getCardapio(slug) {
  const empresas = await query(
    `SELECT
     id,
     nome,
     slug,
     whatsapp,
     ativo,
     bloqueado,
     bloqueado_motivo,
     logo_url,
     banner_url,
     titulo_publico,
     subtitulo_publico,
     tema_cor
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
       p.tipo_item,
       p.tipo_preco,
       p.imagem_url,
       p.ativo,
       p.apelidos,
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
      title: empresa?.nome || 'Catálogo',
      description: empresa
        ? `Catálogo digital ${empresa.nome}`
        : 'Catálogo digital'
    };
  }
  
  export default async function CardapioPage({ params }) {
    const { empresa, bloqueado, categorias, produtos } = await getCardapio(params.slug);
  
    if (!empresa) {
      return (
        <main className="shell">
          <section className="panel">
            <h1>Catálogo não encontrado</h1>
            <p className="muted">Confira o link enviado pela empresa.</p>
          </section>
        </main>
      );
    }
  
    if (bloqueado) {
      return (
        <main className="shell">
          <section className="panel blocked-panel">
            <h1>Catálogo temporariamente indisponível</h1>
            <p className="muted">
              Este catálogo está passando por uma atualização administrativa.
            </p>
          </section>
        </main>
      );
    }
    
    const produtosPorCategoria = categorias.map((categoria) => ({
      ...categoria,
      produtos: produtos.filter((produto) => produto.categoria_nome === categoria.nome)
    }));
  
    const semCategoria = produtos.filter((produto) => !produto.categoria_nome);
  
    return (
    <main>
      <section className="shell product-list">
        {produtos.length === 0 ? (
          <div className="panel">
            <h2>Catálogo em atualização</h2>
            <p className="muted">
              Em breve os itens estarão disponíveis por aqui.
            </p>
          </div>
        ) : (
          <CatalogoInterativo
            empresa={empresa}
            categorias={produtosPorCategoria}
            semCategoria={semCategoria}
          />
        )}
      </section>
    </main>
  );   
}
