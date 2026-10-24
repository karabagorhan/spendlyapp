// Uygulama kilidi: soğuk açılışta ve 30 sn'den uzun arka plandan dönünce kilit ekranı; arka planda opak gizlilik örtüsü.
// Kilit kapalıyken (ve web'de) hiçbir etkisi yoktur.
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { t as tr } from './i18n';
import { FONTS, Theme } from './theme';
import { Button } from './ui';

/** Arka planda bu süreden (ms) uzun kalınırsa yeniden kilitlenir. */
export const LOCK_AFTER_MS = 30_000;

// Sistem doğrulaması hiç yapılamıyorsa (parola kaldırıldı vb.) kullanıcıyı verisinden kilitlemeyiz.
const UNAVAILABLE = ['not_enrolled', 'not_available', 'passcode_not_set'];

/** Cihaz doğrulama yapabilir mi? (Biyometri kayıtlı ya da cihaz parolası kurulu.) Web'de her zaman false. */
export async function lockSupported(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const [hw, enrolled, level] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    return (hw && enrolled) || level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Sistem doğrulama istemi; cihaz parolası yedek olarak açıktır. 'unavailable': doğrulama yöntemi yok. */
export async function authenticate(): Promise<'ok' | 'fail' | 'unavailable'> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: tr('lock.reason'), disableDeviceFallback: false });
    if (r.success) return 'ok';
    return UNAVAILABLE.includes(r.error) ? 'unavailable' : 'fail';
  } catch {
    return 'fail';
  }
}

/** Ayarlar anahtarı için: cihaz kilidi destekliyor mu (web'de false). */
export function useLockSupported() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    lockSupported().then((v) => live && setOk(v));
    return () => { live = false; };
  }, []);
  return ok;
}

/**
 * `enabled` = ayarlardaki kilit. Dönen `locked`: kilit ekranı gösterilsin; `covered`: uygulama arka planda/etkin değil, gizlilik örtüsü.
 * `markUnlocked`: kullanıcı kilidi az önce doğrulayarak açtı (Ayarlar'daki anahtar), hemen kilitleme.
 */
export function useAppLock(enabled: boolean) {
  const active = enabled && Platform.OS !== 'web';
  const [locked, setLocked] = useState(true); // soğuk açılış: kilitli başlar
  const [covered, setCovered] = useState(false);
  const bgAt = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener('change', (s) => {
      setCovered(s !== 'active');
      if (s === 'background') bgAt.current = Date.now();
      else if (s === 'active') {
        if (bgAt.current !== null && Date.now() - bgAt.current > LOCK_AFTER_MS) setLocked(true);
        bgAt.current = null;
      }
    });
    return () => sub.remove();
  }, [active]);

  const unlock = useCallback(async () => {
    const r = await authenticate();
    if (r !== 'fail') setLocked(false);
  }, []);
  const markUnlocked = useCallback(() => setLocked(false), []);
  return { locked: active && locked, covered: active && covered, unlock, markUnlocked };
}

/** Tüm içeriği örten opak katman: kilit ekranı (düğmeli) ya da yalnızca gizlilik örtüsü. */
export function LockLayer({ locked, covered, onUnlock, t }: { locked: boolean; covered: boolean; onUnlock: () => void; t: Theme }) {
  if (!locked && !covered) return null;
  return (
    <View style={[StyleSheet.absoluteFill, st.wrap, { backgroundColor: t.bg }]} testID={locked ? 'lock-screen' : 'lock-cover'}>
      <Text style={{ color: t.fg, fontSize: 34, fontFamily: FONTS.display }}>{tr('app.name')}</Text>
      {locked ? (
        <>
          <Text style={{ color: t.muted, fontSize: 15, textAlign: 'center' }}>{tr('lock.hint')}</Text>
          <Button label={tr('lock.unlock')} onPress={onUnlock} t={t} style={st.btn} />
        </>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, zIndex: 1000, elevation: 1000 },
  btn: { minWidth: 200 },
});
