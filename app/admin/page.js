import { query } from '../../lib/db';
import { money } from '../../lib/format';
import { getCurrentUser } from '../../lib/auth';

async function getAdminData(user, slug) {
  const empresas = user.papel === 'nexora_admin'
    ? await query(`SELECT id, nome, slug FROM food_empresas WHERE ativo = true ORDER BY nome`)
    : await query(
      `SELECT id, nome, slug
       FROM food_empresas
       WHERE ativo = true AND id = $1
       ORDER BY nome`,
      [user.empresa_id]
    );

  const empresa = empresas.rows.find((item) => item.slug === slug) || empresas.rows[0];
  if (!empresa) return { empresas: [], empresa: null, categorias: [], produtos: [] };

  const categorias = await query(
    `SELECT id, nome FROM food_categorias WHERE empresa_id = $1 ORDER BY ordem, nome`,
    [empresa.id]
  );

  const produtos = await query(
    `SELECT
       p.id, p.codigo, p.nome, p.descricao, p.preco, p.imagem_url, p.ativo,
       c.nome AS categoria_nome, p.categoria_id
     FROM food_produtos p
     LEFT JOIN food_categorias c ON c.id = p.categoria_id
     WHERE p.empresa_id = $1
     ORDER BY p.ativo DESC, c.ordem, p.nome`,
    [empresa.id]
  );

  return { empresas: empresas.rows, empresa, categorias: categorias.rows, produtos: produtos.rows };
}

function Login() {
  return (
    <main className="shell admin">
      <section className="panel">
        <h1>Painel Nexora Food</h1>
        <p className="muted">Entre para editar o cardápio da sua empresa.</p>
        <form className="form-grid" method="post" action="/admin/login">
          <label>
            E-mail
            <input name="email" type="email" placeholder="voce@empresa.com.br" required />
          </label>
          <label>
            Senha
            <input name="password" type="password" required />
          </label>
          <div className="full">
            <button className="button" type="submit">Entrar</button>
          </div>
        </form>
      </section>
    </main>
  );
}

export default async function AdminPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) return <Login />;

  const data = await getAdminData(user, searchParams?.slug);

  return (
    <main className="shell admin">
      <section className="panel">
        <div className="topbar-inner">
          <div>
            <h1>Painel {data.empresa?.nome || 'Nexora Food'}</h1>
            <p className="muted">Gerencie produtos, fotos, preços e disponibilidade.</p>
          </div>
          <form method="post" action="/admin/logout">
            <button className="button secondary" type="submit">Sair</button>
          </form>
        </div>
      </section>

      {data.empresa ? (
        <>
          {user.papel === 'nexora_admin' && data.empresas.length > 1 ? (
            <section className="panel">
              <form className="form-grid" method="get" action="/admin">
                <label>
                  Empresa
                  <select name="slug" defaultValue={data.empresa.slug}>
                    {data.empresas.map((empresa) => (
                      <option key={empresa.id} value={empresa.slug}>{empresa.nome}</option>
                    ))}
                  </select>
                </label>
                <div className="full">
                  <button className="button secondary" type="submit">Trocar empresa</button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="panel">
            <h2>Novo produto</h2>
            <form className="form-grid" method="post" action="/admin/products">
              <input type="hidden" name="empresa_id" value={data.empresa.id} />
              <label>Código<input name="codigo" placeholder="coxinha" required /></label>
              <label>Nome<input name="nome" placeholder="Coxinha" required /></label>
              <label>
                Categoria
                <select name="categoria_id">
                  <option value="">Sem categoria</option>
                  {data.categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
                  ))}
                </select>
              </label>
              <label>Preço<input name="preco" inputMode="decimal" placeholder="8.00" required /></label>
              <label className="full">Imagem URL<input name="imagem_url" placeholder="https://..." /></label>
              <label className="full">Descrição<textarea name="descricao" placeholder="Descrição curta do produto" /></label>
              <label className="full">Apelidos para o bot<input name="aliases" placeholder="coxinha, coxinhas, salgado" /></label>
              <label>Ativo<input name="ativo" type="checkbox" defaultChecked /></label>
              <div className="full"><button className="button" type="submit">Salvar produto</button></div>
            </form>
          </section>

          <section className="panel">
            <h2>Produtos</h2>
            <table className="table">
              <thead>
                <tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.produtos.map((produto) => (
                  <tr key={produto.id}>
                    <td><strong>{produto.nome}</strong><div className="muted">{produto.codigo}</div></td>
                    <td>{produto.categoria_nome || '-'}</td>
                    <td>{money(produto.preco)}</td>
                    <td className={produto.ativo ? 'status' : 'status off'}>{produto.ativo ? 'Ativo' : 'Inativo'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}
