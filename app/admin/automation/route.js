import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { getCurrentUser, isTrustedAdminRequest } from '../../../lib/auth';
import { normalizarWhatsapp } from '../../../lib/validation';

function texto(valor) {
  return String(valor || '').trim();
}

function normalizarInstancia(valor) {
  return texto(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '');
}

function menu(formData) {
  const itens = [{
    number: 1,
    label: 'Fazer pedido',
    action: 'pedido',
    enabled: true
  }];

  for (const numero of [2, 3, 4]) {
    const label = texto(formData.get(`menu_${numero}_label`));
    const action = texto(formData.get(`menu_${numero}_action`));

    if (label && ['catalogo', 'humano', 'orcamento'].includes(action)) {
      itens.push({ number: numero, label, action, enabled: true });
    }
  }

  return { items: itens };
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

  if (!empresaId || (user.papel !== 'nexora_admin' && user.empresa_id !== empresaId)) {
    redirect('/admin');
  }

  const atualResult = await query(
    `SELECT id, slug, n8n_instance
     FROM catalogo_empresas
     WHERE id = $1
     LIMIT 1`,
    [empresaId]
  );

  const empresa = atualResult.rows[0];

  if (!empresa) {
    redirect('/admin');
  }

  const instanciaInformada = normalizarInstancia(formData.get('n8n_instance'));
  const instancia = user.papel === 'nexora_admin'
    ? (instanciaInformada || empresa.slug)
    : (empresa.n8n_instance || empresa.slug);

  const numeroLojaOriginal = texto(formData.get('n8n_kitchen_whatsapp'));
  const numeroLoja = numeroLojaOriginal
    ? normalizarWhatsapp(numeroLojaOriginal)
    : '';

  if (numeroLojaOriginal && !numeroLoja) {
    redirect(`/admin?slug=${empresa.slug}&painel=automacao&erro=whatsapp#automacao`);
  }

  const conflito = await query(
    `SELECT id
     FROM catalogo_empresas
     WHERE n8n_instance = $1
       AND id <> $2
     LIMIT 1`,
    [instancia, empresaId]
  );

  if (conflito.rows.length > 0) {
    redirect(`/admin?slug=${empresa.slug}&painel=automacao&erro=instancia#automacao`);
  }

  await query(
    `UPDATE catalogo_empresas
     SET
       n8n_instance = $2,
       n8n_greeting = $3,
       n8n_menu = $4,
       n8n_kitchen_whatsapp = $5,
       n8n_pix_key = $6,
       n8n_pix_holder = $7,
       atualizado_em = NOW()
     WHERE id = $1`,
    [
      empresaId,
      instancia,
      texto(formData.get('n8n_greeting')) || null,
      JSON.stringify(menu(formData)),
      numeroLoja || null,
      texto(formData.get('n8n_pix_key')) || null,
      texto(formData.get('n8n_pix_holder')) || null
    ]
  );

  redirect(`/admin?slug=${empresa.slug}&painel=automacao&automacao=salva#automacao`);
}
