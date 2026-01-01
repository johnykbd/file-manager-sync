'use client';

import React from 'react';
import { adminAddUser, adminDeleteUser, adminAddRootPath, adminDeleteRootPath, adminGetHistory } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Settings, HistoryEntry } from '@/lib/db';
import { Trash2, Plus, ArrowLeft, Clock, User as UserIcon, Upload, Edit2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AdminPanelProps {
    users: User[];
    settings: Settings;
}

export function AdminPanel({ users, settings }: AdminPanelProps) {
    const router = useRouter();
    const [history, setHistory] = React.useState<HistoryEntry[]>([]);

    React.useEffect(() => {
        adminGetHistory().then(setHistory);
    }, []);

    const handleDeleteUser = async (username: string) => {
        if (!confirm(`Are you sure you want to delete user ${username}?`)) return;
        try {
            await adminDeleteUser(username);
            router.refresh();
        } catch (err) {
            alert('Failed to delete user');
        }
    };

    const handleDeletePath = async (path: string) => {
        if (!confirm(`Are you sure you want to remove root path: ${path}?`)) return;
        try {
            await adminDeleteRootPath(path);
            router.refresh();
        } catch (err) {
            alert('Failed to remove path');
        }
    };

    const [selectedUsers, setSelectedUsers] = React.useState<string[]>([]);
    const [isDefault, setIsDefault] = React.useState(false);

    return (
        <div className="p-4 space-y-6 text-white max-w-4xl mx-auto pb-20">
            <div className="flex items-center gap-4">
                <Link href="/">
                    <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                </Link>
                <h1 className="text-3xl font-bold">KBD Stream Dashboard</h1>
            </div>

            <Tabs defaultValue="settings" className="w-full">
                <TabsList className="bg-zinc-900 border-zinc-800">
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="history">Activity History</TabsTrigger>
                </TabsList>

                <TabsContent value="settings" className="space-y-6 mt-6">
                    {/* Root Paths Section */}
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">Media Roots</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="p-4 border border-zinc-800 rounded-lg bg-zinc-950/50 space-y-4">
                                <h3 className="text-sm font-medium text-zinc-300">Add Media Root</h3>
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input
                                            id="new-path"
                                            placeholder="C:\Media or /var/media"
                                            className="bg-zinc-950 border-zinc-700 text-white flex-1"
                                        />
                                        <Button
                                            onClick={async () => {
                                                const pathInput = document.getElementById('new-path') as HTMLInputElement;
                                                if (!pathInput.value) return;
                                                await adminAddRootPath(pathInput.value, selectedUsers, isDefault);
                                                pathInput.value = '';
                                                setSelectedUsers([]);
                                                setIsDefault(false);
                                                router.refresh();
                                            }}
                                            variant="secondary"
                                            className="gap-2"
                                        >
                                            <Plus className="h-4 w-4" /> Add Path
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Map to Users</label>
                                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                            {users.map(user => (
                                                <div key={user.username} className="flex items-center gap-2 bg-zinc-900/50 p-2 rounded-md border border-white/5">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUsers.includes(user.username)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedUsers([...selectedUsers, user.username]);
                                                            else setSelectedUsers(selectedUsers.filter(u => u !== user.username));
                                                        }}
                                                        className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span className="text-sm truncate">{user.username}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-zinc-500 italic">* If no users selected, only Admin can see this folder.</p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2">
                                        <input
                                            type="checkbox"
                                            checked={isDefault}
                                            onChange={(e) => setIsDefault(e.target.checked)}
                                            className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <label className="text-sm text-zinc-300">Automatically map to new users (Default Root)</label>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Configured Roots</h3>
                                <div className="space-y-2">
                                    {(settings.roots || []).map((root) => (
                                        <div key={root.path} className="flex flex-col p-3 bg-zinc-950 rounded border border-zinc-800 gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm text-indigo-400 break-all">{root.path}</span>
                                                    {root.isDefault && (
                                                        <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 font-bold uppercase">Default</span>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="h-7 w-7 ml-2 flex-shrink-0"
                                                    onClick={() => handleDeletePath(root.path)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-1 items-center">
                                                <span className="text-[10px] text-zinc-500 uppercase font-black mr-1">Access:</span>
                                                {root.allowedUsers.length === 0 ? (
                                                    <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded">Admin Only</span>
                                                ) : (
                                                    root.allowedUsers.map(u => (
                                                        <span key={u} className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full border border-white/5">{u}</span>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {(!settings.roots || settings.roots.length === 0) && (
                                        <p className="text-center text-zinc-500 text-sm py-4">No media roots configured.</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="users" className="space-y-6 mt-6">
                    {/* Users Section */}
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white">User Management</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* Add User */}
                            <div className="p-4 border border-zinc-800 rounded-lg bg-zinc-950/50">
                                <h3 className="text-sm font-medium mb-3 text-zinc-300">Add New User</h3>
                                <form action={async (formData) => {
                                    await adminAddUser(formData);
                                    router.refresh();
                                }} className="flex flex-col sm:flex-row gap-3 items-end">
                                    <div className="w-full sm:flex-1 space-y-1">
                                        <label className="text-xs text-zinc-500">Username</label>
                                        <Input name="username" placeholder="alice" className="bg-zinc-900 border-zinc-700" required />
                                    </div>
                                    <div className="w-full sm:flex-1 space-y-1">
                                        <label className="text-xs text-zinc-500">Password</label>
                                        <Input name="password" type="password" placeholder="secret" className="bg-zinc-900 border-zinc-700" required />
                                    </div>
                                    <Button type="submit" className="w-full sm:w-auto">Add User</Button>
                                </form>
                            </div>

                            {/* User List */}
                            <div className="space-y-2">
                                {users.map((user) => (
                                    <div key={user.username} className="flex items-center justify-between p-3 bg-zinc-950 rounded border border-zinc-800">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-zinc-200">{user.username}</span>
                                            <span className="text-xs text-zinc-500 capitalize">{user.role}</span>
                                        </div>
                                        {user.username !== 'admin' && (
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleDeleteUser(user.username)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Clock className="h-5 w-5" /> Global Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px] pr-4">
                                <div className="space-y-3">
                                    {history.length === 0 ? (
                                        <p className="text-center text-zinc-500 py-10">No activity yet.</p>
                                    ) : (
                                        history.map((entry) => (
                                            <div key={entry.id} className="p-3 bg-zinc-950/50 border border-white/5 rounded-lg flex items-start gap-4">
                                                <div className={`p-2 rounded-full mt-1 ${entry.action === 'upload' ? 'bg-emerald-500/10 text-emerald-500' :
                                                    entry.action === 'delete' ? 'bg-rose-500/10 text-rose-500' :
                                                        'bg-indigo-500/10 text-indigo-500'
                                                    }`}>
                                                    {entry.action === 'upload' ? <Upload className="h-4 w-4" /> :
                                                        entry.action === 'delete' ? <Trash2 className="h-4 w-4" /> :
                                                            <Edit2 className="h-4 w-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm font-bold text-indigo-400 flex items-center gap-1">
                                                            <UserIcon className="h-3 w-3" /> {entry.username}
                                                        </span>
                                                        <span className="text-xs text-zinc-600">•</span>
                                                        <span className="text-xs text-zinc-500">{new Date(entry.timestamp).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-sm text-zinc-300 break-words">{entry.details}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
