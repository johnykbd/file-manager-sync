import { getFiles } from './actions';
import { FileBrowser } from '@/components/file-browser';
import { auth } from '@/auth';

export default async function Page({ searchParams }: { searchParams: Promise<{ path?: string }> }) {
  const params = await searchParams;
  const path = params.path || '';
  const files = await getFiles(path);
  const session = await auth();

  return (
    <main className="min-h-screen bg-black">
      <FileBrowser files={files} currentPath={path} session={session} />
    </main>
  );
}
