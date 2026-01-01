'use server';

import {
    adminAddUser as addUser,
    adminDeleteUser as deleteUser,
    adminAddRootPath as addRootPath,
    adminDeleteRootPath as deleteRootPath
} from '@/app/actions';

// Re-export for client use
export async function adminAddUser(formData: FormData) {
    if (!formData.get('username')) return;
    await addUser(formData);
}

export async function adminDeleteUser(username: string) {
    await deleteUser(username);
}

export async function adminAddRootPath(formData: FormData) {
    const path = formData.get('path') as string;
    if (!path) return;
    await addRootPath(path);
}

export async function adminDeleteRootPath(path: string) {
    await deleteRootPath(path);
}
