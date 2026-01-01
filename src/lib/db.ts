import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

export interface User {
    username: string;
    passwordHash: string;
    role: 'admin' | 'user';
    createdAt: string;
    syncSettings?: {
        enabled: boolean;
        allowCellular: boolean;
        galleryLinked: boolean;
        lastSync?: string;
    };
}

export interface HistoryEntry {
    id: string;
    username: string;
    action: 'upload' | 'delete' | 'rename' | 'move' | 'copy';
    details: string;
    timestamp: string;
}

export interface MediaRoot {
    path: string;
    allowedUsers: string[]; // usernames
    isDefault: boolean;
}

export interface Settings {
    roots: MediaRoot[];
}

const DEFAULT_SETTINGS: Settings = {
    roots: [{
        path: path.join(process.cwd(), 'media'),
        allowedUsers: ['admin'],
        isDefault: true
    }],
};

const DEFAULT_ADMIN: User = {
    username: 'admin',
    passwordHash: '',
    role: 'admin',
    createdAt: new Date().toISOString(),
};

export async function initDB() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }

    // Settings
    try {
        await fs.access(SETTINGS_FILE);
    } catch {
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    }

    // Users
    try {
        await fs.access(USERS_FILE);
    } catch {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('admin', salt);
        const initialUsers = [{ ...DEFAULT_ADMIN, passwordHash: hash }];
        await fs.writeFile(USERS_FILE, JSON.stringify(initialUsers, null, 2));
    }

    // History
    try {
        await fs.access(HISTORY_FILE);
    } catch {
        await fs.writeFile(HISTORY_FILE, JSON.stringify([], null, 2));
    }
}

export async function getSettings(): Promise<Settings> {
    await initDB();
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function updateSettings(settings: Partial<Settings>) {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    return updated;
}

export async function getUsers(): Promise<User[]> {
    await initDB();
    const data = await fs.readFile(USERS_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function getUser(username: string): Promise<User | undefined> {
    const users = await getUsers();
    return users.find(u => u.username === username);
}

export async function verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
}

export async function addUser(username: string, password: string, role: 'admin' | 'user' = 'user') {
    const users = await getUsers();
    if (users.find(u => u.username === username)) {
        throw new Error('User already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const settings = await getSettings();
    const defaultRoots = settings.roots.filter(r => r.isDefault);

    const newUser: User = {
        username,
        passwordHash,
        role,
        createdAt: new Date().toISOString(),
        syncSettings: { enabled: false, allowCellular: false, galleryLinked: false }
    };

    // Update roots for new user
    if (defaultRoots.length > 0) {
        settings.roots = settings.roots.map(root => {
            if (root.isDefault && !root.allowedUsers.includes(username)) {
                return { ...root, allowedUsers: [...root.allowedUsers, username] };
            }
            return root;
        });
        await updateSettings(settings);
    }

    users.push(newUser);
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    return newUser;
}

export async function deleteUser(username: string) {
    let users = await getUsers();
    if (username === 'admin') throw new Error('Cannot delete default admin');
    users = users.filter(u => u.username !== username);
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

export async function getHistory(): Promise<HistoryEntry[]> {
    await initDB();
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function addHistory(username: string, action: HistoryEntry['action'], details: string) {
    const history = await getHistory();
    const entry: HistoryEntry = {
        id: Math.random().toString(36).substring(2, 9),
        username,
        action,
        details,
        timestamp: new Date().toISOString(),
    };
    history.unshift(entry); // Newest first
    // Keep only last 1000 entries
    const limitedHistory = history.slice(0, 1000);
    await fs.writeFile(HISTORY_FILE, JSON.stringify(limitedHistory, null, 2));
    return entry;
}

export async function updateUserSyncSettings(username: string, settings: { enabled: boolean; allowCellular: boolean; galleryLinked: boolean }) {
    let users = await getUsers();
    const index = users.findIndex(u => u.username === username);
    if (index !== -1) {
        users[index].syncSettings = {
            ...settings,
            lastSync: settings.enabled ? users[index].syncSettings?.lastSync : undefined
        };
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    }
}
