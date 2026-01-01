import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { auth } from '@/auth';
import { getSettings, addHistory } from '@/lib/db';

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.name) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const files = formData.getAll('file') as File[];
        const relativePaths = formData.getAll('relativePaths') as string[];
        const dir = formData.get('dir') as string || '';

        if (!files || files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        const segments = dir.split('/').filter(Boolean);
        const rootIndex = parseInt(segments[0]);

        const settings = await getSettings();
        const roots = settings.roots || [];
        const targetRoot = roots[rootIndex];

        if (!targetRoot) {
            return NextResponse.json({ error: 'Invalid root index' }, { status: 400 });
        }

        const username = session.user.name!;
        // @ts-ignore
        const isAdmin = session.user.role === 'admin';

        // Security: Check if user is allowed (must be admin OR explicitly in the list)
        if (!isAdmin && !targetRoot.allowedUsers.includes(username)) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        const innerDir = segments.slice(1).join('/');
        const rootPath = targetRoot.path;

        let baseDir = rootPath;
        if (!isAdmin) {
            baseDir = path.join(rootPath, username);
            try { await fs.access(baseDir); } catch { await fs.mkdir(baseDir, { recursive: true }); }
        }

        const uploadResults = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const relPath = relativePaths[i] || file.name;

            const buffer = Buffer.from(await file.arrayBuffer());
            // For directory uploads, relPath will include the folder name.
            // E.g. "myfolder/file.txt"
            const safeInnerDir = path.normalize(innerDir).replace(/^(\.\.[\/\\])+/, '');
            const safeRelPath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');

            const uploadPath = path.join(baseDir, safeInnerDir, safeRelPath);

            if (!uploadPath.startsWith(baseDir)) {
                continue; // Skip malicious paths
            }

            const targetDir = path.dirname(uploadPath);
            try {
                await fs.access(targetDir);
            } catch {
                await fs.mkdir(targetDir, { recursive: true });
            }

            await fs.writeFile(uploadPath, buffer);
            uploadResults.push(relPath);
        }

        if (uploadResults.length > 0) {
            const details = uploadResults.length === 1
                ? `Uploaded ${uploadResults[0]}`
                : `Uploaded ${uploadResults.length} files to ${innerDir || 'root'}`;
            await addHistory(username, 'upload', details);
        }

        return NextResponse.json({ success: true, count: uploadResults.length });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
