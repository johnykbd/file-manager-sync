import { auth } from '@/auth';
import { adminGetUsers, adminGetSettings } from '@/app/actions';
import { AdminPanel } from '@/components/admin-panel';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
    const session = await auth();
    // @ts-ignore
    if (session?.user?.role !== 'admin') {
        redirect('/');
    }

    const users = await adminGetUsers();
    const settings = await adminGetSettings();

    return (
        <main className="min-h-screen bg-black text-white">
            <AdminPanel users={users} settings={settings} />
        </main>
    );
}
