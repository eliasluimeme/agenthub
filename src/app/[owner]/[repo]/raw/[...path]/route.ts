import { repoBy, repoFile } from '@/lib/queries';

/** Plain-text contents of a repository file (Raw and Download buttons). `?download=1` saves it. */
export async function GET(req: Request, ctx: { params: Promise<{ owner: string; repo: string; path: string[] }> }) {
  const { owner, repo: name, path: segs } = await ctx.params;
  const repo = await repoBy(owner, name);
  const path = segs.map(decodeURIComponent).join('/');
  const file = repo ? await repoFile(repo.id, path) : undefined;
  if (!file) return new Response('Not found', { status: 404 });
  const download = new URL(req.url).searchParams.has('download');
  const filename = path.split('/').pop()!.replace(/[^\w.-]/g, '_');
  return new Response(file.content, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      ...(download ? { 'content-disposition': `attachment; filename="${filename}"` } : {}),
    },
  });
}
