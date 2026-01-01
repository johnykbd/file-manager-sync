import { VideoPlayer } from '@/components/video-player';

export default async function WatchPage({ params }: { params: Promise<{ path: string[] }> }) {
    const { path: pathParts } = await params;

    // pathParts are usually decoded. We need to re-encode for the URL.
    // We decode first to ensure we work with raw strings, then encode for the URL path.
    const streamUrl = pathParts.map(p => encodeURIComponent(decodeURIComponent(p))).join('/');

    const fileName = decodeURIComponent(pathParts[pathParts.length - 1]);
    const parentPath = pathParts.slice(0, -1).map(p => decodeURIComponent(p)).join('/');

    return (
        <VideoPlayer
            url={`/api/stream/${streamUrl}`}
            title={fileName}
            parentPath={parentPath}
        />
    );
}
