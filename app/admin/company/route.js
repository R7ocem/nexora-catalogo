import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { getCurrentUser, isTrustedAdminRequest } from '../../../lib/auth';
import { rotuloCatalogo } from '../../../lib/catalog';
import { normalizarWhatsapp } from '../../../lib/validation';

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

const fundosCatalogoPermitidos = [
  'claro',
  'escuro',
  'personalizado'
];

function texto(valor) {
  return String(valor || '').trim();
}

function numero(valor, fallback = 1) {
  const numeroFinal = Number(String(valor || '').replace(',', '.'));

  return Number.isFinite(numeroFinal) ? numeroFinal : fallback;
}

function montarHorarios(formData) {
  const horarios = {};

  for (let dia = 0; dia <= 6; dia += 1) {
    horarios[String(dia)] = {
      ativo: formData.get(`dia_${dia}_ativo`) === 'on',
      abre: texto(formData.get(`dia_${dia}_abre`)) || '08:00',
      fecha: texto(formData.get(`dia_${dia}_fecha`)) || '18:00'
    };
  }

  return horarios;
}

function montarOpcoesPedido(formData) {
  return {
    retirada: formData.get('pedido_retirada') === 'on',
    entrega: formData.get('pedido_entrega') === 'on',
    pix: formData.get('pagamento_pix') === 'on',
    dinheiro: formData.get('pagamento_dinheiro') === 'on',
    cartao: formData.get('pagamento_cartao') === 'on'
  };
}

export async function POST(request) {
  if (!isTrustedAdminRequest(request)) {
    redirect('/admin');
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect('/admin');
  }

  const formData = await request.formData();

  const empresaId = Number(formData.get('empresa_id'));
  const nome = texto(formData.get('nome'));
  const whatsapp = normalizarWhatsapp(formData.get('whatsapp'));
  const segmento = texto(formData.get('segmento'));
  const tipoOferta = texto(formData.get('tipo_oferta'));
  const tituloPublico = texto(formData.get('titulo_publico'));
  const subtituloPublico = texto(formData.get('subtitulo_publico'));
  const instagramUrl = texto(formData.get('instagram_url'));
  const descricaoPublica = texto(formData.get('descricao_publica'));
  const temaCor = texto(formData.get('tema_cor')) || '#0f766e';
  const temaCorSecundaria = texto(formData.get('tema_cor_secundaria')) || '#14b8a6';
  const usarGradiente = formData.get('usar_gradiente') === 'on';
  const catalogoFundoTipo = texto(formData.get('catalogo_fundo_tipo')) || 'claro';
  const catalogoFundoCor = texto(formData.get('catalogo_fundo_cor')) || '#f7f4ef';
  const logoPosicao = '50% 50%';
  const logoZoom = Math.min(2, Math.max(1, numero(formData.get('logo_zoom'), 1)));
  const bannerPosicao = '50% 50%';
  const bannerZoom = Math.min(2, Math.max(1, numero(formData.get('banner_zoom'), 1)));
  const horariosFuncionamento = montarHorarios(formData);
  const opcoesPedido = montarOpcoesPedido(formData);

  if (!empresaId || !nome) {
    redirect('/admin');
  }

  if (!whatsapp) {
    redirect('/admin?erro=whatsapp');
  }

  if (user.papel !== 'nexora_admin' && user.empresa_id !== empresaId) {
    redirect('/admin');
  }

  const segmentoFinal = segmentosPermitidos.includes(segmento)
    ? segmento
    : 'outros';

  const tipoOfertaFinal = tiposOfertaPermitidos.includes(tipoOferta)
    ? tipoOferta
    : 'produtos';

  const catalogoFundoTipoFinal = fundosCatalogoPermitidos.includes(catalogoFundoTipo)
    ? catalogoFundoTipo
    : 'claro';

  await query(
    `UPDATE food_empresas
     SET
       nome = $2,
       whatsapp = $3,
       segmento = $4,
       tipo_oferta = $5,
       titulo_publico = $6,
       subtitulo_publico = $7,
       instagram_url = $8,
       descricao_publica = $9,
       tema_cor = $10,
       tema_cor_secundaria = $11,
       usar_gradiente = $12,
       horario_funcionamento = $13,
       opcoes_pedido = $14,
       catalogo_fundo_tipo = $15,
       catalogo_fundo_cor = $16,
       logo_posicao = $17,
       logo_zoom = $18,
       banner_posicao = $19,
       banner_zoom = $20
      WHERE id = $1`,
    [
      empresaId,
      nome,
      whatsapp,
      segmentoFinal,
      tipoOfertaFinal,
      tituloPublico || nome,
      subtituloPublico || rotuloCatalogo(segmentoFinal),
      instagramUrl,
      descricaoPublica,
      temaCor,
      temaCorSecundaria,
      usarGradiente,
      JSON.stringify(horariosFuncionamento),
      JSON.stringify(opcoesPedido),
      catalogoFundoTipoFinal,
      catalogoFundoCor,
      logoPosicao,
      logoZoom,
      bannerPosicao,
      bannerZoom
    ]
  );

  const empresa = await query(
    `SELECT slug FROM food_empresas WHERE id = $1 LIMIT 1`,
    [empresaId]
  );

  const slug = empresa.rows[0]?.slug;

  redirect(slug ? `/admin?slug=${slug}` : '/admin');
}
