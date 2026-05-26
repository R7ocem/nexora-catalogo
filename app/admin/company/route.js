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

export async function POST(request) {
  const user = await getCurrentUser();

  if (!user || user.papel !== 'nexora_admin') {
    redirect('/admin');
  }

  const formData = await request.formData();

  const empresaId = Number(formData.get('empresa_id'));
  const nome = texto(formData.get('nome'));
  const whatsapp = texto(formData.get('whatsapp')).replace(/\D/g, '');
  const segmento = texto(formData.get('segmento'));
  const tipoOferta = texto(formData.get('tipo_oferta'));
  const tituloPublico = texto(formData.get('titulo_publico'));
  const subtituloPublico = texto(formData.get('subtitulo_publico'));
  const temaCor = texto(formData.get('tema_cor')) || '#0f766e';
  const logoUrl = texto(formData.get('logo_url'));

  if (!empresaId || !nome) {
    redirect('/admin');
  }

  const segmentoFinal = segmentosPermitidos.includes(segmento)
    ? segmento
    : 'outros';

  const tipoOfertaFinal = tiposOfertaPermitidos.includes(tipoOferta)
    ? tipoOferta
    : 'produtos';

  await query(
    `UPDATE food_empresas
     SET
       nome = $2,
       whatsapp = $3,
       segmento = $4,
       tipo_oferta = $5,
       titulo_publico = $6,
       subtitulo_publico = $7,
       tema_cor = $8,
       logo_url = $9
     WHERE id = $1`,
    [
      empresaId,
      nome,
      whatsapp,
      segmentoFinal,
      tipoOfertaFinal,
      tituloPublico || nome,
      subtituloPublico,
      temaCor,
      logoUrl
    ]
  );

  const empresa = await query(
    `SELECT slug FROM food_empresas WHERE id = $1 LIMIT 1`,
    [empresaId]
  );

  const slug = empresa.rows[0]?.slug;

  redirect(slug ? `/admin?slug=${slug}` : '/admin');
}
