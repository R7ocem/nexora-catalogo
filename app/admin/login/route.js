import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function POST(request) {
  const formData = await request.formData();
  const slug = String(formData.get('slug') || 'savore').trim();
  const password = String(formData.get('password') || '');

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    redirect('/admin');
  }

  cookies().set('nexora_food_admin', slug, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12
  });

  redirect('/admin');
}
