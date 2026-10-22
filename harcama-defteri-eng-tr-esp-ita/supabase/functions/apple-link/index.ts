import { handleAppleLink } from '../_shared/handlers.ts';
import { realDeps } from '../_shared/deps.ts';

declare const Deno: { serve(h: (req: Request) => Promise<Response> | Response): void };

Deno.serve(async (req) => {
  const r = await handleAppleLink(req.method, req.headers.get('Authorization'), await req.text(), realDeps());
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
});
