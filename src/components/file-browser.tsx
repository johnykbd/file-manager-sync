'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileItem } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
    BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
    Folder,
    File as FileIcon,
    Film,
    Music,
    Image as ImageIcon,
    Home,
    Upload,
    Loader2,
    Settings as SettingsIcon,
    LogOut,
    Database,
    Copy as ClipboardCopy,
    Scissors,
    ClipboardPaste,
    Edit2,
    Trash,
    Plus,
    MoreHorizontal,
    History,
    Search,
    Clock,
    Smartphone,
    ShieldCheck,
    CheckCircle2,
    RefreshCw,
    Wifi,
    WifiOff,
    Menu,
    X,
    FolderPlus,
    ChevronUp,
    ChevronDown,
    FileCheck,
    AlertCircle,
    Zap,
    User as UserIcon,
    LayoutGrid,
    List,
} from 'lucide-react';
import {
    deleteFile,
    renameFile,
    pasteFile,
    createFolder,
    userGetHistory,
    toggleSync as serverToggleSync,
    getSyncStatus
} from '@/app/actions';
import { HistoryEntry } from '@/lib/db';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useSession } from 'next-auth/react';

interface FileBrowserProps {
    files: FileItem[];
    currentPath: string;
    session?: any;
}

interface UploadTask {
    id: string;
    name: string;
    progress: number;
    size: number;
    status: 'uploading' | 'completed' | 'error';
}

const getFileIcon = (filename: string, isDirectory: boolean) => {
    if (isDirectory) return <Folder className="h-10 w-10 text-blue-500 fill-blue-500/20" />;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext || '')) return <Film className="h-10 w-10 text-rose-500" />;
    if (['mp3', 'wav', 'ogg'].includes(ext || '')) return <Music className="h-10 w-10 text-purple-500" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="h-10 w-10 text-green-500" />;
    return <FileIcon className="h-10 w-10 text-zinc-400" />;
};

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function FileBrowser({ files, currentPath, session: serverSession }: FileBrowserProps) {
    const router = useRouter();
    const { data: clientSession, status } = useSession();

    const session = serverSession || clientSession;

    // @ts-ignore
    const isAdmin = session?.user?.name === 'admin' || session?.user?.role === 'admin';
    const isLoading = status === 'loading';

    const [mounted, setMounted] = React.useState(false);
    const [clipboard, setClipboard] = React.useState<{ path: string; operation: 'copy' | 'move' } | null>(null);
    const [renameState, setRenameState] = React.useState<{ open: boolean; path: string; currentName: string }>({ open: false, path: '', currentName: '' });
    const [newName, setNewName] = React.useState('');
    const [historyState, setHistoryState] = React.useState<{ open: boolean; items: HistoryEntry[] }>({ open: false, items: [] });
    const [syncState, setSyncState] = React.useState<{ enabled: boolean; allowCellular: boolean; galleryLinked: boolean; open: boolean }>({ enabled: false, allowCellular: false, galleryLinked: false, open: false });
    const [isNavOpen, setIsNavOpen] = React.useState(false);
    const [wakeLock, setWakeLock] = React.useState<any>(null);
    const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

    // Upload Manager State
    const [uploads, setUploads] = React.useState<UploadTask[]>([]);
    const [isUploadManagerOpen, setIsUploadManagerOpen] = React.useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const folderInputRef = React.useRef<HTMLInputElement>(null);
    const syncInputRef = React.useRef<HTMLInputElement>(null);

    const pathParts = currentPath.split('/').filter(Boolean);

    React.useEffect(() => {
        setMounted(true);
        getSyncStatus().then(status => {
            const s = status as { enabled: boolean; allowCellular: boolean; galleryLinked: boolean };
            setSyncState(prev => ({
                ...prev,
                enabled: s.enabled,
                allowCellular: s.allowCellular || false,
                galleryLinked: s.galleryLinked || false
            }));
        });

        // Request persistent storage permission for Android
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(persistent => {
                if (persistent) console.log("Storage will not be cleared by the OS.");
            });
        }

        return () => {
            if (wakeLock) {
                wakeLock.release().then(() => setWakeLock(null));
            }
        };
    }, []);

    // Screen Wake Lock logic to prevent Android from sleeping during sync
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                // @ts-ignore
                const lock = await navigator.wakeLock.request('screen');
                setWakeLock(lock);
                console.log('Wake Lock active');
            } catch (err) {
                console.error('Wake Lock failed:', err);
            }
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        const filesArray = Array.from(selectedFiles);

        // Connection check
        // @ts-ignore
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection && (connection.type === 'cellular' || connection.effectiveType.includes('2g') || connection.effectiveType.includes('3g'))) {
            if (!syncState.allowCellular) {
                alert('Sync on cellular is disabled. Connect to Wi-Fi to backup.');
                return;
            }
        }

        // Activate Wake Lock
        await requestWakeLock();
        setIsUploadManagerOpen(true);

        for (const file of filesArray) {
            uploadFileWithProgress(file);
        }
    };

    const uploadFileWithProgress = (file: File) => {
        const taskId = Math.random().toString(36).substring(7);
        const newTask: UploadTask = {
            id: taskId,
            name: file.name,
            progress: 0,
            size: file.size,
            status: 'uploading'
        };

        setUploads(prev => [newTask, ...prev]);

        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('dir', currentPath || 'Mobile Backup');
        // @ts-ignore
        formData.append('relativePaths', file.webkitRelativePath || file.name);

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setUploads(prev => prev.map(t => t.id === taskId ? { ...t, progress: percent } : t));
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                setUploads(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', progress: 100 } : t));
                router.refresh();

                // If all done, release wake lock
                if (uploads.filter(u => u.status === 'uploading').length <= 1) {
                    wakeLock?.release().then(() => setWakeLock(null));
                }

                setTimeout(() => {
                    setUploads(prev => prev.filter(t => t.id !== taskId));
                }, 10000);
            } else {
                setUploads(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
            }
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
    };

    const handleUpdateSync = async (enabled: boolean, allowCellular: boolean, galleryLinked: boolean) => {
        try {
            await serverToggleSync({ enabled, allowCellular, galleryLinked });
            setSyncState({ ...syncState, enabled, allowCellular, galleryLinked });
        } catch (error) {
            console.error(error);
            alert('Failed to update sync settings');
        }
    };

    const fetchHistory = async () => {
        try {
            const history = await userGetHistory();
            setHistoryState({ open: true, items: history });
        } catch (error) {
            console.error(error);
            alert('Failed to load history');
        }
    };

    const handleDelete = async (filePath: string) => {
        if (!confirm('Are you sure you want to delete this?')) return;
        try {
            await deleteFile(filePath);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to delete');
        }
    };

    const handleRename = async () => {
        if (!newName.trim()) return;
        try {
            await renameFile(renameState.path, newName);
            setRenameState({ ...renameState, open: false });
            setNewName('');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to rename');
        }
    };

    const handleCopy = (path: string) => {
        setClipboard({ path, operation: 'copy' });
    };

    const handleCut = (path: string) => {
        setClipboard({ path, operation: 'move' });
    };

    const handlePaste = async () => {
        if (!clipboard) return;
        try {
            await pasteFile(clipboard.path, currentPath, clipboard.operation);
            if (clipboard.operation === 'move') setClipboard(null);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to paste');
        }
    };

    const handleCreateFolder = async () => {
        const name = prompt('Folder Name:');
        if (!name) return;
        try {
            await createFolder(currentPath, name);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to create folder');
        }
    };

    const totalUploading = uploads.filter(u => u.status === 'uploading').length;
    const averageProgress = uploads.length > 0
        ? Math.round(uploads.reduce((acc, u) => acc + u.progress, 0) / uploads.length)
        : 0;

    return (
        <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
            {/* Header */}
            <header className="flex-none p-4 flex items-center justify-between border-b border-white/10 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-3 overflow-hidden">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsNavOpen(!isNavOpen)}>
                        {isNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </Button>
                    <Breadcrumb className="hidden sm:block">
                        <BreadcrumbList className="flex-nowrap text-nowrap whitespace-nowrap">
                            <BreadcrumbItem>
                                <BreadcrumbLink asChild>
                                    <Link href="/" className="flex items-center gap-1 text-white/70 hover:text-white transition-colors">
                                        <Home className="h-4 w-4" /> Root
                                    </Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            {pathParts.length > 0 && <BreadcrumbSeparator className="text-white/20" />}
                            {pathParts.map((part, index) => {
                                const href = `/?path=${pathParts.slice(0, index + 1).join('/')}`;
                                const isLast = index === pathParts.length - 1;
                                return (
                                    <React.Fragment key={index}>
                                        <BreadcrumbItem>
                                            {isLast ? (
                                                <BreadcrumbPage className="text-white font-medium">{decodeURIComponent(part)}</BreadcrumbPage>
                                            ) : (
                                                <BreadcrumbLink asChild>
                                                    <Link href={href} className="text-white/70 hover:text-white transition-colors">
                                                        {decodeURIComponent(part)}
                                                    </Link>
                                                </BreadcrumbLink>
                                            )}
                                        </BreadcrumbItem>
                                        {!isLast && <BreadcrumbSeparator className="text-white/20" />}
                                    </React.Fragment>
                                );
                            })}
                        </BreadcrumbList>
                    </Breadcrumb>
                    <div className="sm:hidden font-bold tracking-tight text-indigo-400">KBD Stream</div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex bg-zinc-900 border border-white/10 rounded-lg p-1 mr-2">
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-8 w-8 px-0"
                            onClick={() => setViewMode('grid')}
                            title="Grid View"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-8 w-8 px-0"
                            onClick={() => setViewMode('list')}
                            title="List View"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="hidden md:flex items-center gap-2">
                        {mounted && isAdmin && (
                            <Link href="/admin">
                                <Button variant="secondary" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 px-3 border-none h-9">
                                    <SettingsIcon className="h-4 w-4" />
                                    <span>Settings</span>
                                </Button>
                            </Link>
                        )}

                        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white" onClick={fetchHistory} title="Sync History">
                            <History className="h-5 w-5" />
                        </Button>

                        <Button variant="ghost" size="icon" className={`${syncState.enabled ? 'text-indigo-400' : 'text-zinc-400'} hover:text-white`} onClick={() => setSyncState({ ...syncState, open: true })} title="Sync Settings">
                            <Smartphone className="h-5 w-5" />
                        </Button>

                        <div className="w-px h-6 bg-white/10 mx-1" />

                        <Button variant="outline" size="sm" className="bg-zinc-900 border-white/10 text-white h-9" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="h-4 w-4 mr-2" /> Files
                        </Button>

                        <Button variant="outline" size="sm" className="bg-zinc-900 border-white/10 text-white h-9" onClick={() => folderInputRef.current?.click()}>
                            <Folder className="h-4 w-4 mr-2" /> Folder
                        </Button>

                        {syncState.enabled && (
                            <Button variant="outline" size="sm" className="bg-indigo-600/20 border-indigo-500/30 text-indigo-400 h-9" onClick={() => syncInputRef.current?.click()}>
                                <RefreshCw className="h-4 w-4 mr-2" /> Sync Gallery
                            </Button>
                        )}

                        <div className="flex items-center gap-2 pr-3 pl-2 py-1 bg-white/5 rounded-full border border-white/5 ml-2 group hover:bg-white/10 transition-colors">
                            <div className="h-7 w-7 rounded-full bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                                <UserIcon className="h-4 w-4 text-indigo-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-500 font-bold leading-none uppercase tracking-tighter">Active User</span>
                                <span className="text-xs font-bold text-zinc-200 leading-tight truncate max-w-[80px]">{session?.user?.name || 'User'}</span>
                            </div>
                        </div>

                        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white ml-2" onClick={() => signOut()}>
                            <LogOut className="h-4 w-4 mr-2" /> Sign Out
                        </Button>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden text-zinc-400">
                                <Plus className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-white w-48 shadow-2xl">
                            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
                                <Upload className="h-4 w-4" /> Upload File
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => folderInputRef.current?.click()} className="gap-2">
                                <Folder className="h-4 w-4" /> Upload Folder
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleCreateFolder} className="gap-2">
                                <Plus className="h-4 w-4" /> New Folder
                            </DropdownMenuItem>
                            {syncState.enabled && (
                                <DropdownMenuItem onClick={() => syncInputRef.current?.click()} className="text-indigo-400 font-bold gap-2 focus:bg-indigo-500/10">
                                    <RefreshCw className="h-4 w-4" /> Sync Gallery
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Hidden Inputs */}
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleUpload} multiple />
            <input type="file" className="hidden"
                // @ts-ignore
                webkitdirectory="" directory=""
                ref={folderInputRef} onChange={handleUpload}
            />
            <input type="file" className="hidden" ref={syncInputRef} onChange={handleUpload} multiple accept="image/*,video/*" />

            {/* OneDrive-style Upload Manager */}
            {uploads.length > 0 && (
                <div className={`fixed bottom-4 right-4 z-[100] w-[calc(100%-32px)] sm:w-80 transition-all duration-500 ease-in-out ${isUploadManagerOpen ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'}`}>
                    <div className="bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden shadow-black/90">
                        <button
                            onClick={() => setIsUploadManagerOpen(!isUploadManagerOpen)}
                            className="w-full h-12 px-4 flex items-center justify-between bg-zinc-800/80 hover:bg-zinc-700 transition-colors border-b border-white/5 backdrop-blur-md"
                        >
                            <div className="flex items-center gap-3">
                                {totalUploading > 0 ? (
                                    <div className="bg-indigo-600/20 p-1.5 rounded-lg">
                                        <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                                    </div>
                                ) : (
                                    <div className="bg-emerald-600/20 p-1.5 rounded-lg">
                                        <FileCheck className="h-4 w-4 text-emerald-400" />
                                    </div>
                                )}
                                <span className="text-sm font-bold tracking-tight">
                                    {totalUploading > 0 ? `Syncing ${totalUploading} items` : 'All items synced'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-500 font-mono">{averageProgress}%</span>
                                {isUploadManagerOpen ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronUp className="h-4 w-4 text-zinc-500" />}
                            </div>
                        </button>

                        <div className="px-4 py-2 bg-zinc-800/40">
                            <Progress value={averageProgress} className="h-1.5 bg-zinc-950 rounded-full [&_[data-slot=progress-indicator]]:bg-indigo-500" />
                        </div>

                        <ScrollArea className="h-72 bg-zinc-900/50">
                            <div className="p-3 space-y-1.5">
                                {uploads.map(task => (
                                    <div key={task.id} className="p-3 bg-white/[0.03] rounded-xl border border-white/5 space-y-2.5 hover:bg-white/[0.06] transition-colors">
                                        <div className="flex items-center justify-between text-xs overflow-hidden">
                                            <span className="truncate flex-1 pr-3 text-zinc-200 font-medium">{task.name}</span>
                                            {task.status === 'completed' ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                            ) : (
                                                <span className="shrink-0 text-[10px] font-mono text-zinc-500">{task.progress}%</span>
                                            )}
                                        </div>
                                        {task.status === 'uploading' && (
                                            <Progress value={task.progress} className="h-1 bg-zinc-950 rounded-full [&_[data-slot=progress-indicator]]:bg-indigo-600" />
                                        )}
                                        {task.status === 'error' && (
                                            <div className="flex items-center gap-2 text-[10px] text-rose-400 font-bold bg-rose-400/10 p-1.5 rounded-lg">
                                                <AlertCircle className="h-3 w-3" /> Failed to upload
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <ScrollArea className="flex-1 p-4">
                <div className={viewMode === 'grid'
                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-32"
                    : "flex flex-col gap-1 pb-32"
                }>
                    {/* Parent Directory */}
                    {currentPath && (
                        <Link href={currentPath.includes('/') ? `/?path=${currentPath.substring(0, currentPath.lastIndexOf('/'))}` : '/'} className="block group">
                            {viewMode === 'grid' ? (
                                <Card className="bg-zinc-900/30 border-white/5 hover:bg-white/5 transition-all cursor-pointer h-full backdrop-blur-sm">
                                    <CardContent className="flex flex-col items-center justify-center p-6 gap-3 h-full aspect-square">
                                        <Folder className="h-12 w-12 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                                        <span className="text-sm text-zinc-500 font-medium truncate w-full text-center">..</span>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 text-zinc-400 transition-colors border border-transparent hover:border-white/5">
                                    <Folder className="h-5 w-5" />
                                    <span className="text-sm font-medium">.. (Parent Directory)</span>
                                </div>
                            )}
                        </Link>
                    )}

                    {files.map((file) => {
                        const isVideo = !file.isDirectory && ['mp4', 'mkv', 'webm', 'mov', 'avi'].some(ext => file.name.toLowerCase().endsWith(ext));
                        const isImage = !file.isDirectory && ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext => file.name.toLowerCase().endsWith(ext));
                        const href = file.isDirectory ? `/?path=${file.path}` : isVideo ? `/watch/${file.path}` : `/api/stream/${file.path}`;

                        return (
                            <ContextMenu key={file.name}>
                                <ContextMenuTrigger>
                                    <div className="h-full">
                                        {viewMode === 'grid' ? (
                                            <Link href={href} className="block group h-full">
                                                <Card className="bg-zinc-900/30 border-white/5 hover:bg-white/5 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/50 transition-all cursor-pointer h-full backdrop-blur-sm border overflow-hidden">
                                                    <CardContent className="flex flex-col items-center justify-center p-0 gap-0 h-full relative aspect-square">
                                                        {isImage ? (
                                                            <div className="w-full h-full relative overflow-hidden">
                                                                <img
                                                                    src={`/api/stream/${file.path}`}
                                                                    alt={file.name}
                                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                                    loading="lazy"
                                                                />
                                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-md p-2 border-t border-white/5">
                                                                    <p className="text-[10px] sm:text-xs font-medium text-zinc-200 truncate w-full" title={file.name}>{file.name}</p>
                                                                </div>
                                                            </div>
                                                        ) : isVideo ? (
                                                            <div className="w-full h-full relative overflow-hidden bg-black group-hover:bg-zinc-900 transition-colors">
                                                                <video
                                                                    src={`/api/stream/${file.path}#t=1`}
                                                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500 group-hover:scale-110"
                                                                    muted
                                                                    playsInline
                                                                    onMouseOver={(e) => e.currentTarget.play()}
                                                                    onMouseOut={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 1; }}
                                                                />
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <div className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:scale-125 transition-transform duration-300">
                                                                        <Film className="h-5 w-5 text-white fill-white/20" />
                                                                    </div>
                                                                </div>
                                                                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-md p-2 border-t border-white/5">
                                                                    <p className="text-[10px] sm:text-xs font-medium text-zinc-200 truncate w-full" title={file.name}>{file.name}</p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center p-4 gap-3">
                                                                <div className="relative z-0 transition-transform duration-300 group-hover:scale-110">
                                                                    {!currentPath && file.isDirectory ? (
                                                                        <Database className="h-10 w-10 text-indigo-500 fill-indigo-500/20" />
                                                                    ) : getFileIcon(file.name, file.isDirectory)}
                                                                </div>
                                                                <div className="w-full text-center z-10">
                                                                    <p className="text-sm font-medium text-zinc-200 truncate w-full" title={file.name}>{file.name}</p>
                                                                    {!file.isDirectory && <p className="text-xs text-zinc-500 mt-1">{formatSize(file.size)}</p>}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </Link>
                                        ) : (
                                            <Link href={href} className="flex items-center gap-4 p-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-all group">
                                                <div className="h-12 w-12 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0 overflow-hidden border border-white/5 relative">
                                                    {isImage ? (
                                                        <img src={`/api/stream/${file.path}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                    ) : isVideo ? (
                                                        <video src={`/api/stream/${file.path}#t=1`} className="w-full h-full object-cover" muted playsInline />
                                                    ) : (
                                                        getFileIcon(file.name, file.isDirectory)
                                                    )}
                                                    {isVideo && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                            <Film className="h-3 w-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-zinc-200 truncate group-hover:text-indigo-400 transition-colors">{file.name}</p>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        {!file.isDirectory && <span className="text-[10px] text-zinc-500 font-medium">{formatSize(file.size)}</span>}
                                                        <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-black text-[8px]">
                                                            {isVideo ? 'Video' : isImage ? 'Image' : file.isDirectory ? 'Folder' : 'File'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal className="h-4 w-4 text-zinc-600" />
                                                </div>
                                            </Link>
                                        )}
                                    </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56 bg-zinc-900 border-white/10 text-zinc-300">
                                    <ContextMenuItem onClick={() => window.open(isVideo ? `/watch/${file.path}` : `/api/stream/${file.path}`, '_blank')} className="gap-2 focus:bg-white/5">
                                        <Home className="h-4 w-4 text-indigo-400" /> Open
                                    </ContextMenuItem>
                                    <ContextMenuItem className="gap-2 focus:bg-white/5" onClick={() => handleCopy(file.path)}>
                                        <ClipboardCopy className="h-4 w-4" /> Copy
                                    </ContextMenuItem>
                                    <ContextMenuItem className="gap-2 focus:bg-white/5" onClick={() => {
                                        setRenameState({ open: true, path: file.path, currentName: file.name });
                                        setNewName(file.name);
                                    }}>
                                        <Edit2 className="h-4 w-4" /> Rename
                                    </ContextMenuItem>
                                    <DropdownMenuSeparator className="bg-white/5" />
                                    <ContextMenuItem className="gap-2 text-rose-400 focus:text-rose-400 focus:bg-rose-500/10" onClick={() => handleDelete(file.path)}>
                                        <Trash className="h-4 w-4" /> Delete
                                    </ContextMenuItem>
                                </ContextMenuContent>
                            </ContextMenu>
                        );
                    })}
                </div>
            </ScrollArea>

            {/* Sync Settings Dialog */}
            <Dialog open={syncState.open} onOpenChange={(open) => setSyncState({ ...syncState, open })}>
                <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-sm p-0 overflow-hidden shadow-2xl">
                    <div className="p-6 space-y-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                                <div className="bg-indigo-600/20 p-2 rounded-xl">
                                    <Smartphone className="h-6 w-6 text-indigo-400" />
                                </div>
                                Phone Sync Pro
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className={`p-5 rounded-2xl border transition-all duration-300 ${syncState.galleryLinked ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-zinc-900 border-white/5 shadow-inner'}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <Zap className={`h-5 w-5 ${syncState.galleryLinked ? 'text-indigo-400 fill-indigo-400' : 'text-zinc-500'}`} />
                                        <span className="text-sm font-black tracking-tight uppercase">Express Auto-Sync</span>
                                    </div>
                                    {syncState.galleryLinked && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                                    {syncState.galleryLinked
                                        ? "Hybrid mode is running. KBD Stream will check your mobile gallery items for backup every time the app is launched."
                                        : "Native mobile browsers limit background folder access. Enable Hybrid mode for an app-like backup experience."}
                                </p>
                                <Button size="sm" className={`w-full font-bold h-10 ${syncState.galleryLinked ? 'bg-zinc-800 text-zinc-400' : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'}`} onClick={() => handleUpdateSync(true, syncState.allowCellular, true)}>
                                    {syncState.galleryLinked ? 'Hybrid Mode Active' : 'Enable Hybrid Auto-Sync'}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-bold">Cellular Backup</p>
                                        {syncState.allowCellular ? <Wifi className="h-3 w-3 text-indigo-400" /> : <WifiOff className="h-3 w-3 text-zinc-500" />}
                                    </div>
                                    <p className="text-[10px] text-zinc-500">Protect your mobile data plan</p>
                                </div>
                                <button
                                    onClick={() => handleUpdateSync(syncState.enabled, !syncState.allowCellular, syncState.galleryLinked)}
                                    className={`w-12 h-6.5 rounded-full transition-all relative ${syncState.allowCellular ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-zinc-800'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-4.5 h-4.5 bg-white rounded-full transition-transform duration-300 ${syncState.allowCellular ? 'translate-x-5.5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex gap-3 items-center">
                            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                            <p className="text-[10px] text-emerald-400/80 font-medium leading-normal">
                                Secure end-to-end sync enabled. Your items are uploaded directly to your private server.
                            </p>
                        </div>
                    </div>

                    <div className="p-4 bg-zinc-900 border-t border-white/5 flex flex-col gap-2">
                        <Button
                            className="w-full bg-indigo-600 hover:bg-indigo-500 h-12 font-black text-sm tracking-wide shadow-xl shadow-indigo-600/10"
                            onClick={() => { setSyncState({ ...syncState, open: false }); syncInputRef.current?.click(); }}
                        >
                            <RefreshCw className="h-4.5 w-4.5 mr-2" />
                            SCAN GALLERY NOW
                        </Button>
                        <Button variant="ghost" onClick={() => setSyncState({ ...syncState, open: false })} className="text-zinc-500 font-bold">Close Panel</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Navigation Drawer (Mobile) */}
            {isNavOpen && (
                <div className="md:hidden fixed inset-0 z-[60] bg-black/70 backdrop-blur-md" onClick={() => setIsNavOpen(false)}>
                    <div className="w-[85%] max-w-xs h-full bg-zinc-950 border-r border-white/10 p-6 flex flex-col animate-in slide-in-from-left duration-500 shadow-[20px_0_50px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                <Film className="h-7 w-7 text-white" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black tracking-tighter">KBD STREAM</span>
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Personal Server</span>
                            </div>
                        </div>

                        {/* Mobile User Profile Section */}
                        <div className="mt-8 mb-6 p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center border border-indigo-400/30">
                                <UserIcon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-bold text-white truncate">{session?.user?.name || 'User'}</span>
                                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-tight">{isAdmin ? 'Administrator' : 'Explorer'}</span>
                            </div>
                        </div>

                        <div className="flex-1 space-y-1.5">
                            <Link href="/" className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20" onClick={() => setIsNavOpen(false)}>
                                <Home className="h-5 w-5" /> Home Library
                            </Link>
                            <button onClick={() => { setIsNavOpen(false); fetchHistory(); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left group">
                                <History className="h-5 w-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                                <span className="font-bold text-zinc-300 group-hover:text-white">Activity History</span>
                            </button>
                            <button onClick={() => { setIsNavOpen(false); setSyncState({ ...syncState, open: true }); }} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left group">
                                <Smartphone className="h-5 w-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                                <span className="font-bold text-zinc-300 group-hover:text-white">Phone Backup</span>
                            </button>
                            {isAdmin && (
                                <Link href="/admin" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all group" onClick={() => setIsNavOpen(false)}>
                                    <SettingsIcon className="h-5 w-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
                                    <span className="font-bold text-zinc-300 group-hover:text-white">System Admin</span>
                                </Link>
                            )}
                        </div>

                        <div className="pt-6 border-t border-white/5">
                            <button onClick={() => signOut()} className="flex items-center gap-4 p-4 rounded-2xl text-rose-500 hover:bg-rose-500/10 w-full transition-all text-left group">
                                <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                                <span className="font-bold">Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
