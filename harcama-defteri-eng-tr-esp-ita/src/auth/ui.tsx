import * as Network from 'expo-network';
import { ReactNode, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t as tr } from '../i18n';
import { FONTS, Theme } from '../theme';
import { Ionicons, Label } from '../ui';
import { LegalKind } from '../legal/texts';
import { AuthErrorCode, AuthFailure } from './types';

/** Ağ isteği bu sürede yanıt vermezse (bağlantı yarıda koptu) kullanıcıya "ağ hatası" gösterilir; ekran sonsuza dek dönmez. */
export const REQUEST_TIMEOUT_MS = 20000;
/** Giriş ekranlarında içerik sütununun en büyük genişliği (tablet/web). */
export const CONTENT_MAX = 520;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const h = setTimeout(() => reject(new AuthFailure('network')), ms);
    p.then((v) => { clearTimeout(h); resolve(v); }, (e) => { clearTimeout(h); reject(e); });
  });
}

/**
 * Tek bir kullanıcı eylemini güvenle çalıştırır: art arda dokunmada ikinci çağrı yok sayılır (çifte gönderim yok),
 * `busy` düğmeyi kilitler, hata koda çevrilir, vazgeçme ('cancelled') sessizce geçer, ekran kapanmışsa durum yazılmaz.
 */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorCode | null>(null);
  const live = useRef(true);
  const inflight = useRef(false);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (inflight.current) return undefined;
    inflight.current = true;
    setBusy(true);
    setError(null);
    try {
      return await withTimeout(fn(), REQUEST_TIMEOUT_MS);
    } catch (e) {
      const code = e instanceof AuthFailure ? e.code : 'unknown';
      if (live.current && code !== 'cancelled') setError(code);
      return undefined;
    } finally {
      inflight.current = false;
      if (live.current) setBusy(false);
    }
  }, []);
  return { run, busy, error, setError };
}

/** Cihaz çevrimdışıysa true (bağlantı durumu bilinmiyorsa false: yanlışlıkla uyarı çıkmasın). */
export function useOffline(): boolean {
  const s = Network.useNetworkState();
  return s.isConnected === false;
}

/** "[Koşullar] ve [Gizlilik]" biçimindeki metni, köşeli parantezli kısımları dokunulabilir bağlantı yaparak çizer (1. = koşullar, 2. = gizlilik). */
export function LegalText({ text, onOpen, t, size = 13, center }: { text: string; onOpen: (k: LegalKind) => void; t: Theme; size?: number; center?: boolean }) {
  const parts = text.split(/\[(.+?)\]/g);
  const kinds: LegalKind[] = ['terms', 'privacy'];
  return (
    <Text style={{ color: t.muted, fontSize: size, lineHeight: size + 7, textAlign: center ? 'center' : 'left' }}>
      {parts.map((p, i) => {
        if (i % 2 === 0) return p;
        const kind = kinds[(i - 1) / 2] ?? 'privacy';
        return (
          <Text key={i} onPress={() => onOpen(kind)} accessibilityRole="link" style={{ color: t.accent, textDecorationLine: 'underline', fontWeight: '600' }}>{p}</Text>
        );
      })}
    </Text>
  );
}

export function TextField({ label, value, onChangeText, t, error, hint, secure, inputRef, onBlur, onSubmitEditing, returnKeyType, kind = 'text', testID, maxLength, autoFocus }: {
  label: string; value: string; onChangeText: (s: string) => void; t: Theme; error?: string | null; hint?: ReactNode; secure?: boolean;
  inputRef?: RefObject<TextInput | null>; onBlur?: () => void; onSubmitEditing?: () => void; returnKeyType?: 'next' | 'done' | 'go';
  kind?: 'text' | 'email' | 'newPassword' | 'password' | 'name'; testID?: string; maxLength?: number; autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const isPw = kind === 'password' || kind === 'newPassword';
  const props =
    kind === 'email' ? { keyboardType: 'email-address' as const, autoCapitalize: 'none' as const, autoCorrect: false, autoComplete: 'email' as const, textContentType: 'emailAddress' as const }
    : kind === 'password' ? { autoCapitalize: 'none' as const, autoCorrect: false, autoComplete: 'current-password' as const, textContentType: 'password' as const }
    : kind === 'newPassword' ? { autoCapitalize: 'none' as const, autoCorrect: false, autoComplete: 'new-password' as const, textContentType: 'newPassword' as const }
    : kind === 'name' ? { autoCapitalize: 'words' as const, autoComplete: 'name' as const, textContentType: 'name' as const }
    : {};
  return (
    <View style={{ gap: 6 }}>
      <Label t={t}>{label}</Label>
      <View>
        <TextInput
          ref={inputRef}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          secureTextEntry={secure ?? (isPw && !shown)}
          maxLength={maxLength}
          autoFocus={autoFocus}
          placeholderTextColor={t.muted}
          accessibilityLabel={label}
          style={[s.input, { backgroundColor: t.bg, borderColor: error ? t.warn : t.line, color: t.fg, paddingRight: isPw ? 48 : 14 }]}
          {...props}
        />
        {isPw ? (
          <Pressable onPress={() => setShown((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr(shown ? 'auth.hide' : 'auth.show')} style={s.eye}>
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={22} color={t.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: t.warn, fontSize: 13, lineHeight: 18 }}>{error}</Text> : null}
      {!error && hint ? <View>{hint}</View> : null}
    </View>
  );
}

export function StrengthMeter({ level, t }: { level: 0 | 1 | 2 | 3; t: Theme }) {
  const color = level === 0 ? t.warn : level === 1 ? t.gold : t.good;
  return (
    <View accessible accessibilityLabel={tr('auth.strength', { level: tr('auth.strength.' + level) })} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < Math.max(1, level) ? color : t.line }} />
        ))}
      </View>
      <Text style={{ color: t.muted, fontSize: 12 }}>{tr('auth.strength', { level: tr('auth.strength.' + level) })}</Text>
    </View>
  );
}

export function Banner({ kind, text, t, action }: { kind: 'error' | 'info' | 'good'; text: string; t: Theme; action?: { label: string; onPress: () => void } }) {
  const bg = kind === 'error' ? t.warnSoft : kind === 'good' ? t.goodSoft : t.accentSoft;
  const fg = kind === 'error' ? t.warn : kind === 'good' ? t.good : t.fg;
  const icon = kind === 'error' ? 'alert-circle-outline' : kind === 'good' ? 'checkmark-circle-outline' : 'information-circle-outline';
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[s.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={20} color={fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ color: t.fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="button" hitSlop={6}>
            <Text style={{ color: fg, fontWeight: '700', fontSize: 14 }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Giriş ekranlarının ortak çerçevesi: güvenli alan, klavye, çevrimdışı uyarısı, isteğe bağlı üst çubuk. */
export function AuthShell({ t, title, subtitle, children, onBack, backLabel, onClose, footer, banners }: {
  t: Theme; title: string; subtitle?: string; children: ReactNode; onBack?: () => void; backLabel?: string; onClose?: () => void; footer?: ReactNode; banners?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const offline = useOffline();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28, paddingHorizontal: 22, flexGrow: 1, alignItems: 'center' }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {/* Tablet ve geniş ekranlarda içerik okunaklı bir sütunda kalır */}
        <View style={{ width: '100%', maxWidth: CONTENT_MAX, flexGrow: 1, gap: 20 }}>
        <View style={s.topRow}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={backLabel ?? tr('auth.back')} style={s.topBtn}>
              <Ionicons name="chevron-back" size={26} color={t.fg} />
            </Pressable>
          ) : <View style={s.topBtn} />}
          {onClose ? (
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('auth.close')} style={s.topBtn}>
              <Ionicons name="close" size={26} color={t.fg} />
            </Pressable>
          ) : null}
        </View>
        {offline ? <Banner kind="info" text={tr('auth.offline')} t={t} /> : null}
        {banners}
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 32, lineHeight: 38, fontFamily: FONTS.display }}>{title}</Text>
          {subtitle ? <Text style={{ color: t.muted, fontSize: 16, lineHeight: 23 }}>{subtitle}</Text> : null}
        </View>
        <View style={{ gap: 16 }}>{children}</View>
        {footer ? <View style={{ gap: 14, marginTop: 'auto', paddingTop: 8 }}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Düğme: meşgulken kilitlenir ve dönen gösterge çıkar. */
export function BusyButton({ label, onPress, busy, t, kind = 'primary', disabled, icon, testID }: {
  label: string; onPress: () => void; busy?: boolean; t: Theme; kind?: 'primary' | 'ghost' | 'danger' | 'dark'; disabled?: boolean; icon?: ReactNode; testID?: string;
}) {
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.warn : kind === 'dark' ? t.fg : t.surface;
  const fg = kind === 'primary' ? t.accentFg : kind === 'danger' ? t.surface : kind === 'dark' ? t.bg : t.fg;
  const border = kind === 'ghost' ? t.goldLine : bg;
  const off = disabled || busy;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!!off}
      accessibilityRole="button"
      aria-busy={!!busy}
      accessibilityLabel={busy ? `${label}. ${tr('auth.working')}` : label}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {icon}
          <Text style={{ color: fg, fontWeight: '600', fontSize: 16, letterSpacing: 0.2 }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function LinkButton({ label, onPress, t, align = 'center', testID }: { label: string; onPress: () => void; t: Theme; align?: 'center' | 'left'; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: t.accent, fontSize: 15, fontWeight: '600', textAlign: align }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  input: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 17 },
  eye: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, alignItems: 'flex-start' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  btn: { height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
});
