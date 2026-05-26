import { query } from '../../lib/db';
import { money } from '../../lib/format';
import { getCurrentUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getAdminData(user, selectedSlug) {
  const empresasResult = await query(
    `SELECT id, nome, slug, ativo, bloqueado, bloqueado_motivo
     FROM food_empresas
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
    return { empresas, empresa: null, categorias: [], produtos: [] };
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
       p.apelidos,
       c.nome AS categoria_nome
     FROM food_produtos p
     LEFT JOIN food_categorias c ON c.id = p.categoria_id
     WHERE p.empresa_id = $1
     ORDER BY p.ativo DESC, c.ordem, p.nome`,
    [empresa.id]
  );

  return {
    empresas,
    empresa,
    categorias: categorias.rows,
    produtos: produtos.rows
  };
}

function Login({ erro }) {
  return (
    <main className="shell admin-shell">
      <section className="panel">
        <h1>Painel Nexora Food</h1>
        <p className="muted">Entre para gerenciar empresas, produtos e catálogos.</p>

        {erro ? <p className="error-text">Email ou senha inválidos.</p> : null}

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

  if (!user) {
    return <Login erro={erro} />;
  }

  const selectedSlug = user.papel === 'nexora_admin' ? searchParams?.slug : null;

  const { empresas, empresa, categorias, produtos } = await getAdminData(
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

  return (
    <main className="shell admin-shell">
      <section className="panel admin-header-panel">
        <div>
          <h1>{isNexoraAdmin ? 'Painel Nexora Food' : `Painel ${empresa.nome}`}</h1>

          <p className="muted">
            {isNexoraAdmin
              ? 'Gerencie os catálogos das empresas clientes.'
              : 'Gerencie produtos, serviços, fotos, preços e disponibilidade.'}
          </p>

          {empresa.bloqueado ? (
            <p className="warning-text">
              Empresa bloqueada. O catálogo público e o painel do cliente estão indisponíveis.
            </p>
          ) : null}
        </div>

        <form action="/admin/logout" method="post">
          <button className="secondary-button" type="submit">
            Sair
          </button>
        </form>
      </section>

      {isNexoraAdmin ? (
        <section className="panel">
          <h2>Empresa</h2>

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

          <div className="admin-actions-row">
            {empresa.bloqueado ? (
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
            )}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>Novo produto</h2>

        <form action="/admin/products" method="post" className="admin-form">
          <input type="hidden" name="empresa_id" value={empresa.id} />

          <label>
            Código
            <input name="codigo" placeholder="coxinha" required />
          </label>

          <label>
            Nome
            <input name="nome" placeholder="Coxinha" required />
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
            <input name="preco" placeholder="8.00" required />
          </label>

          <label className="full-span">
            Imagem URL
            <input name="imagem_url" placeholder="https://..." />
          </label>

          <label className="full-span">
            Descrição
            <textarea name="descricao" placeholder="Descrição curta do item" />
          </label>

          <label className="full-span">
            Apelidos para o bot
            <input name="apelidos" placeholder="coxinha, coxinhas, salgado" />
          </label>

          <label>
            Ativo
            <input name="ativo" type="checkbox" defaultChecked />
          </label>

          <button className="primary-button" type="submit">
            Salvar produto
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Produtos</h2>

        {produtos.length === 0 ? (
          <p className="muted">Nenhum produto cadastrado ainda.</p>
        ) : (
          <div className="admin-products">
            {produtos.map((produto) => (
              <article key={produto.id} className="admin-product-row">
                <div>
                  <strong>{produto.nome}</strong>
                  <p className="muted">
                    {produto.codigo} · {produto.categoria_nome || 'Sem categoria'} · {money(produto.preco)}
                  </p>
                  {produto.apelidos ? (
                    <p className="muted">Apelidos: {produto.apelidos}</p>
                  ) : null}
                </div>

                <span className={produto.ativo ? 'status-pill active' : 'status-pill'}>
                  {produto.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
