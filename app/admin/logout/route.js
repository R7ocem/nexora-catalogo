import { redirect } from 'next/navigation';
import { clearAdminSession } from '../../../lib/auth';

export async function POST() {
  clearAdminSession();
  redirect('/admin');
}
