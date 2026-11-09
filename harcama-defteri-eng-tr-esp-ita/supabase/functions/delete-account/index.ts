import { handleDeleteAccount } from '../_shared/handlers.ts';
import { realDeps } from '../_shared/deps.ts';

declare const Deno: { serve(h: (req: Request) => Promise<Response> | Response): void };

// Çağıran: uygulama, kullanıcının JWT'siyle (functions.invoke). `verify_jwt` açık bırakılır (supabase/config.toml).
Deno.serve(async (req) => {
  const r = await handleDeleteAccount(req.method, req.headers.get('Authorization'), realDeps());
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
});
