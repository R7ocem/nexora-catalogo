import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { getCurrentUser, hashPassword, isTrustedAdminRequest } from '../../../lib/auth';
import { rotuloCatalogo } from '../../../lib/catalog';
import { emailValido, normalizarEmail, normalizarWhatsapp } from '../../../lib/validation';

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

  const usuarioNome = texto(formData.get('usuario_nome'));
  const usuarioEmail = normalizarEmail(formData.get('usuario_email'));
  const usuarioSenha = texto(formData.get('usuario_senha'));

  if (!nome || !slug || !usuarioNome || !usuarioEmail || !usuarioSenha) {
    redirect('/admin?erro=empresa');
  }

  if (!emailValido(usuarioEmail)) {
    redirect('/admin?erro=email_invalido');
  }

  if (!whatsapp) {
    redirect('/admin?erro=whatsapp');
  }

  const emailExistente = await query(
    `SELECT id FROM food_usuarios WHERE email = $1 LIMIT 1`,
    [usuarioEmail]
  );

  if (emailExistente.rows.length > 0) {
    redirect('/admin?erro=email');
  }

  const slugExistente = await query(
    `SELECT id FROM food_empresas WHERE slug = $1 LIMIT 1`,
    [slug]
  );

  if (slugExistente.rows.length > 0) {
    redirect('/admin?erro=slug');
  }

  const segmentoFinal = segmentosPermitidos.includes(segmento)
    ? segmento
    : 'outros';

  const tipoOfertaFinal = tiposOfertaPermitidos.includes(tipoOferta)
    ? tipoOferta
    : 'produtos';

  const empresaResult = await query(
    `INSERT INTO food_empresas (
       nome,
       slug,
       whatsapp,
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
       $4,
       $5,
       $1,
       $6,
       '#0f766e',
       '#14b8a6',
       true,
       '{}'::jsonb,
       '{"retirada":true,"entrega":true,"pix":true,"dinheiro":true,"cartao":true}'::jsonb,
       true,
       false
     )
     RETURNING id, slug`,
    [nome, slug, whatsapp, segmentoFinal, tipoOfertaFinal, rotuloCatalogo(segmentoFinal)]
  );

  const empresa = empresaResult.rows[0];
  const senhaHash = hashPassword(usuarioSenha);

  await query(
    `INSERT INTO food_usuarios (
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

  redirect(`/admin?slug=${empresa.slug}`);
}
