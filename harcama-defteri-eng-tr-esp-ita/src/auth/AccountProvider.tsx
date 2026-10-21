import * as Linking from 'expo-linking';
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { LEGAL_VERSION } from '../legal/config';
import { Lang, getLanguage } from '../i18n';
import { AUTH_MOCK } from './config';
import { Action, State, initial, reduce } from './flow';
import { createMockService } from './mockService';
import { Prefs, clearAccountData, defaultPrefs, loadPrefs, savePrefs } from './prefs';
import { createSupabaseService } from './supabaseService';
import { AuthErrorCode, AuthFailure, AuthService, AuthUser, SignUpMeta } from './types';

export type Notice = { kind: 'verified' | 'resetSent' | 'resetDone' | 'deleted' | 'error'; code?: AuthErrorCode } | null;

type Ctx = {
  state: State;
  service: AuthService;
  notice: Notice;
  setNotice: (n: Notice) => void;
  dispatch: (a: Action) => void;
  meta: () => SignUpMeta;
  /** Sunucu işlemini çalıştırır; hata `AuthFailure` olarak yeniden fırlatılır. */
  signedIn: (u: AuthUser) => void;
  finishOnboarding: () => void;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
  deleteAccount: (wipeLocal: boolean) => Promise<void>;
  recordConsent: () => void;
  setLangPref: (l: Lang) => void;
};

const AccountContext = createContext<Ctx | null>(null);
export const useAccount = () => {
  const c = useContext(AccountContext);
  if (!c) throw new Error('AccountProvider eksik');
  return c;
};

/**
 * Hesap durumunu tutar: açılışta tercihleri ve oturumu okur, dış olayları (oturum sona erdi, e-posta bağlantısı) akışa bağlar.
 * `onWipeLocal`: hesap silinirken "cihazdaki verileri de sil" seçildiyse harcama verisini sıfırlar.
 */
export function AccountProvider({ children, onWipeLocal }: { children: ReactNode; onWipeLocal: () => void }) {
  // Sahte servis YALNIZCA geliştirme modunda ya da testin açıkça verdiği bayrakla çalışır. Derleme değişkeni (EXPO_PUBLIC_AUTH_MOCK) tek başına yetmez:
  // Metro önbelleği değeri bir derlemeden ötekine taşıyabilir; üretim paketine sahte servisin sızması bu çalışma zamanı kontrolüyle engellenir.
  const service = useMemo<AuthService>(() => (AUTH_MOCK && (__DEV__ || (globalThis as { __ALLOW_AUTH_MOCK__?: boolean }).__ALLOW_AUTH_MOCK__ === true) ? createMockService() : createSupabaseService()), []);
  const [state, dispatch] = useReducer(reduce, initial);
  const [notice, setNotice] = useState<Notice>(null);
  const prefs = useRef<Prefs>(defaultPrefs);
  const stateRef = useRef(state);
  stateRef.current = state;

  const persist = useCallback((patch: Partial<Prefs>) => {
    prefs.current = { ...prefs.current, ...patch };
    savePrefs(prefs.current);
  }, []);

  // Açılış: tercihler + varsa kayıtlı oturum
  useEffect(() => {
    let live = true;
    (async () => {
      const p = await loadPrefs();
      prefs.current = p;
      const user = await service.getUser().catch(() => null);
      if (live) dispatch({ type: 'BOOT', onboarded: p.onboarded, guest: p.guest, user, configured: service.configured });
    })();
    return () => { live = false; };
  }, [service]);

  // Oturum dışarıdan değişirse
  useEffect(() => service.subscribe((user) => dispatch({ type: 'EXTERNAL', user })), [service]);

  // E-posta doğrulama / şifre sıfırlama bağlantıları. Soğuk açılışta bağlantı işlemi, açılış (BOOT) bitene kadar BEKLER:
  // aksi halde yavaş biten BOOT, bağlantının açtığı "yeni parola" ekranını ezip kullanıcıyı giriş ekranına atabilir.
  const booted = state.phase.name !== 'boot';
  useEffect(() => {
    if (!booted) return;
    const open = async (url: string | null) => {
      if (!url) return;
      try {
        const r = await service.handleLink(url);
        if (r.kind === 'signed-in') { dispatch({ type: 'SIGNED_IN', user: r.user }); setNotice({ kind: 'verified' }); }
        else if (r.kind === 'recovery') dispatch({ type: 'RECOVERY' });
      } catch (e) {
        setNotice({ kind: 'error', code: e instanceof AuthFailure ? e.code : 'link_invalid' });
      }
    };
    Linking.getInitialURL().then(open).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => open(e.url));
    return () => sub.remove();
  }, [service, booted]);

  const meta = useCallback((): SignUpMeta => ({ consentVersion: LEGAL_VERSION, lang: getLanguage() }), []);

  const value: Ctx = {
    state, service, notice, setNotice, dispatch, meta,
    signedIn: (user) => { persist({ onboarded: true, guest: false, consent: { version: LEGAL_VERSION, at: Date.now() } }); dispatch({ type: 'SIGNED_IN', user }); },
    finishOnboarding: () => { persist({ onboarded: true, guest: !service.configured }); dispatch({ type: 'OB_DONE' }); },
    continueAsGuest: () => { persist({ onboarded: true, guest: true }); dispatch({ type: 'GUEST' }); },
    recordConsent: () => persist({ consent: { version: LEGAL_VERSION, at: Date.now() } }),
    setLangPref: (l) => persist({ lang: l }),
    signOut: async () => {
      await service.signOut();
      persist({ guest: false });
      dispatch({ type: 'SIGNED_OUT' });
    },
    deleteAccount: async (wipeLocal) => {
      await service.deleteAccount();
      if (wipeLocal) onWipeLocal();
      await clearAccountData();
      prefs.current = { ...defaultPrefs, onboarded: true, lang: prefs.current.lang };
      savePrefs(prefs.current);
      setNotice({ kind: 'deleted' });
      dispatch({ type: 'SIGNED_OUT' });
    },
  };
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
