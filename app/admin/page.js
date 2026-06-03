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

const fundosCatalogo = [
  ['claro', 'Claro'],
  ['escuro', 'Escuro'],
  ['personalizado', 'Personalizado']
];

const diasSemana = [
  ['0', 'Domingo'],
  ['1', 'Segunda'],
  ['2', 'Terça'],
  ['3', 'Quarta'],
  ['4', 'Quinta'],
  ['5', 'Sexta'],
  ['6', 'Sábado']
];

function getHorariosFuncionamento(valor) {
  const horarios = valor && typeof valor === 'object' ? valor : {};

  return diasSemana.map(([dia, nome]) => ({
    dia,
    nome,
    ativo: Boolean(horarios[dia]?.ativo),
    abre: horarios[dia]?.abre || '08:00',
    fecha: horarios[dia]?.fecha || '18:00'
  }));
}

function getOpcoesPedido(valor) {
  const opcoes = valor && typeof valor === 'object' ? valor : {};

  return {
    retirada: opcoes.retirada !== false,
    entrega: opcoes.entrega !== false,
    pix: opcoes.pix !== false,
    dinheiro: opcoes.dinheiro !== false,
    cartao: opcoes.cartao !== false
  };
}

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
       tema_cor_secundaria,
       usar_gradiente,
       catalogo_fundo_tipo,
       catalogo_fundo_cor,
       logo_posicao,
       logo_zoom,
       banner_posicao,
       banner_zoom,
       logo_url,
       banner_url,
       instagram_url,
       titulo_publico,
       subtitulo_publico,
       descricao_publica,
       horario_funcionamento,
       opcoes_pedido
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
       p.destaque,
       p.destaque_ordem,
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
  const horariosFuncionamento = getHorariosFuncionamento(empresa.horario_funcionamento);
  const opcoesPedido = getOpcoesPedido(empresa.opcoes_pedido);

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

          {searchParams?.erro === 'email' ? (
            <p className="error-text">Este email já está cadastrado.</p>
          ) : null}

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

            <label>
              Nome do responsável
              <input name="usuario_nome" placeholder="Nome de quem vai acessar" required />
            </label>
            
            <label>
              Email de acesso
              <input name="usuario_email" type="email" placeholder="cliente@email.com" required />
            </label>
            
            <label>
              Senha temporária
              <input name="usuario_senha" type="text" placeholder="Senha inicial do cliente" required />
            </label>
            
            <button className="primary-button" type="submit">
              Criar empresa e acesso
            </button>
          </form>
        </section>
      ) : null}

     <section className="panel" id="empresa">
        <h2>Empresa</h2>
    
      {isNexoraAdmin ? (
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
      ) : null}
    
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
    
      <form id={`company-edit-form-${empresa.id}`} action="/admin/company" method="post" className="admin-form company-edit-form">
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
          Instagram
          <input name="instagram_url" defaultValue={empresa.instagram_url || ''} placeholder="@sua_loja ou link completo" />
        </label>
    
        <label className="full-span">
          Descrição da empresa
          <textarea
            name="descricao_publica"
            defaultValue={empresa.descricao_publica || ''}
            placeholder="Conte um pouco sobre a empresa, história, diferenciais ou informações importantes para o cliente."
          />
        </label>
    
        <div className="full-span theme-builder">
          <div>
            <span className="field-title">Sistema de cores</span>
            <small className="media-hint">Escolha duas cores para criar um visual com gradiente tecnológico no catálogo.</small>
          </div>

          <div className="theme-grid">
            <label>
              Cor principal
              <input name="tema_cor" type="color" defaultValue={empresa.tema_cor || '#0f766e'} />
            </label>

            <label>
              Cor secundária
              <input name="tema_cor_secundaria" type="color" defaultValue={empresa.tema_cor_secundaria || '#14b8a6'} />
            </label>

            <label className="checkbox-field">
              <input name="usar_gradiente" type="checkbox" defaultChecked={empresa.usar_gradiente !== false} />
              Usar gradiente no catálogo
            </label>
          </div>

          <div
            className="theme-preview"
            style={{
              background: empresa.usar_gradiente === false
                ? (empresa.tema_cor || '#0f766e')
                : `linear-gradient(135deg, ${empresa.tema_cor || '#0f766e'}, ${empresa.tema_cor_secundaria || '#14b8a6'})`
            }}
          >
            Prévia do tema
          </div>
        </div>

        <div className="full-span admin-options-panel">
          <span className="field-title">Fundo do catalogo</span>
          <small className="media-hint">Escolha um fundo claro, escuro ou uma cor personalizada para a tela do cliente.</small>

          <div className="theme-grid">
            <label>
              Tipo de fundo
              <select name="catalogo_fundo_tipo" defaultValue={empresa.catalogo_fundo_tipo || 'claro'}>
                {fundosCatalogo.map(([valor, label]) => (
                  <option key={valor} value={valor}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Cor personalizada
              <input name="catalogo_fundo_cor" type="color" defaultValue={empresa.catalogo_fundo_cor || '#f7f4ef'} />
            </label>
          </div>
        </div>

        <div className="full-span admin-options-panel">
          <span className="field-title">Horários de funcionamento</span>
          <small className="media-hint">Marque os dias de atendimento. O catálogo mostra Aberto ou Fechado automaticamente.</small>

          <div className="hours-grid">
            {horariosFuncionamento.map((horario) => (
              <div key={horario.dia} className="hours-row">
                <label className="checkbox-field">
                  <input name={`dia_${horario.dia}_ativo`} type="checkbox" defaultChecked={horario.ativo} />
                  {horario.nome}
                </label>

                <input name={`dia_${horario.dia}_abre`} type="time" defaultValue={horario.abre} />
                <input name={`dia_${horario.dia}_fecha`} type="time" defaultValue={horario.fecha} />
              </div>
            ))}
          </div>
        </div>

        <div className="full-span admin-options-panel">
          <span className="field-title">Opções do pedido</span>
          <small className="media-hint">O cliente escolhe antes de enviar o pedido pelo WhatsApp.</small>

          <div className="option-checks">
            <label className="checkbox-field">
              <input name="pedido_retirada" type="checkbox" defaultChecked={opcoesPedido.retirada} />
              Retirada
            </label>

            <label className="checkbox-field">
              <input name="pedido_entrega" type="checkbox" defaultChecked={opcoesPedido.entrega} />
              Entrega
            </label>

            <label className="checkbox-field">
              <input name="pagamento_pix" type="checkbox" defaultChecked={opcoesPedido.pix} />
              Pix
            </label>

            <label className="checkbox-field">
              <input name="pagamento_dinheiro" type="checkbox" defaultChecked={opcoesPedido.dinheiro} />
              Dinheiro
            </label>

            <label className="checkbox-field">
              <input name="pagamento_cartao" type="checkbox" defaultChecked={opcoesPedido.cartao} />
              Cartão
            </label>
          </div>
        </div>
    
             <div className="full-span company-media-grid">
        <div className="company-media-card">
          <span className="field-title">Logo da empresa</span>
          <small className="media-hint">Ideal: imagem quadrada, 600 x 600 px.</small>

          <input
            type="hidden"
            name="logo_posicao"
            data-media-position-field="logo_posicao"
            form={`company-edit-form-${empresa.id}`}
            defaultValue={empresa.logo_posicao || '50% 50%'}
          />

          {empresa.logo_url ? (
            <div className="media-adjust-frame logo-adjust-frame" data-position-input="logo_posicao">
              <img
                className="company-logo-preview"
                src={empresa.logo_url}
                alt={`Logo ${empresa.nome}`}
                style={{
                  objectPosition: empresa.logo_posicao || '50% 50%',
                  transform: `scale(${Number(empresa.logo_zoom || 1) || 1})`
                }}
              />
            </div>
          ) : (
            <span className="muted">Nenhuma logo cadastrada.</span>
          )}

          <label className="media-zoom-field">
            Zoom da logo
            <input
              name="logo_zoom"
              data-media-zoom-field="logo_zoom"
              form={`company-edit-form-${empresa.id}`}
              type="range"
              min="1"
              max="2"
              step="0.05"
              defaultValue={empresa.logo_zoom || 1}
            />
          </label>
      
       <div className="photo-actions">
          <label className="secondary-button photo-button">
            {empresa.logo_url ? 'Escolher nova logo' : 'Escolher logo'}
            <input
              className="file-hidden"
              type="file"
              name="foto"
              accept="image/*"
              form={`company-logo-form-${empresa.id}`}
            />
          </label>
        
          <button
            className="primary-button"
            type="submit"
            form={`company-logo-form-${empresa.id}`}
          >
            Salvar logo
          </button>
        
          {empresa.logo_url ? (
            <button
              className="danger-button"
              type="submit"
              form={`company-logo-delete-form-${empresa.id}`}
            >
             Excluir logo
            </button>
          ) : null}
        </div>
      </div>
      
        <div className="company-media-card">
          <span className="field-title">Banner do catálogo</span>
          <small className="media-hint">Ideal: imagem horizontal, 1600 x 600 px ou 1920 x 720 px.</small>
      
          <input
            type="hidden"
            name="banner_posicao"
            data-media-position-field="banner_posicao"
            form={`company-edit-form-${empresa.id}`}
            defaultValue={empresa.banner_posicao || '50% 50%'}
          />

          {empresa.banner_url ? (
            <div className="media-adjust-frame banner-adjust-frame" data-position-input="banner_posicao">
              <img
                className="company-banner-preview"
                src={empresa.banner_url}
                alt={`Banner ${empresa.nome}`}
                style={{
                  objectPosition: empresa.banner_posicao || '50% 50%',
                  transform: `scale(${Number(empresa.banner_zoom || 1) || 1})`
                }}
              />
            </div>
          ) : (
            <span className="muted">Nenhum banner cadastrado.</span>
          )}

          <label className="media-zoom-field">
            Zoom do banner
            <input
              name="banner_zoom"
              data-media-zoom-field="banner_zoom"
              form={`company-edit-form-${empresa.id}`}
              type="range"
              min="1"
              max="2"
              step="0.05"
              defaultValue={empresa.banner_zoom || 1}
            />
          </label>
      
        <div className="photo-actions">
          <label className="secondary-button photo-button">
            {empresa.banner_url ? 'Escolher novo banner' : 'Escolher banner'}
            <input
              className="file-hidden"
              type="file"
              name="foto"
              accept="image/*"
              form={`company-banner-form-${empresa.id}`}
            />
          </label>
        
          <button
            className="primary-button"
            type="submit"
            form={`company-banner-form-${empresa.id}`}
          >
            Salvar banner
          </button>
        
          {empresa.banner_url ? (
            <button
              className="danger-button"
              type="submit"
              form={`company-banner-delete-form-${empresa.id}`}
            >
              Excluir banner
           </button>
         ) : null}
      </div>
   </div>
 </div>
      
      </form>

       <form id={`company-logo-form-${empresa.id}`} action="/admin/company-media" method="post" encType="multipart/form-data">
       <input type="hidden" name="empresa_id" value={empresa.id} />
       <input type="hidden" name="tipo" value="logo" />
       <input type="hidden" name="logo_posicao" value={empresa.logo_posicao || '50% 50%'} />
       <input type="hidden" name="logo_zoom" value={empresa.logo_zoom || 1} />
      </form>
      
       <form id={`company-logo-delete-form-${empresa.id}`} action="/admin/company-media" method="post">
        <input type="hidden" name="empresa_id" value={empresa.id} />
        <input type="hidden" name="tipo" value="logo" />
        <input type="hidden" name="acao" value="excluir" />
      </form>
      
       <form id={`company-banner-form-${empresa.id}`} action="/admin/company-media" method="post" encType="multipart/form-data">
        <input type="hidden" name="empresa_id" value={empresa.id} />
        <input type="hidden" name="tipo" value="banner" />
        <input type="hidden" name="banner_posicao" value={empresa.banner_posicao || '50% 50%'} />
        <input type="hidden" name="banner_zoom" value={empresa.banner_zoom || 1} />
      </form>
      
       <form id={`company-banner-delete-form-${empresa.id}`} action="/admin/company-media" method="post">
        <input type="hidden" name="empresa_id" value={empresa.id} />
        <input type="hidden" name="tipo" value="banner" />
        <input type="hidden" name="acao" value="excluir" />
      </form>
          

          <div className="company-action-bar">
            {isNexoraAdmin ? (
              empresa.bloqueado ? (
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
              )
            ) : <span />}

            <button className="primary-button" type="submit" form={`company-edit-form-${empresa.id}`}>
              Salvar dados da empresa
            </button>
          </div>
        </section>
      
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

          <div className="full-span photo-editor">
            <span className="field-title">Foto do item</span>
          
          <div className="photo-actions">
            <label className="photo-primary-button photo-button">
              Adicionar foto
              <input className="file-hidden photo-file-name-input" type="file" name="foto" accept="image/*" />
            </label>
          
            <span className="photo-file-name muted">Nenhuma foto selecionada.</span>
          </div>
          
            <input type="hidden" name="imagem_url" />
          </div>

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

          <label className="checkbox-field">
            <input name="destaque" type="checkbox" />
            Mostrar nos destaques
          </label>

          <label>
            Posicao no destaque
            <select name="destaque_ordem" defaultValue="0">
              <option value="0">Automatico</option>
              <option value="1">Primeiro</option>
              <option value="2">Segundo</option>
              <option value="3">Terceiro</option>
              <option value="4">Quarto</option>
              <option value="5">Quinto</option>
              <option value="6">Sexto</option>
            </select>
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
                  {produto.destaque ? <input type="hidden" name="destaque" value="on" /> : null}
                  <input type="hidden" name="destaque_ordem" value={produto.destaque_ordem || 0} />
      
                  <div className="photo-editor">
                    <span className="field-title">Foto do item</span>
      
                    {produto.imagem_url ? (
                      <img className="admin-image-preview" src={produto.imagem_url} alt={produto.nome} />
                    ) : (
                      <span className="muted">Nenhuma foto cadastrada.</span>
                    )}
      
                    <div className="photo-actions">
                      <label className="photo-primary-button photo-button">
                        {produto.imagem_url ? 'Trocar foto' : 'Adicionar foto'}
                        <input className="file-hidden photo-auto-submit" type="file" name="foto" accept="image/*" />
                      </label>

                    <button className="file-hidden photo-submit-button" type="submit">
                      Salvar foto
                    </button>
      
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

                    <label className="checkbox-field">
                      <input name="destaque" type="checkbox" defaultChecked={produto.destaque} />
                      Mostrar nos destaques
                    </label>

                    <label>
                      Posicao no destaque
                      <select name="destaque_ordem" defaultValue={String(Math.min(6, Math.max(0, Number(produto.destaque_ordem || 0))))}>
                        <option value="0">Automatico</option>
                        <option value="1">Primeiro</option>
                        <option value="2">Segundo</option>
                        <option value="3">Terceiro</option>
                        <option value="4">Quarto</option>
                        <option value="5">Quinto</option>
                        <option value="6">Sexto</option>
                      </select>
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
                
                var submitButton = form.querySelector('.photo-submit-button');
                if (submitButton) {
                  submitButton.click();
                }
              });
            });
          
                    document.querySelectorAll('.photo-file-name-input').forEach(function (input) {
                      input.addEventListener('change', function () {
                        var label = input.closest('.photo-actions')?.querySelector('.photo-file-name');
              
                        if (!label) return;
              
                        if (input.files && input.files.length > 0) {
                          label.textContent = 'Foto selecionada: ' + input.files[0].name;
                        } else {
                          label.textContent = 'Nenhuma foto selecionada.';
                        }
                      });
                    });
          
                    document.querySelectorAll('.company-media-auto-submit').forEach(function (input) {
            input.addEventListener('change', function () {
              if (!input.files || input.files.length === 0) return;
          
              var formId = input.getAttribute('form');
              var form = formId ? document.getElementById(formId) : null;
              var button = input.closest('.photo-button');
          
              if (button) {
                button.textContent = 'Enviando imagem...';
              }
          
              if (form) {
                form.requestSubmit();
              }
            });
          });

          document.querySelectorAll('.company-media-card').forEach(function (card) {
            var frame = card.querySelector('.media-adjust-frame');
            var zoomInput = card.querySelector('[data-media-zoom-field]');
            var positionInput = card.querySelector('[data-media-position-field]');
            var positionName = positionInput ? positionInput.name : '';
            var zoomName = zoomInput ? zoomInput.name : '';

            function image() {
              return card.querySelector('img');
            }

            function syncFields(name, value) {
              if (!name) return;

              document.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
                input.value = value;
              });
            }

            function transformForPosition(position, zoom) {
              var match = String(position || '50% 50%').match(/([0-9.]+)%\s+([0-9.]+)%/);
              var x = match ? Number(match[1]) : 50;
              var y = match ? Number(match[2]) : 50;
              var safeZoom = Number(zoom || 1) || 1;
              var moveFactor = Math.max(0, safeZoom - 1) * 55;
              var translateX = ((50 - x) / 50) * moveFactor;
              var translateY = ((50 - y) / 50) * moveFactor;

              return 'translate(' + translateX.toFixed(2) + '%, ' + translateY.toFixed(2) + '%) scale(' + safeZoom + ')';
            }

            function applyZoom() {
              var preview = image();
              if (!preview || !zoomInput) return;

              preview.style.transform = transformForPosition(positionInput?.value, zoomInput.value || '1');
              syncFields(zoomName, zoomInput.value || '1');
            }

            function positionParts() {
              var value = positionInput ? String(positionInput.value || '50% 50%') : '50% 50%';
              var match = value.match(/([0-9.]+)%\s+([0-9.]+)%/);

              if (!match) return { x: 50, y: 50 };

              return {
                x: Number(match[1]) || 50,
                y: Number(match[2]) || 50
              };
            }

            function savePosition(x, y) {
              var preview = image();
              if (!preview || !positionInput) return;

              var nextX = Math.max(0, Math.min(100, x));
              var nextY = Math.max(0, Math.min(100, y));
              var value = nextX.toFixed(1) + '% ' + nextY.toFixed(1) + '%';

              positionInput.value = value;
              syncFields(positionName, value);
              preview.style.objectPosition = value;
              preview.style.transform = transformForPosition(value, zoomInput?.value || '1');
            }

            function setPosition(clientX, clientY) {
              var currentFrame = frame || card.querySelector('.media-adjust-frame');
              if (!currentFrame || !positionInput) return;

              var rect = currentFrame.getBoundingClientRect();
              var x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
              var y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

              savePosition(x, y);
            }

            function movePosition(start, clientX, clientY) {
              var currentFrame = frame || card.querySelector('.media-adjust-frame');
              if (!currentFrame || !positionInput || !start) return;

              var rect = currentFrame.getBoundingClientRect();
              var deltaX = ((clientX - start.clientX) / rect.width) * 100;
              var deltaY = ((clientY - start.clientY) / rect.height) * 100;

              savePosition(start.x + deltaX, start.y + deltaY);
            }

            if (zoomInput) {
              zoomInput.addEventListener('input', applyZoom);
              applyZoom();
            }

            if (frame && positionInput) {
              var dragging = false;
              var dragStart = null;
              var moved = false;

              frame.addEventListener('pointerdown', function (event) {
                dragging = true;
                moved = false;
                dragStart = {
                  clientX: event.clientX,
                  clientY: event.clientY,
                  x: positionParts().x,
                  y: positionParts().y
                };

                if (frame.setPointerCapture) {
                  frame.setPointerCapture(event.pointerId);
                }
              });

              frame.addEventListener('pointermove', function (event) {
                if (!dragging) return;
                moved = true;
                movePosition(dragStart, event.clientX, event.clientY);
              });

              frame.addEventListener('pointerup', function () {
                dragging = false;
                dragStart = null;
              });

              frame.addEventListener('pointercancel', function () {
                dragging = false;
                dragStart = null;
              });

              frame.addEventListener('click', function (event) {
                if (moved) {
                  moved = false;
                  return;
                }

                if (dragStart) return;
                setPosition(event.clientX, event.clientY);
              });
            }
          });
          
          document.querySelectorAll('.company-media-card input[type="file"]').forEach(function (input) {
            input.addEventListener('change', function () {
              if (!input.files || input.files.length === 0) return;
          
              var file = input.files[0];
              var card = input.closest('.company-media-card');
          
              if (!card || !file.type.startsWith('image/')) return;
          
              var frame = card.querySelector('.media-adjust-frame');
              var preview = card.querySelector('img');
              var emptyText = card.querySelector('.muted');
              var url = URL.createObjectURL(file);
          
              if (!preview) {
                preview = document.createElement('img');
                preview.className = card.textContent.includes('Banner') ? 'company-banner-preview' : 'company-logo-preview';
                preview.alt = 'Prévia da imagem';
                if (!frame) {
                  frame = document.createElement('div');
                  frame.className = card.textContent.includes('Banner')
                    ? 'media-adjust-frame banner-adjust-frame'
                    : 'media-adjust-frame logo-adjust-frame';
                  card.insertBefore(frame, card.querySelector('.media-zoom-field'));
                }

                frame.appendChild(preview);
              }
          
              preview.src = url;
          
              if (emptyText) {
                emptyText.style.display = 'none';
              }
            });
          });                    
         `
       }}
      />
   </main>
  );
}
