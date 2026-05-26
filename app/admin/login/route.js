import { redirect } from 'next/navigation';
import { query } from '../../../lib/db';
import { setAdminSession, verifyPassword } from '../../../lib/auth';

export async function POST(request) {
  const formData = await request.formData();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');

  const result = await query(
    `SELECT id, empresa_id, nome, email, senha_hash, papel
     FROM food_usuarios
     WHERE email = $1 AND ativo = true
     LIMIT 1`,
    [email]
  );

  const user = result.rows[0];

  if (!user || !verifyPassword(password, user.senha_hash)) {
    redirect('/admin?erro=login');
  }

  setAdminSession(user);

  redirect('/admin');
}
