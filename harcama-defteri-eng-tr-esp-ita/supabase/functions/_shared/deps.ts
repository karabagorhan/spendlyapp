// Deno çalışma zamanı: gerçek bağımlılıklar. (Test edilmez; mantık handlers.ts içindedir.)
import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Deps } from './handlers.ts';

declare const Deno: { env: { get(k: string): string | undefined } };

export function realDeps(): Deps {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  return {
    now: () => Date.now(),
    async getUser(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      return error || !data.user ? null : data.user;
    },
    async deleteUser(id) {
      const { error } = await admin.auth.admin.deleteUser(id);
      return !error;
    },
    async getAppleToken(userId) {
      const { data } = await admin.from('apple_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
      return data?.refresh_token ?? null;
    },
    async saveAppleToken(userId, token) {
      const { error } = await admin.from('apple_tokens').upsert({ user_id: userId, refresh_token: token });
      return !error;
    },
    apple: teamId && keyId && clientId && privateKey ? { teamId, keyId, clientId, privateKey } : null,
    log: (m) => console.log(m),
  };
}
