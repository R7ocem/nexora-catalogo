import { query } from '../../lib/db';
import { money } from '../../lib/format';
import { getCurrentUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const segmentos = {
  alimentacao: 'Alimentação',
  festas_decoracao: 'Festas e decoração',
  moda: 'Moda',
  beleza: 'Beleza',
  saude: 'Saúde',
  educacao: 'Educação',
  servicos_gerais: 'Serviços gerais',
  automotivo: 'Automotivo',
  casa_construcao: 'Casa e construção',
  tecnologia: 'Tecnologia',
  outros: 'Outros'
};

const tiposOferta = {
  produtos: 'Produtos',
  servicos: 'Serviços',
  misto: 'Produtos e serviços'
};

async function getAdminData(user, selectedSlug) {
  const empresasResult = await query(
    `SELECT
       id,
       nome,
       slug,
       whatsapp,
       ativo,
       bloqueado,
       bloqueado_motivo,
       segmento,
       tipo_oferta,
       tema_cor,
       logo_url,
       titulo_publico,
       subtitulo_publico
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
       p.tipo_item,
       p.tipo_preco,
       p.imagem_url,
       p.ativo,
       p.apelidos,
       p.categoria_id,
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
        <h1>Painel Nexora Catálogos</h1>
        <p className="muted">Entre para gerenciar empresas, produtos, serviços e catálogos.</p>

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
  const nomePublico = empresa.titulo_publico || empresa.nome;

  return (
    <main className="shell admin-shell">
      <section className="panel admin-header-panel">
  <div>
    <h1>{isNexoraAdmin ? 'Painel Nexora Catálogos' : `Painel ${nomePublico}`}</h1>

    <p className="muted">
      {isNexoraAdmin
        ? 'Gerencie os catálogos das empresas clientes.'
        : 'Gerencie itens, fotos, preços e disponibilidade.'}
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
      <section className="panel">
        <h2>Minha senha</h2>

        {searchParams?.erro === 'senha' ? (
          <p className="error-text">
            A nova senha precisa ter pelo menos 8 caracteres e a confirmação deve ser igual.
          </p>
        ) : null}

        {searchParams?.erro === 'senha_atual' ? (
          <p className="error-text">
            Senha atual incorreta.
          </p>
        ) : null}

        {searchParams?.senha === 'alterada' ? (
          <p className="warning-text">
            Senha alterada com sucesso.
          </p>
        ) : null}

        <form action="/admin/password" method="post" className="admin-form">
          <label>
            Senha atual
            <input name="senha_atual" type="password" required />
          </label>

          <label>
            Nova senha
            <input name="senha_nova" type="password" required />
          </label>

          <label>
            Confirmar senha
            <input name="confirmar_senha" type="password" required />
          </label>

          <button className="secondary-button" type="submit">
            Alterar senha
          </button>
        </form>
      </section>
      
      {isNexoraAdmin ? (
        <section className="panel">
          <h2>Criar nova empresa</h2>

          <form action="/admin/companies" method="post" className="admin-form">
            <label>
              Nome da empresa
              <input name="nome" placeholder="Nome do cliente" required />
            </label>

            <label>
              Link do catálogo
              <input name="slug" placeholder="ex: viva-festas" />
            </label>

            <label>
              WhatsApp
              <input name="whatsapp" placeholder="DDD + número. Ex: 61999999999" />
            </label>

            <label>
              Segmento
              <select name="segmento" defaultValue="outros">
                <option value="alimentacao">Alimentação</option>
                <option value="festas_decoracao">Festas e decoração</option>
                <option value="moda">Moda</option>
                <option value="beleza">Beleza</option>
                <option value="saude">Saúde</option>
                <option value="educacao">Educação</option>
                <option value="servicos_gerais">Serviços gerais</option>
                <option value="automotivo">Automotivo</option>
                <option value="casa_construcao">Casa e construção</option>
                <option value="tecnologia">Tecnologia</option>
                <option value="outros">Outros</option>
              </select>
            </label>

            <label>
              Tipo de oferta
              <select name="tipo_oferta" defaultValue="produtos">
                <option value="produtos">Produtos</option>
                <option value="servicos">Serviços</option>
                <option value="misto">Produtos e serviços</option>
              </select>
            </label>

            <button className="primary-button" type="submit">
              Criar empresa
            </button>
          </form>
        </section>
      ) : null}

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

          <div className="company-summary">
            <div>
              <span>Segmento</span>
              <strong>{segmentos[empresa.segmento] || empresa.segmento}</strong>
            </div>

            <div>
              <span>Oferta</span>
              <strong>{tiposOferta[empresa.tipo_oferta] || empresa.tipo_oferta}</strong>
            </div>

            <div>
              <span>Link público</span>
              <strong>/cardapio/{empresa.slug}</strong>
            </div>
          </div>

            <form action="/admin/company" method="post" className="admin-form company-edit-form">
            <input type="hidden" name="empresa_id" value={empresa.id} />

            <label>
              Nome da empresa
              <input name="nome" defaultValue={empresa.nome || ''} required />
            </label>

            <label>
              WhatsApp
              <input name="whatsapp" defaultValue={empresa.whatsapp || ''} placeholder="DDD + número. Ex: 61999999999" />
            </label>

            <label>
              Segmento
              <select name="segmento" defaultValue={empresa.segmento || 'outros'}>
                <option value="alimentacao">Alimentação</option>
                <option value="festas_decoracao">Festas e decoração</option>
                <option value="moda">Moda</option>
                <option value="beleza">Beleza</option>
                <option value="saude">Saúde</option>
                <option value="educacao">Educação</option>
                <option value="servicos_gerais">Serviços gerais</option>
                <option value="automotivo">Automotivo</option>
                <option value="casa_construcao">Casa e construção</option>
                <option value="tecnologia">Tecnologia</option>
                <option value="outros">Outros</option>
              </select>
            </label>

            <label>
              Tipo de oferta
              <select name="tipo_oferta" defaultValue={empresa.tipo_oferta || 'produtos'}>
                <option value="produtos">Produtos</option>
                <option value="servicos">Serviços</option>
                <option value="misto">Produtos e serviços</option>
              </select>
            </label>

            <label>
              Título público
              <input name="titulo_publico" defaultValue={empresa.titulo_publico || empresa.nome || ''} />
            </label>

            <label>
              Subtítulo público
              <input name="subtitulo_publico" defaultValue={empresa.subtitulo_publico || ''} />
            </label>

            <label>
              Cor principal
              <input name="tema_cor" type="color" defaultValue={empresa.tema_cor || '#0f766e'} />
            </label>

            <label>
              Logo URL
              <input name="logo_url" defaultValue={empresa.logo_url || ''} placeholder="https://..." />
            </label>

            <button className="primary-button" type="submit">
              Salvar dados da empresa
            </button>
          </form>

          <form action="/admin/users" method="post" className="admin-form company-user-form">
            <input type="hidden" name="empresa_id" value={empresa.id} />

            <label>
              Nome do usuário
              <input name="nome" placeholder="Nome do responsável" required />
            </label>

            <label>
              Email de acesso
              <input name="email" type="email" placeholder="cliente@email.com" required />
            </label>

            <label>
              Senha temporária
              <input name="senha" type="text" placeholder="Senha inicial do cliente" required />
            </label>

            <button className="primary-button" type="submit">
              Criar acesso da empresa
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

        <section className="panel" id="categorias">
         <h2>Categorias</h2>

  {searchParams?.erro === 'categoria' ? (
    <p className="error-text">
      Informe o nome da categoria.
    </p>
  ) : null}

  <form action="/admin/categories" method="post" className="admin-form compact-form">
    <input type="hidden" name="empresa_id" value={empresa.id} />
    <input type="hidden" name="acao" value="criar" />

    <label>
      Nova categoria
      <input name="nome" placeholder="Ex: Salgados, Bebidas, Decoração" required />
    </label>

    <button className="primary-button" type="submit">
      Criar categoria
    </button>
  </form>

  {categorias.length === 0 ? (
    <p className="muted">Nenhuma categoria criada ainda.</p>
  ) : (
    <div className="category-admin-list">
      {categorias.map((categoria) => (
        <div key={categoria.id} className="category-admin-item">
          <form action="/admin/categories" method="post" className="category-admin-name">
            <input type="hidden" name="empresa_id" value={empresa.id} />
            <input type="hidden" name="categoria_id" value={categoria.id} />
            <input type="hidden" name="acao" value="renomear" />

            <input name="nome" defaultValue={categoria.nome} required />

            <button className="secondary-button" type="submit">
              Renomear
            </button>
          </form>

          <div className="category-admin-actions">
            <form action="/admin/categories" method="post">
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <input type="hidden" name="categoria_id" value={categoria.id} />
              <input type="hidden" name="acao" value="subir" />

              <button className="secondary-button" type="submit">
                Subir
              </button>
            </form>

            <form action="/admin/categories" method="post">
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <input type="hidden" name="categoria_id" value={categoria.id} />
              <input type="hidden" name="acao" value="descer" />

              <button className="secondary-button" type="submit">
                Descer
              </button>
            </form>

            <form action="/admin/categories" method="post">
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <input type="hidden" name="categoria_id" value={categoria.id} />
              <input type="hidden" name="acao" value="excluir" />

              <button className="danger-button" type="submit">
                Excluir
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  )}
</section>

      <section className="panel" id="novo-item">
        <h2>Novo item</h2>

        {searchParams?.erro === 'preco' ? (
         <p className="error-text">
           Informe o preço quando o tipo de preço for Preço fixo ou A partir de.
         </p>
        ) : null}

        {searchParams?.erro === 'apelidos' ? (
          <p className="error-text">
            Informe os apelidos para o bot encontrar este item.
          </p>
        ) : null}

          <form action="/admin/products" method="post" className="admin-form product-form" encType="multipart/form-data">
          <input type="hidden" name="empresa_id" value={empresa.id} />

          <label>
            Código
            <input name="codigo" placeholder="code prod" required />
          </label>

          <label>
            Nome
            <input name="nome" placeholder="Produto/serviço" required />
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
            <input name="preco" placeholder="50.00" />
          </label>

           <label>
            Tipo do item
            <select name="tipo_item" defaultValue="produto">
              <option value="produto">Produto</option>
              <option value="servico">Serviço</option>
              <option value="pacote">Pacote/Combo</option>
            </select>
          </label>

            <label>
            Tipo de preço
            <select name="tipo_preco" defaultValue="fixo">
              <option value="fixo">Preço fixo</option>
              <option value="a_partir_de">A partir de</option>
              <option value="sob_consulta">Sob consulta</option>
            </select>
          </label>

          <label className="full-span">
          Foto do item
          <input type="file" name="foto" accept="image/*" />
          <input type="hidden" name="imagem_url" />
        </label>

          <label className="full-span">
            Descrição
            <textarea name="descricao" placeholder="Descrição curta do item" />
          </label>

          <label className="full-span">
            Apelidos para o bot
            <input name="apelidos" placeholder="produtos ou serviços do bot" required />
          </label>

           <label>
            Ativo
            <input name="ativo" type="checkbox" defaultChecked />
          </label>

          <button className="primary-button" type="submit">
            Salvar item
          </button>
        </form>
      </section>

     <section className="panel" id="itens">
        <h2>Itens cadastrados</h2>
      
        {produtos.length === 0 ? (
          <p className="muted">Nenhum item cadastrado ainda.</p>
        ) : (
          <div className="admin-products editable-products">
            {produtos.map((produto) => (
              <div key={produto.id} className="admin-product-edit-wrap">
                <form
                  action="/admin/products"
                  method="post"
                  className="photo-form"
                  encType="multipart/form-data"
                >
                  <input type="hidden" name="produto_id" value={produto.id} />
                  <input type="hidden" name="empresa_id" value={empresa.id} />
                  <input type="hidden" name="codigo" value={produto.codigo || ''} />
                  <input type="hidden" name="nome" value={produto.nome || ''} />
                  <input type="hidden" name="categoria_id" value={produto.categoria_id || ''} />
                  <input type="hidden" name="preco" value={produto.preco || '0'} />
                  <input type="hidden" name="tipo_item" value={produto.tipo_item || 'produto'} />
                  <input type="hidden" name="tipo_preco" value={produto.tipo_preco || 'fixo'} />
                  <input type="hidden" name="descricao" value={produto.descricao || ''} />
                  <input type="hidden" name="apelidos" value={produto.apelidos || ''} />
                  <input type="hidden" name="imagem_url" value={produto.imagem_url || ''} />
                  {produto.ativo ? <input type="hidden" name="ativo" value="on" /> : null}
      
                  <div className="photo-editor">
                    <span className="field-title">Foto do item</span>
      
                    {produto.imagem_url ? (
                      <img className="admin-image-preview" src={produto.imagem_url} alt={produto.nome} />
                    ) : (
                      <span className="muted">Nenhuma foto cadastrada.</span>
                    )}
      
                    <div className="photo-actions">
                      <label className="secondary-button photo-button">
                        {produto.imagem_url ? 'Trocar foto' : 'Adicionar foto'}
                        <input className="file-hidden photo-auto-submit" type="file" name="foto" accept="image/*" />
                      </label>
      
                      {produto.imagem_url ? (
                        <button
                          className="danger-button"
                          type="submit"
                          name="remover_imagem"
                          value="1"
                        >
                          Excluir foto
                        </button>
                      ) : null}
                    </div>
                  </div>
                </form>
      
                <form
                  action="/admin/products"
                  method="post"
                  className="admin-product-edit product-form"
                >
                  <input type="hidden" name="produto_id" value={produto.id} />
                  <input type="hidden" name="empresa_id" value={empresa.id} />
                  <input type="hidden" name="imagem_url" value={produto.imagem_url || ''} />
      
                  <div className="edit-grid">
                    <label>
                      Código
                      <input name="codigo" defaultValue={produto.codigo || ''} required />
                    </label>
      
                    <label>
                      Nome
                      <input name="nome" defaultValue={produto.nome || ''} required />
                    </label>
      
                    <label>
                      Categoria
                      <select name="categoria_id" defaultValue={produto.categoria_id || ''}>
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
                      <input name="preco" defaultValue={produto.preco || '0'} />
                    </label>
      
                    <label>
                      Tipo do item
                      <select name="tipo_item" defaultValue={produto.tipo_item || 'produto'}>
                        <option value="produto">Produto</option>
                        <option value="servico">Serviço</option>
                        <option value="pacote">Pacote/Combo</option>
                      </select>
                    </label>
      
                    <label>
                      Tipo de preço
                      <select name="tipo_preco" defaultValue={produto.tipo_preco || 'fixo'}>
                        <option value="fixo">Preço fixo</option>
                        <option value="a_partir_de">A partir de</option>
                        <option value="sob_consulta">Sob consulta</option>
                      </select>
                    </label>
      
                    <label className="full-span">
                      Descrição
                      <textarea name="descricao" defaultValue={produto.descricao || ''} />
                    </label>
      
                    <label className="full-span">
                      Apelidos para o bot
                      <input name="apelidos" defaultValue={produto.apelidos || ''} required />
                    </label>
      
                    <label>
                      Ativo
                      <input name="ativo" type="checkbox" defaultChecked={produto.ativo} />
                    </label>
                  </div>
      
                  <div className="admin-actions-row">
                    <button className="primary-button" type="submit">
                      Salvar alterações
                    </button>
      
                    <span className={produto.ativo ? 'status-pill active' : 'status-pill'}>
                      {produto.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </form>
      
                <form action="/admin/products/delete" method="post" className="delete-product-form admin-actions-row">
                  <input type="hidden" name="produto_id" value={produto.id} />
                  <input type="hidden" name="empresa_id" value={empresa.id} />
                  <button className="danger-button" type="submit">
                    Excluir item
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
                <script
        dangerouslySetInnerHTML={{
          __html: `
            document.querySelectorAll('.product-form').forEach(function (form) {
              var tipoPreco = form.querySelector('[name="tipo_preco"]');
              var preco = form.querySelector('[name="preco"]');

              if (!tipoPreco || !preco) return;

              function atualizarObrigatorio() {
                if (tipoPreco.value === 'sob_consulta') {
                  preco.required = false;
                  preco.setCustomValidity('');
                } else {
                  preco.required = true;
                }
              }

              tipoPreco.addEventListener('change', atualizarObrigatorio);

              form.addEventListener('submit', function (event) {
                atualizarObrigatorio();

                var valor = Number(String(preco.value || '').replace(',', '.'));

                if (tipoPreco.value !== 'sob_consulta' && (!preco.value || valor <= 0)) {
                  event.preventDefault();
                  preco.setCustomValidity('Informe o preço para preço fixo ou a partir de.');
                  preco.reportValidity();
                  return;
                }

                preco.setCustomValidity('');
              });

              atualizarObrigatorio();
            });

            document.querySelectorAll('.photo-auto-submit').forEach(function (input) {
              input.addEventListener('change', function () {
                if (!input.files || input.files.length === 0) return;

                var form = input.closest('form');
                if (!form) return;

                var button = form.querySelector('.photo-button');
                if (button) {
                  button.textContent = 'Enviando foto...';
                }

                form.requestSubmit();
              });
            });
          `
        }}
      />
    </main>
  );
}
