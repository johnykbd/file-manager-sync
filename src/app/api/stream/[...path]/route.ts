import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { auth } from '@/auth';
import { getSettings } from '@/lib/db';

const stat = promisify(fs.stat);

const getMimeType = (filename: string) => {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.mp4': return 'video/mp4';
        case '.webm': return 'video/webm';
        case '.ogg': return 'video/ogg';
        case '.mov': return 'video/quicktime';
        case '.avi': return 'video/x-msvideo';
        case '.mp3': return 'audio/mpeg';
        case '.wav': return 'audio/wav';
        case '.png': return 'image/png';
        case '.jpg': case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.webp': return 'image/webp';
        case '.pdf': return 'application/pdf';
        case '.txt': return 'text/plain';
        default: return 'application/octet-stream';
    }
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const session = await auth();
    if (!session?.user?.name) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { path: pathParams } = await params;
    if (pathParams.length === 0) return new NextResponse('Missing path', { status: 400 });

    const rootIndex = parseInt(decodeURIComponent(pathParams[0]));
    const filePathParams = pathParams.slice(1).map(decodeURIComponent).join('/');

    // Resolve paths
    const settings = await getSettings();
    const roots = settings.roots || [];
    const targetRoot = roots[rootIndex];

    if (!targetRoot) return new NextResponse('Invalid root', { status: 400 });

    const username = session.user.name!;
    // @ts-ignore
    const isAdmin = session.user.role === 'admin';

    // Security: Check if user is allowed (must be admin OR explicitly in the list)
    if (!isAdmin && !targetRoot.allowedUsers.includes(username)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const rootPath = targetRoot.path;

    let baseDir = rootPath;
    if (!isAdmin) {
        baseDir = path.join(rootPath, username);
    }

    const safePath = path.normalize(filePathParams).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(baseDir, safePath);

    if (!filePath.startsWith(baseDir)) {
        return new NextResponse('Access Denied', { status: 403 });
    }

    try {
        const stats = await stat(filePath);
        const range = req.headers.get('range');
        const mimeType = getMimeType(filePath);

        if (!range) {
            const stream = fs.createReadStream(filePath);
            return new NextResponse(stream as any, {
                headers: {
                    'Content-Length': stats.size.toString(),
                    'Content-Type': mimeType,
                }
            });
        }

        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });

        return new NextResponse(file as any, {
            status: 206,
            headers: {
                'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize.toString(),
                'Content-Type': mimeType,
            }
        });

    } catch (err) {
        return new NextResponse('File not found', { status: 404 });
    }
}
