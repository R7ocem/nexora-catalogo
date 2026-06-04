import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { query } from '../../../lib/db';
import { getCurrentUser, hashPassword, isTrustedAdminRequest } from '../../../lib/auth';
import { rotuloCatalogo } from '../../../lib/catalog';
import { documentoValido, emailValido, normalizarDocumento, normalizarEmail, normalizarWhatsapp } from '../../../lib/validation';

const segmentosPermitidos = [
  'alimentacao',
  'festas_decoracao',
  'moda',
  'beleza',
  'saude',
  'educacao',
  'servicos_gerais',
  'automotivo',
  'casa_construcao',
  'tecnologia',
  'outros'
];

const tiposOfertaPermitidos = [
  'produtos',
  'servicos',
  'misto'
];

function texto(valor) {
  return String(valor || '').trim();
}

function normalizarSlug(valor) {
  return texto(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function salvarRascunhoEmpresa(dados) {
  cookies().set('nexora_company_draft', JSON.stringify(dados), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/admin',
    maxAge: 600
  });
}

function limparRascunhoEmpresa() {
  cookies().set('nexora_company_draft', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/admin',
    maxAge: 0
  });
}

function redirecionarComErro(erro, dados) {
  salvarRascunhoEmpresa(dados);
  redirect(`/admin?erro=${erro}`);
}

export async function POST(request) {
  if (!isTrustedAdminRequest(request)) {
    redirect('/admin');
  }

  const user = await getCurrentUser();

  if (!user || user.papel !== 'nexora_admin') {
    redirect('/admin');
  }

  const formData = await request.formData();

  const nome = texto(formData.get('nome'));
  const slug = normalizarSlug(formData.get('slug') || nome);
  const whatsapp = normalizarWhatsapp(formData.get('whatsapp'));
  const segmento = texto(formData.get('segmento'));
  const tipoOferta = texto(formData.get('tipo_oferta'));
  const proprietarioNome = texto(formData.get('proprietario_nome'));
  const cpfCnpj = normalizarDocumento(formData.get('documento'));
  const endereco = texto(formData.get('endereco'));
  const cidade = texto(formData.get('cidade'));
  const estado = texto(formData.get('estado')).toUpperCase();

  const usuarioNome = texto(formData.get('usuario_nome')) || proprietarioNome;
  const usuarioEmail = normalizarEmail(formData.get('usuario_email'));
  const usuarioSenha = texto(formData.get('usuario_senha'));
  const rascunho = {
    nome,
    slug,
    proprietario_nome: proprietarioNome,
    documento: cpfCnpj,
    endereco,
    cidade,
    estado,
    whatsapp: texto(formData.get('whatsapp')),
    usuario_email: usuarioEmail,
    usuario_senha: usuarioSenha
  };

  if (!nome || !slug || !proprietarioNome || !cpfCnpj || !endereco || !cidade || !estado || !usuarioNome || !usuarioEmail || !usuarioSenha) {
    redirecionarComErro('empresa', rascunho);
  }

  if (!documentoValido(cpfCnpj)) {
    redirecionarComErro('documento', rascunho);
  }

  if (!emailValido(usuarioEmail)) {
    redirecionarComErro('email_invalido', rascunho);
  }

  if (!whatsapp) {
    redirecionarComErro('whatsapp', rascunho);
  }

  const emailExistente = await query(
    `SELECT id FROM catalogo_usuarios WHERE email = $1 LIMIT 1`,
    [usuarioEmail]
  );

  if (emailExistente.rows.length > 0) {
    redirecionarComErro('email', rascunho);
  }

  const slugExistente = await query(
    `SELECT id FROM catalogo_empresas WHERE slug = $1 LIMIT 1`,
    [slug]
  );

  if (slugExistente.rows.length > 0) {
    redirecionarComErro('slug', rascunho);
  }

  const segmentoFinal = segmentosPermitidos.includes(segmento)
    ? segmento
    : 'outros';

  const tipoOfertaFinal = tiposOfertaPermitidos.includes(tipoOferta)
    ? tipoOferta
    : 'produtos';

  const empresaResult = await query(
    `INSERT INTO catalogo_empresas (
       nome,
       slug,
       whatsapp,
       email_empresa,
       proprietario_nome,
       cpf_cnpj,
       endereco,
       cidade,
       estado,
       segmento,
       tipo_oferta,
       titulo_publico,
       subtitulo_publico,
       tema_cor,
       tema_cor_secundaria,
       usar_gradiente,
       horario_funcionamento,
       opcoes_pedido,
       ativo,
       bloqueado
     )
     VALUES (
       $1,
       $2,
       $3,
       $6,
       $8,
       $9,
       $10,
       $11,
       $12,
       $4,
       $5,
       $1,
       $7,
       '#0f766e',
       '#14b8a6',
       true,
       '{}'::jsonb,
       '{"retirada":true,"entrega":true,"pix":true,"dinheiro":true,"cartao":true}'::jsonb,
       true,
       false
     )
     RETURNING id, slug`,
    [
      nome,
      slug,
      whatsapp,
      segmentoFinal,
      tipoOfertaFinal,
      usuarioEmail,
      rotuloCatalogo(segmentoFinal),
      proprietarioNome,
      cpfCnpj,
      endereco,
      cidade,
      estado
    ]
  );

  const empresa = empresaResult.rows[0];
  const senhaHash = hashPassword(usuarioSenha);

  await query(
    `INSERT INTO catalogo_usuarios (
       empresa_id,
       nome,
       email,
       senha_hash,
       papel,
       ativo
     )
     VALUES ($1, $2, $3, $4, 'empresa_admin', true)
     ON CONFLICT (email) DO NOTHING`,
    [empresa.id, usuarioNome, usuarioEmail, senhaHash]
  );

  limparRascunhoEmpresa();
  redirect(`/admin?slug=${empresa.slug}`);
}
