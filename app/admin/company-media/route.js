import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { getCurrentUser, isTrustedAdminRequest } from '../../../lib/auth';

export const runtime = 'nodejs';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

function limparNomeArquivo(nome) {
  return String(nome || 'arquivo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function keyDoR2PelaUrl(url) {
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!url || !publicUrl || !url.startsWith(publicUrl)) {
    return null;
  }

  return url.slice(publicUrl.length + 1);
}

async function excluirDoR2(url) {
  const key = keyDoR2PelaUrl(url);

  if (!key) return;

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key
      })
    );
  } catch (error) {
    console.error('Erro ao excluir imagem do R2:', error);
  }
}

async function enviarImagemParaR2(file, empresaId, tipo) {
  if (!file || typeof file === 'string' || file.size === 0) return null;

  if (!file.type.startsWith('image/')) {
    throw new Error('invalid_file_type');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('file_too_large');
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const nomeLimpo = limparNomeArquivo(file.name);
  const key = `empresas/${empresaId}/${tipo}/${Date.now()}-${nomeLimpo}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: file.type
    })
  );

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

function texto(valor) {
  return String(valor || '').trim();
}

function numero(valor, fallback = 1) {
  const numeroFinal = Number(String(valor || '').replace(',', '.'));

  return Number.isFinite(numeroFinal) ? numeroFinal : fallback;
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
  const tipo = String(formData.get('tipo') || '');
  const acao = String(formData.get('acao') || 'enviar');

  if (!empresaId || !['logo', 'banner', 'aviso'].includes(tipo)) {
    redirect('/admin');
  }

  if (user.papel !== 'nexora_admin' && user.empresa_id !== empresaId) {
    redirect('/admin');
  }

  const empresaResult = await query(
    `SELECT id, slug, logo_url, banner_url, aviso_imagem_url
     FROM catalogo_empresas
     WHERE id = $1
     LIMIT 1`,
    [empresaId]
  );

  const empresa = empresaResult.rows[0];

  if (!empresa) {
    redirect('/admin');
  }

  const campo = tipo === 'aviso'
    ? 'aviso_imagem_url'
    : tipo === 'banner'
      ? 'banner_url'
      : 'logo_url';
  const destino = tipo === 'aviso'
    ? `/admin?slug=${empresa.slug}&painel=promocional#promocional`
    : `/admin?slug=${empresa.slug}&painel=empresa#empresa`;
  const campoPosicao = tipo === 'aviso'
    ? null
    : tipo === 'banner'
      ? 'banner_posicao'
      : 'logo_posicao';
  const campoZoom = tipo === 'aviso'
    ? null
    : tipo === 'banner'
      ? 'banner_zoom'
      : 'logo_zoom';
  const posicao = '50% 50%';
  const zoom = campoZoom ? Math.min(2, Math.max(1, numero(formData.get(campoZoom), 1))) : 1;
  const imagemAnterior = empresa[campo];

  if (acao === 'excluir') {
    await query(
      `UPDATE catalogo_empresas
       SET ${campo} = ''
       WHERE id = $1`,
      [empresaId]
    );

    if (imagemAnterior) {
      await excluirDoR2(imagemAnterior);
    }

    redirect(destino);
  }

  const foto = formData.get('foto');
  const novaUrl = await enviarImagemParaR2(foto, empresaId, tipo);

  if (novaUrl && tipo === 'aviso') {
    await query(
      `UPDATE catalogo_empresas
       SET ${campo} = $2
       WHERE id = $1`,
      [empresaId, novaUrl]
    );

    if (imagemAnterior) {
      await excluirDoR2(imagemAnterior);
    }
  } else if (novaUrl) {
    await query(
      `UPDATE catalogo_empresas
       SET ${campo} = $2,
           ${campoPosicao} = $3,
           ${campoZoom} = $4
       WHERE id = $1`,
      [empresaId, novaUrl, posicao, zoom]
    );

    if (imagemAnterior) {
      await excluirDoR2(imagemAnterior);
    }
  } else if (campoPosicao && campoZoom) {
    await query(
      `UPDATE catalogo_empresas
       SET ${campoPosicao} = $2,
           ${campoZoom} = $3
       WHERE id = $1`,
      [empresaId, posicao, zoom]
    );
  }

  redirect(destino);
}
