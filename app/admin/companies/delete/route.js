import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { redirect } from 'next/navigation';
import { query } from '../../../../lib/db';
import { getCurrentUser, isTrustedAdminRequest } from '../../../../lib/auth';

export const runtime = 'nodejs';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

function keyDoR2PelaUrl(url) {
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!url || !publicUrl || !url.startsWith(publicUrl)) {
    return null;
  }

  return url.slice(publicUrl.length + 1);
}

async function excluirArquivoDoR2(url) {
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
    console.error('Erro ao excluir arquivo da empresa:', error);
  }
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
  const empresaId = Number(formData.get('empresa_id'));
  const confirmar = String(formData.get('confirmar') || '').trim().toUpperCase();

  if (!empresaId || confirmar !== 'EXCLUIR') {
    redirect('/admin?erro=excluir_empresa');
  }

  const empresa = await query(
    `SELECT id, logo_url, banner_url, bloqueado
     FROM catalogo_empresas
     WHERE id = $1
     LIMIT 1`,
    [empresaId]
  );

  const empresaAtual = empresa.rows[0];

  if (!empresaAtual || empresaAtual.bloqueado !== true) {
    redirect('/admin?erro=excluir_empresa');
  }

  const produtos = await query(
    `SELECT imagem_url
     FROM catalogo_produtos
     WHERE empresa_id = $1
       AND imagem_url IS NOT NULL
       AND imagem_url <> ''`,
    [empresaId]
  );

  const urls = [
    empresaAtual.logo_url,
    empresaAtual.banner_url,
    ...produtos.rows.map((produto) => produto.imagem_url)
  ].filter(Boolean);

  await query(
    `DELETE FROM catalogo_empresas
     WHERE id = $1
       AND bloqueado = true`,
    [empresaId]
  );

  await Promise.all(urls.map((url) => excluirArquivoDoR2(url)));

  redirect('/admin?empresa=excluida');
}
