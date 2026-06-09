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

const tiposItemPermitidos = [
  'produto',
  'servico',
  'pacote'
];

const tiposPrecoPermitidos = [
  'fixo',
  'a_partir_de',
  'sob_consulta'
];

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

async function enviarFotoParaR2(file, empresaId) {
  if (!file || typeof file === 'string' || file.size === 0) return null;

  if (!file.type.startsWith('image/')) {
    throw new Error('invalid_file_type');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('file_too_large');
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const nomeLimpo = limparNomeArquivo(file.name);
  const key = `empresas/${empresaId}/${Date.now()}-${nomeLimpo}`;

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

function numero(valor) {
  const normalizado = String(valor || '')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');

  const numeroFinal = Number(normalizado);

  return Number.isFinite(numeroFinal) ? numeroFinal : 0;
}

function variacoesDoTexto(valor) {
  return texto(valor)
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const [nomeRaw, ...valoresRaw] = linha.split(':');
      const nome = texto(nomeRaw);
      const valores = valoresRaw
        .join(':')
        .split(',')
        .map((opcao) => texto(opcao))
        .filter(Boolean);

      return nome && valores.length > 0 ? { nome, valores } : null;
    })
    .filter(Boolean);
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

  const codigo = texto(formData.get('codigo'))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_ -]/g, '')
    .replace(/\s+/g, '_');

  const nome = texto(formData.get('nome'));

  if (!empresaId || !codigo || !nome) {
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

  const categoriaIdRaw = texto(formData.get('categoria_id'));
  let categoriaId = categoriaIdRaw ? Number(categoriaIdRaw) : null;

  if (categoriaId) {
    const categoria = await query(
      `SELECT id
       FROM catalogo_categorias
       WHERE id = $1
         AND empresa_id = $2
       LIMIT 1`,
      [categoriaId, empresaId]
    );

    if (!categoria.rows[0]) {
      categoriaId = null;
    }
  }

  const tipoItemRaw = texto(formData.get('tipo_item'));
  const tipoPrecoRaw = texto(formData.get('tipo_preco'));
  const tipoItem = tiposItemPermitidos.includes(tipoItemRaw) ? tipoItemRaw : 'produto';
  const tipoPreco = tiposPrecoPermitidos.includes(tipoPrecoRaw) ? tipoPrecoRaw : 'fixo';
  const preco = tipoPreco === 'sob_consulta' ? 0 : numero(formData.get('preco'));

  if (tipoPreco !== 'sob_consulta' && preco <= 0) {
    redirect(`/admin?slug=${empresaAtual.slug}&erro=preco`);
  }

  const descricao = texto(formData.get('descricao'));
  const variacoes = variacoesDoTexto(formData.get('variacoes_texto'));
  const apelidos = texto(formData.get('apelidos'));
  const ativo = formData.get('ativo') === 'on';
  const destaque = formData.get('destaque') === 'on';
  const destaqueOrdem = Math.min(6, Math.max(0, Math.round(numero(formData.get('destaque_ordem')))));

  if (!apelidos) {
    redirect(`/admin?slug=${empresaAtual.slug}&erro=apelidos`);
  }

  let imagemUrl = texto(formData.get('imagem_url'));
  const imagemAnterior = imagemUrl;
  const removerImagem = formData.get('remover_imagem') === '1';
  const foto = formData.get('foto');

  if (removerImagem) {
    imagemUrl = '';

    if (imagemAnterior) {
      await excluirFotoDoR2(imagemAnterior);
    }
  } else {
    const fotoUrl = await enviarFotoParaR2(foto, empresaId);

    if (fotoUrl) {
      imagemUrl = fotoUrl;

      if (imagemAnterior) {
        await excluirFotoDoR2(imagemAnterior);
      }
    }
  }

  if (produtoId) {
    await query(
      `UPDATE catalogo_produtos
       SET
         codigo = $3,
         nome = $4,
         categoria_id = $5,
         preco = $6,
         tipo_item = $7,
         tipo_preco = $8,
         imagem_url = $9,
         descricao = $10,
         apelidos = $11,
         ativo = $12,
         destaque = $13,
         destaque_ordem = $14,
         variacoes = $15::jsonb
       WHERE id = $1
         AND empresa_id = $2`,
      [
        produtoId,
        empresaId,
        codigo,
        nome,
        categoriaId,
        preco,
        tipoItem,
        tipoPreco,
        imagemUrl,
        descricao,
        apelidos,
        ativo,
        destaque,
        destaqueOrdem,
        JSON.stringify(variacoes)
      ]
    );
  } else {
    await query(
      `INSERT INTO catalogo_produtos (
         empresa_id,
         categoria_id,
         codigo,
         nome,
         descricao,
         preco,
         tipo_item,
         tipo_preco,
         imagem_url,
         apelidos,
         ativo,
         destaque,
         destaque_ordem,
         variacoes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)`,
      [
        empresaId,
        categoriaId,
        codigo,
        nome,
        descricao,
        preco,
        tipoItem,
        tipoPreco,
        imagemUrl,
        apelidos,
        ativo,
        destaque,
        destaqueOrdem,
        JSON.stringify(variacoes)
      ]
    );
  }

  redirect(`/admin?slug=${empresaAtual.slug}#itens`);
}
