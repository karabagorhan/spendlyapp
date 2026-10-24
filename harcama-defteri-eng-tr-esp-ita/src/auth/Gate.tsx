import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';
import { LanguageProvider, Lang, setLanguage } from '../i18n';
import { readLook } from '../store';
import { useTheme } from '../theme';
import { wipeLocalData } from '../wipe';
import { AccountProvider, useAccount } from './AccountProvider';
import { AUTH_MOCK } from './config';
import { Forgot, Onboarding, Recovery, SignIn, SignUp, Verify, Welcome } from './screens';

type Look = Awaited<ReturnType<typeof readLook>>;

/**
 * Uygulamanın kapısı: tanıtım, giriş, e-posta doğrulama ve parola sıfırlama ekranlarını gösterir;
 * "uygulama" aşamasına gelince asıl uygulamayı (children) çizer. Hesap yapılandırılmamışsa yalnızca ilk açılışta tanıtım görünür.
 */
export function Gate({ children }: { children: ReactNode }) {
  return (
    <AccountProvider onWipeLocal={() => { void wipeLocalData(); }}>
      <Phases>{children}</Phases>
    </AccountProvider>
  );
}

function Phases({ children }: { children: ReactNode }) {
  const { state, service, finishOnboarding, setLangPref } = useAccount();
  const phase = state.phase.name;
  const [look, setLook] = useState<Look | null>(null);

  // Dil/görünüm her aşama değişiminde depodan yeniden okunur (Ayarlar'da değişmiş olabilir)
  useEffect(() => {
    if (phase === 'app') return;
    let live = true;
    readLook().then((l) => live && setLook(l));
    return () => { live = false; };
  }, [phase]);

  const lang: Lang = look?.language ?? 'en';
  setLanguage(lang);
  const t = useTheme(look?.theme, look?.tint, look?.accent);

  if (phase === 'app') return <>{children}</>;
  if (phase === 'boot' || !look) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  const p = state.phase;
  return (
    <LanguageProvider value={lang}>
      <StatusBar style={t.statusBar} />
      {AUTH_MOCK ? <View testID="auth-mock" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} /> : null}
      {p.name === 'onboarding' ? (
        <Onboarding t={t} lang={lang} accountsEnabled={service.configured} onDone={finishOnboarding} onLang={(l) => { setLangPref(l); setLook({ ...look, language: l }); }} />
      ) : p.name === 'auth' ? (
        p.mode === 'welcome' ? <Welcome t={t} closable={p.closable} /> : p.mode === 'signin' ? <SignIn t={t} /> : p.mode === 'signup' ? <SignUp t={t} /> : <Forgot t={t} />
      ) : p.name === 'verify' ? (
        <Verify t={t} email={p.email} />
      ) : (
        <Recovery t={t} />
      )}
    </LanguageProvider>
  );
}
