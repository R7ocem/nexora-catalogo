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

async function excluirFotoDoR2(url) {
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
    console.error('Erro ao excluir foto do R2:', error);
  }
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

  const produtoId = Number(formData.get('produto_id'));
  const empresaId = Number(formData.get('empresa_id'));

  if (!produtoId || !empresaId) {
    redirect('/admin');
  }

  if (user.papel !== 'nexora_admin' && user.empresa_id !== empresaId) {
    redirect('/admin');
  }

  const empresa = await query(
    `SELECT id, slug
     FROM catalogo_empresas
     WHERE id = $1
     LIMIT 1`,
    [empresaId]
  );

  const empresaAtual = empresa.rows[0];

  if (!empresaAtual) {
    redirect('/admin');
  }

  const produto = await query(
    `SELECT imagem_url
     FROM catalogo_produtos
     WHERE id = $1
       AND empresa_id = $2
     LIMIT 1`,
    [produtoId, empresaId]
  );

  const imagemUrl = produto.rows[0]?.imagem_url;

  await query(
    `DELETE FROM catalogo_produtos
     WHERE id = $1
       AND empresa_id = $2`,
    [produtoId, empresaId]
  );

  if (imagemUrl) {
    await excluirFotoDoR2(imagemUrl);
  }

  redirect(`/admin?slug=${empresaAtual.slug}#itens`);
}
