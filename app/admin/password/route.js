import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { getCurrentUser, hashPassword, isTrustedAdminRequest, verifyPassword } from '../../../lib/auth';

function texto(valor) {
  return String(valor || '').trim();
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

  const senhaAtual = texto(formData.get('senha_atual'));
  const senhaNova = texto(formData.get('senha_nova'));
  const confirmarSenha = texto(formData.get('confirmar_senha'));

  if (!senhaAtual || !senhaNova || senhaNova.length < 8 || senhaNova !== confirmarSenha) {
    redirect('/admin?painel=senha&erro=senha#senha');
  }

  const usuarios = await query(
    `SELECT id, senha_hash
     FROM catalogo_usuarios
     WHERE id = $1
     LIMIT 1`,
    [user.id]
  );

  const usuarioAtual = usuarios.rows[0];

  if (!usuarioAtual || !verifyPassword(senhaAtual, usuarioAtual.senha_hash)) {
    redirect('/admin?painel=senha&erro=senha_atual#senha');
  }

  const senhaHash = hashPassword(senhaNova);

  await query(
    `UPDATE catalogo_usuarios
     SET senha_hash = $2
     WHERE id = $1`,
    [user.id, senhaHash]
  );

  redirect('/admin?painel=senha&senha=alterada#senha');
}
