'use server'

import fs from 'fs/promises';
import path from 'path';
import { auth } from '@/auth';
import { getSettings, getUsers, addUser, deleteUser, updateSettings, User, Settings, getHistory, addHistory, updateUserSyncSettings, getUser } from '@/lib/db';

// --- AUTH HELPERS ---

async function getSession() {
    const session = await auth();
    if (!session?.user?.name) {
        throw new Error('Unauthorized');
    }
    return session;
}

async function getRootPaths() {
    const session = await getSession();
    const settings = await getSettings();
    // @ts-ignore
    const isAdmin = session.user.role === 'admin';
    const username = session.user.name!;

    if (isAdmin) return settings.roots || [];

    // For regular users, ONLY show if they are explicitly in the allowedUsers list
    return (settings.roots || []).filter(root =>
        root.allowedUsers.includes(username)
    );
}

// Helper to get all roots for administrative work
async function getAllRootPaths() {
    const settings = await getSettings();
    return settings.roots || [];
}

// Ensure user directory exists for a SPECIFIC root
async function ensureUserDirForRoot(rootPath: string, username: string, isAdmin: boolean) {
    if (isAdmin) {
        try {
            await fs.access(rootPath);
        } catch {
            await fs.mkdir(rootPath, { recursive: true });
        }
        return rootPath;
    } else {
        const userPath = path.join(rootPath, username);
        try {
            await fs.access(userPath);
        } catch {
            await fs.mkdir(userPath, { recursive: true });
        }
        return userPath;
    }
}

// --- FILE ACTIONS ---

export interface FileItem {
    name: string;
    isDirectory: boolean;
    size: number;
    lastModified: string;
    path: string;
}

export async function getFiles(relativePath: string = ''): Promise<FileItem[]> {
    try {
        const session = await getSession();
        // @ts-ignore
        const isAdmin = session.user.role === 'admin';
        const visibleRoots = await getRootPaths();
        const allRoots = await getAllRootPaths();

        if (relativePath === '') {
            return visibleRoots.map((root) => {
                const originalIndex = allRoots.findIndex(r => r.path === root.path);
                return {
                    name: path.basename(root.path) || `Source`,
                    isDirectory: true,
                    size: 0,
                    lastModified: new Date().toISOString(),
                    path: `${originalIndex}`
                };
            });
        }

        const segments = relativePath.split('/').filter(Boolean);
        const rootIndex = parseInt(segments[0]);
        if (isNaN(rootIndex) || !allRoots[rootIndex]) {
            console.error(`Invalid root index: ${segments[0]}`);
            return [];
        }

        // Security check: is user allowed to access this root?
        const targetRoot = allRoots[rootIndex];
        if (!isAdmin && !targetRoot.allowedUsers.includes(session.user.name!) && targetRoot.allowedUsers.length > 0) {
            console.error(`Unauthorized access attempt to root ${rootIndex}`);
            return [];
        }

        const innerPath = segments.slice(1).join('/');
        const rootPath = targetRoot.path;
        const baseDir = await ensureUserDirForRoot(rootPath, session.user.name!, isAdmin);

        const safePath = path.normalize(innerPath).replace(/^(\.\.[\/\\])+/, '');
        const absolutePath = path.join(baseDir, safePath);

        if (!absolutePath.startsWith(baseDir)) {
            console.error(`Access denied: ${absolutePath}`);
            return [];
        }

        const entries = await fs.readdir(absolutePath, { withFileTypes: true });

        const files = await Promise.all(entries.map(async (entry) => {
            const fullPath = path.join(absolutePath, entry.name);
            let stats;
            try {
                stats = await fs.stat(fullPath);
            } catch (e) {
                return null;
            }

            return {
                name: entry.name,
                isDirectory: entry.isDirectory(),
                size: stats.size,
                lastModified: stats.mtime.toISOString(),
                path: path.join(`${rootIndex}`, safePath, entry.name).replace(/\\/g, '/'),
            };
        }));

        const items = files.filter((f): f is FileItem => f !== null).sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
                return a.name.localeCompare(b.name);
            }
            return a.isDirectory ? -1 : 1;
        });

        return items;

    } catch (error) {
        console.error('Error reading directory:', error);
        return [];
    }
}

export async function createFolder(parentPath: string, folderName: string) {
    const session = await getSession();
    // @ts-ignore
    const isAdmin = session.user.role === 'admin';
    const allRoots = await getAllRootPaths();

    const segments = parentPath.split('/').filter(Boolean);
    const rootIndex = parseInt(segments[0]);
    if (isNaN(rootIndex) || !allRoots[rootIndex]) throw new Error('Invalid root');

    const targetRoot = allRoots[rootIndex];
    if (!isAdmin && !targetRoot.allowedUsers.includes(session.user.name!) && targetRoot.allowedUsers.length > 0) {
        throw new Error('Forbidden');
    }

    const innerPath = segments.slice(1).join('/');
    const rootPath = targetRoot.path;
    const baseDir = await ensureUserDirForRoot(rootPath, session.user.name!, isAdmin);

    const safePath = path.normalize(innerPath).replace(/^(\.\.[\/\\])+/, '');
    const safeFolderName = folderName.replace(/[^a-zA-Z0-9_\-\. ]/g, '');
    const absolutePath = path.join(baseDir, safePath, safeFolderName);

    if (!absolutePath.startsWith(baseDir)) {
        throw new Error('Access denied');
    }

    await fs.mkdir(absolutePath, { recursive: true });
    await addHistory(session.user.name!, 'upload', `Created folder ${folderName}`);
    return { success: true };
}

export async function deleteFile(filePath: string) {
    const session = await getSession();
    // @ts-ignore
    const isAdmin = session.user.role === 'admin';
    const allRoots = await getAllRootPaths();
    const segments = filePath.split('/').filter(Boolean);
    const rootIndex = parseInt(segments[0]);
    if (isNaN(rootIndex) || !allRoots[rootIndex]) throw new Error('Invalid root');

    const innerPath = segments.slice(1).join('/');
    const targetRoot = allRoots[rootIndex];
    if (!isAdmin && !targetRoot.allowedUsers.includes(session.user.name!) && targetRoot.allowedUsers.length > 0) throw new Error('Forbidden');

    const baseDir = await ensureUserDirForRoot(targetRoot.path, session.user.name!, isAdmin);

    const safePath = path.normalize(innerPath).replace(/^(\.\.[\/\\])+/, '');
    const absolutePath = path.join(baseDir, safePath);

    if (!absolutePath.startsWith(baseDir)) {
        throw new Error('Access denied');
    }

    await fs.rm(absolutePath, { recursive: true, force: true });
    await addHistory(session.user.name!, 'delete', `Deleted ${innerPath}`);
    return { success: true };
}

export async function renameFile(oldPath: string, newName: string) {
    const session = await getSession();
    // @ts-ignore
    const isAdmin = session.user.role === 'admin';
    const allRoots = await getAllRootPaths();
    const segments = oldPath.split('/').filter(Boolean);
    const rootIndex = parseInt(segments[0]);
    if (isNaN(rootIndex) || !allRoots[rootIndex]) throw new Error('Invalid root');

    const innerPath = segments.slice(1).join('/');
    const targetRoot = allRoots[rootIndex];
    if (!isAdmin && !targetRoot.allowedUsers.includes(session.user.name!) && targetRoot.allowedUsers.length > 0) throw new Error('Forbidden');

    const baseDir = await ensureUserDirForRoot(targetRoot.path, session.user.name!, isAdmin);

    const safeOldPath = path.normalize(innerPath).replace(/^(\.\.[\/\\])+/, '');
    const absoluteOldPath = path.join(baseDir, safeOldPath);

    const parentDir = path.dirname(absoluteOldPath);
    const absoluteNewPath = path.join(parentDir, newName.replace(/[^a-zA-Z0-9_\-\. ]/g, ''));

    if (!absoluteOldPath.startsWith(baseDir) || !absoluteNewPath.startsWith(baseDir)) {
        throw new Error('Access denied');
    }

    await fs.rename(absoluteOldPath, absoluteNewPath);
    await addHistory(session.user.name!, 'rename', `Renamed ${oldPath.split('/').pop()} to ${newName}`);
    return { success: true };
}

export async function pasteFile(sourcePath: string, targetParentPath: string, operation: 'copy' | 'move') {
    const session = await getSession();
    // @ts-ignore
    const isAdmin = session.user.role === 'admin';
    const allRoots = await getAllRootPaths();

    // Resolve Source
    const sourceSegments = sourcePath.split('/').filter(Boolean);
    const sourceRootIndex = parseInt(sourceSegments[0]);
    const sourceRoot = allRoots[sourceRootIndex];
    if (!isAdmin && !sourceRoot.allowedUsers.includes(session.user.name!) && sourceRoot.allowedUsers.length > 0) throw new Error('Forbidden');

    const sourceBaseDir = await ensureUserDirForRoot(sourceRoot.path, session.user.name!, isAdmin);
    const sourceInnerPath = sourceSegments.slice(1).join('/');
    const absoluteSourcePath = path.join(sourceBaseDir, path.normalize(sourceInnerPath).replace(/^(\.\.[\/\\])+/, ''));

    // Resolve Target
    const targetSegments = targetParentPath.split('/').filter(Boolean);
    const targetRootIndex = parseInt(targetSegments[0]);
    const targetRoot = allRoots[targetRootIndex];
    if (!isAdmin && !targetRoot.allowedUsers.includes(session.user.name!) && targetRoot.allowedUsers.length > 0) throw new Error('Forbidden');

    const targetBaseDir = await ensureUserDirForRoot(targetRoot.path, session.user.name!, isAdmin);
    const targetInnerPath = targetSegments.slice(1).join('/');
    const absoluteTargetDir = path.join(targetBaseDir, path.normalize(targetInnerPath).replace(/^(\.\.[\/\\])+/, ''));

    const fileName = path.basename(absoluteSourcePath);
    const absoluteTargetPath = path.join(absoluteTargetDir, fileName);

    // Security Checks
    if (!absoluteSourcePath.startsWith(sourceBaseDir) || !absoluteTargetDir.startsWith(targetBaseDir)) {
        throw new Error('Access denied');
    }

    if (operation === 'move') {
        await fs.rename(absoluteSourcePath, absoluteTargetPath);
    } else {
        // Deep copy
        const copyDeep = async (src: string, dest: string) => {
            const stats = await fs.stat(src);
            if (stats.isDirectory()) {
                await fs.mkdir(dest, { recursive: true });
                const files = await fs.readdir(src);
                for (const file of files) {
                    await copyDeep(path.join(src, file), path.join(dest, file));
                }
            } else {
                await fs.copyFile(src, dest);
            }
        };
        await copyDeep(absoluteSourcePath, absoluteTargetPath);
    }

    await addHistory(session.user.name!, operation === 'move' ? 'move' : 'copy', `${operation === 'move' ? 'Moved' : 'Copied'} ${fileName} to ${targetParentPath}`);
    return { success: true };
}

// --- ADMIN ACTIONS ---

export async function adminGetUsers() {
    const session = await getSession();
    // @ts-ignore
    if (session.user.role !== 'admin') throw new Error('Forbidden');
    return getUsers();
}

export async function adminAddUser(formData: FormData) {
    const session = await getSession();
    // @ts-ignore
    if (session.user.role !== 'admin') throw new Error('Forbidden');

    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) throw new Error('Missing fields');

    await addUser(username, password);
}

export async function adminDeleteUser(username: string) {
    const session = await getSession();
    // @ts-ignore
    if (session.user.role !== 'admin') throw new Error('Forbidden');
    await deleteUser(username);
}

export async function adminGetSettings() {
    const session = await getSession();
    // @ts-ignore
    if (session.user.role !== 'admin') throw new Error('Forbidden');
    return getSettings();
}

export async function adminAddRootPath(path: string, allowedUsers: string[], isDefault: boolean) {
    const session = await getSession();
    // @ts-ignore
    if (session.user.role !== 'admin') throw new Error('Forbidden');

    const settings = await getSettings();
    const roots = settings.roots || [];
    if (!roots.find(r => r.path === path)) {
        roots.push({ path, allowedUsers, isDefault });
        await updateSettings({ roots });
    }
}

export async function adminDeleteRootPath(pathToDelete: string) {
    const session = await getSession();
    // @ts-ignore
    if (session.user.role !== 'admin') throw new Error('Forbidden');

    const settings = await getSettings();
    const roots = (settings.roots || []).filter(p => p.path !== pathToDelete);
    await updateSettings({ roots });
}

export async function adminGetHistory() {
    const session = await getSession();
    // @ts-ignore
    if (session.user.role !== 'admin') throw new Error('Forbidden');
    return getHistory();
}

export async function userGetHistory() {
    const session = await getSession();
    const history = await getHistory();
    return history.filter(h => h.username === session.user.name);
}

export async function toggleSync(settings: { enabled: boolean; allowCellular: boolean; galleryLinked: boolean }) {
    const session = await getSession();
    await updateUserSyncSettings(session.user.name!, settings);
    return { success: true };
}

export async function getSyncStatus() {
    const session = await getSession();
    const user = await getUser(session.user.name!);
    return user?.syncSettings || { enabled: false };
}
