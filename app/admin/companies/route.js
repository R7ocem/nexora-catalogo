import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/auth';

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
  const user = await getCurrentUser();

  if (!user || user.papel !== 'nexora_admin') {
    redirect('/admin');
  }

  const formData = await request.formData();

  const nome = texto(formData.get('nome'));
  const slug = normalizarSlug(formData.get('slug') || nome);
  const whatsappDigitado = texto(formData.get('whatsapp')).replace(/\D/g, '');
  const segmento = texto(formData.get('segmento'));
  const tipoOferta = texto(formData.get('tipo_oferta'));

  if (!nome || !slug) {
    redirect('/admin?erro=empresa');
  }

  let whatsapp = whatsappDigitado;

  if (whatsapp.length > 0 && !whatsapp.startsWith('55')) {
    whatsapp = `55${whatsapp}`;
  }

  const segmentoFinal = segmentosPermitidos.includes(segmento)
    ? segmento
    : 'outros';

  const tipoOfertaFinal = tiposOfertaPermitidos.includes(tipoOferta)
    ? tipoOferta
    : 'produtos';

  await query(
    `INSERT INTO food_empresas (
       nome,
       slug,
       whatsapp,
       segmento,
       tipo_oferta,
       titulo_publico,
       subtitulo_publico,
       tema_cor,
       ativo,
       bloqueado
     )
     VALUES ($1, $2, $3, $4, $5, $1, 'Catálogo digital', '#0f766e', true, false)
     ON CONFLICT (slug) DO UPDATE SET
       nome = EXCLUDED.nome,
       whatsapp = EXCLUDED.whatsapp,
       segmento = EXCLUDED.segmento,
       tipo_oferta = EXCLUDED.tipo_oferta,
       titulo_publico = EXCLUDED.titulo_publico,
       subtitulo_publico = EXCLUDED.subtitulo_publico,
       ativo = true`,
    [
      nome,
      slug,
      whatsapp,
      segmentoFinal,
      tipoOfertaFinal
    ]
  );

  redirect(`/admin?slug=${slug}`);
}
