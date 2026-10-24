import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type ScrollViewInstance, type TextInputInstance } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LANGS, Lang, t as tr } from '../i18n';
import { FONTS, Theme } from '../theme';
import { Chip, Ionicons } from '../ui';
import { AUTH_MOCK } from './config';
import { useLegal } from './legalSheet';
import { useAccount } from './AccountProvider';
import { AuthFailure, AuthUser } from './types';
import { Banner, AuthShell, BusyButton, CONTENT_MAX, LegalText, LinkButton, StrengthMeter, TextField, useAction } from './ui';
import { MIN_PASSWORD, passwordStrength, suggestEmail, validateEmail, validateName, validatePassword } from './validation';

const errText = (code: string) => tr('auth.err.' + code);
const emailMsg = (e: ReturnType<typeof validateEmail>) => (e === 'empty' ? tr('auth.val.emailEmpty') : e ? tr('auth.val.emailInvalid') : null);
const pwMsg = (e: ReturnType<typeof validatePassword>) =>
  e === 'short' ? tr('auth.val.pwShort', { n: MIN_PASSWORD }) : e === 'long' ? tr('auth.val.pwLong') : e === 'common' ? tr('auth.val.pwCommon') : e === 'email' ? tr('auth.val.pwEmail') : null;

/* ---------- Tanıtım ---------- */
const SLIDES = [
  { icon: 'wallet-outline', key: 'ob.1' },
  { icon: 'pie-chart-outline', key: 'ob.2' },
  { icon: 'shield-checkmark-outline', key: 'ob.3' },
] as const;

export function Onboarding({ t, lang, onLang, onDone, accountsEnabled }: { t: Theme; lang: Lang; onLang?: (l: Lang) => void; onDone: () => void; accountsEnabled: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollViewInstance>(null);
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const go = (n: number) => { setI(n); ref.current?.scrollTo({ x: n * width, animated: true }); };
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, minHeight: 44 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexShrink: 1, flexWrap: 'wrap' }}>
          {onLang ? LANGS.map((l) => <Chip key={l.code} label={l.native} active={lang === l.code} onPress={() => onLang(l.code)} t={t} />) : null}
        </View>
        {!last ? (
          <Pressable onPress={onDone} testID="ob-skip" hitSlop={10} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}>
            <Text style={{ color: t.muted, fontSize: 16, fontWeight: '600' }}>{tr('ob.skip')}</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {SLIDES.map((sl, idx) => (
          <View key={sl.key} style={{ width, paddingHorizontal: 30, alignItems: 'center', justifyContent: 'center', gap: 22 }} accessible={false} testID={`ob-slide-${idx}`}>
            <View style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={sl.icon} size={62} color={t.accent} />
            </View>
            <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 30, lineHeight: 37, fontFamily: FONTS.display, textAlign: 'center', maxWidth: CONTENT_MAX }}>{tr(sl.key + '.title')}</Text>
            <Text style={{ color: t.muted, fontSize: 17, lineHeight: 25, textAlign: 'center', maxWidth: CONTENT_MAX }}>
              {tr(sl.key === 'ob.3' && !accountsEnabled ? 'ob.3.bodyLocal' : sl.key + '.body')}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 22, gap: 18, width: '100%', maxWidth: CONTENT_MAX + 44, alignSelf: 'center' }}>
        <View accessible accessibilityLabel={tr('ob.page', { n: i + 1, total: SLIDES.length })} style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {SLIDES.map((_, idx) => <View key={idx} style={{ width: idx === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: idx === i ? t.accent : t.line }} />)}
        </View>
        <BusyButton label={tr(last ? 'ob.start' : 'ob.next')} onPress={() => (last ? onDone() : go(i + 1))} t={t} testID="ob-next" />
      </View>
    </View>
  );
}

/* ---------- Karşılama: sosyal giriş, e-posta, misafir ---------- */
export function Welcome({ t, closable }: { t: Theme; closable: boolean }) {
  const { service, dispatch, signedIn, continueAsGuest, meta, notice, setNotice } = useAccount();
  const [legal, openLegal] = useLegal(t);
  const a = useAction();
  const [apple, setApple] = useState(false);
  useEffect(() => { let live = true; service.appleAvailable().then((v) => live && setApple(v)).catch(() => {}); return () => { live = false; }; }, [service]);
  const google = Platform.OS !== 'web' || AUTH_MOCK;
  const social = (fn: () => Promise<AuthUser>) => async () => { const u = await a.run(fn); if (u) signedIn(u); };
  const shown = a.error ?? (notice?.kind === 'error' ? notice.code ?? 'unknown' : null);
  return (
    <AuthShell
      t={t}
      title={tr('auth.welcome.title')}
      subtitle={tr('auth.welcome.sub')}
      onClose={closable ? () => dispatch({ type: 'CLOSE_AUTH' }) : undefined}
      banners={<>
        {notice?.kind === 'deleted' ? <Banner kind="good" text={tr('auth.notice.deleted')} t={t} /> : null}
        {shown ? <Banner kind="error" text={errText(shown)} t={t} action={a.error ? undefined : { label: tr('auth.close'), onPress: () => setNotice(null) }} /> : null}
      </>}
      footer={<LegalText text={tr('auth.legalNotice')} onOpen={openLegal} t={t} center />}
    >
      {apple ? (
        Platform.OS === 'ios' ? (
          // iOS'ta Apple'ın resmi düğmesi (HIG gereği); testID resmi düğmede olmadığından sarmalayıcıda durur
          <View testID="btn-apple" style={{ opacity: a.busy ? 0.5 : 1 }} pointerEvents={a.busy ? 'none' : 'auto'} aria-busy={a.busy}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={t.name === 'noir' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={26}
              onPress={() => { if (!a.busy) social(() => service.signInWithApple(meta()))(); }}
              style={{ height: 52, width: '100%' }}
            />
          </View>
        ) : (
          <BusyButton testID="btn-apple" kind="dark" busy={a.busy} label={tr('auth.apple')} t={t} onPress={social(() => service.signInWithApple(meta()))} icon={<Ionicons name="logo-apple" size={22} color={t.bg} />} />
        )
      ) : null}
      {google ? (
        <BusyButton testID="btn-google" kind="ghost" busy={a.busy} label={tr('auth.google')} t={t} onPress={social(() => service.signInWithGoogle(meta()))} icon={<Ionicons name="logo-google" size={20} color={t.fg} />} />
      ) : null}
      {apple || google ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
          <Text style={{ color: t.muted, fontSize: 13 }}>{tr('auth.or')}</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
        </View>
      ) : null}
      <BusyButton testID="btn-signup" label={tr('auth.signupEmail')} t={t} onPress={() => { setNotice(null); dispatch({ type: 'GO', mode: 'signup' }); }} icon={<Ionicons name="mail-outline" size={20} color={t.accentFg} />} />
      <BusyButton testID="btn-signin" kind="ghost" label={tr('auth.signinEmail')} t={t} onPress={() => { setNotice(null); dispatch({ type: 'GO', mode: 'signin' }); }} />
      {!closable ? <LinkButton testID="btn-guest" label={tr('auth.guest')} onPress={continueAsGuest} t={t} /> : null}
      {legal}
    </AuthShell>
  );
}

/* ---------- Kayıt ---------- */
export function SignUp({ t }: { t: Theme }) {
  const { service, dispatch, signedIn, meta, recordConsent } = useAccount();
  const [legal, openLegal] = useLegal(t);
  const a = useAction();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const refs = { email: useRef<TextInputInstance>(null), pw: useRef<TextInputInstance>(null), pw2: useRef<TextInputInstance>(null) };
  const touch = (k: string) => setTouched((p) => ({ ...p, [k]: true }));
  const suggestion = useMemo(() => (touched.email ? suggestEmail(email) : null), [touched.email, email]);

  const errors = {
    name: validateName(name) ? null : tr('auth.val.name'),
    email: emailMsg(validateEmail(email)),
    pw: pw ? pwMsg(validatePassword(pw, email)) : tr('auth.val.pwEmpty'),
    pw2: pw2 !== pw ? tr('auth.val.pwMismatch') : null,
    consent: consent ? null : tr('auth.val.consent'),
  };
  const show = (k: keyof typeof errors) => (touched[k] || touched.submit ? errors[k] : null);

  const submit = async () => {
    setTouched({ name: true, email: true, pw: true, pw2: true, consent: true, submit: true });
    if (Object.values(errors).some(Boolean)) return;
    const r = await a.run(() => service.signUp(email, pw, { ...meta(), ...(name.trim() ? { name: name.trim() } : {}) }));
    if (!r) return;
    recordConsent();
    if (r.status === 'signed-in') signedIn(r.user);
    else dispatch({ type: 'VERIFY', email: r.email });
  };

  return (
    <AuthShell
      t={t}
      title={tr('auth.signup.title')}
      subtitle={tr('auth.signup.sub')}
      onBack={() => dispatch({ type: 'GO', mode: 'welcome' })}
      banners={a.error ? <Banner kind="error" text={errText(a.error)} t={t} action={a.error === 'network' ? { label: tr('auth.retry'), onPress: submit } : undefined} /> : null}
      footer={<LinkButton testID="to-signin" label={tr('auth.haveAccount')} onPress={() => dispatch({ type: 'GO', mode: 'signin' })} t={t} />}
    >
      <TextField t={t} kind="name" label={tr('auth.name')} value={name} onChangeText={setName} error={show('name')} onBlur={() => touch('name')} returnKeyType="next" onSubmitEditing={() => refs.email.current?.focus()} maxLength={60} testID="su-name" />
      <TextField t={t} kind="email" label={tr('auth.email')} value={email} onChangeText={setEmail} error={show('email')} inputRef={refs.email} onBlur={() => touch('email')} returnKeyType="next" onSubmitEditing={() => refs.pw.current?.focus()} testID="su-email"
        hint={suggestion ? (
          <Pressable onPress={() => setEmail(suggestion)} accessibilityRole="button" hitSlop={6}>
            <Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>{tr('auth.val.emailSuggest', { email: suggestion })}</Text>
          </Pressable>
        ) : null} />
      <TextField t={t} kind="newPassword" label={tr('auth.passwordNew', { n: MIN_PASSWORD })} value={pw} onChangeText={setPw} error={show('pw')} inputRef={refs.pw} onBlur={() => touch('pw')} returnKeyType="next" onSubmitEditing={() => refs.pw2.current?.focus()} testID="su-pw"
        hint={pw ? <StrengthMeter level={passwordStrength(pw, email)} t={t} /> : null} />
      <TextField t={t} kind="newPassword" label={tr('auth.passwordConfirm')} value={pw2} onChangeText={setPw2} error={show('pw2')} inputRef={refs.pw2} onBlur={() => touch('pw2')} returnKeyType="done" onSubmitEditing={submit} testID="su-pw2" />
      <View style={{ gap: 6 }}>
        <Pressable onPress={() => { setConsent((v) => !v); touch('consent'); }} accessibilityRole="checkbox" aria-checked={consent} accessibilityLabel={tr('auth.consent').replace(/[\[\]]/g, '')} testID="su-consent" style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 44 }}>
          <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={26} color={consent ? t.accent : errors.consent && (touched.consent || touched.submit) ? t.warn : t.muted} />
          <View style={{ flex: 1, paddingTop: 2 }}><LegalText text={tr('auth.consent')} onOpen={openLegal} t={t} size={14} /></View>
        </Pressable>
        {show('consent') ? <Text accessibilityRole="alert" style={{ color: t.warn, fontSize: 13 }}>{errors.consent}</Text> : null}
      </View>
      <BusyButton testID="su-submit" label={tr('auth.submitSignup')} busy={a.busy} onPress={submit} t={t} />
      {legal}
    </AuthShell>
  );
}

/* ---------- Giriş ---------- */
export function SignIn({ t }: { t: Theme }) {
  const { service, dispatch, signedIn, notice, setNotice } = useAccount();
  const a = useAction();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [touched, setTouched] = useState(false);
  const pwRef = useRef<TextInputInstance>(null);
  const errors = { email: emailMsg(validateEmail(email)), pw: pw ? null : tr('auth.val.pwEmpty') };

  const submit = async () => {
    setTouched(true);
    if (errors.email || errors.pw) return;
    const u = await a.run(() => service.signIn(email, pw));
    if (u) { setNotice(null); signedIn(u); }
  };
  return (
    <AuthShell
      t={t}
      title={tr('auth.signin.title')}
      subtitle={tr('auth.signin.sub')}
      onBack={() => dispatch({ type: 'GO', mode: 'welcome' })}
      banners={<>
        {notice?.kind === 'resetDone' ? <Banner kind="good" text={tr('auth.notice.resetDone')} t={t} /> : null}
        {a.error ? (
          <Banner kind="error" text={errText(a.error)} t={t}
            action={a.error === 'email_not_confirmed' ? { label: tr('auth.verify.resend'), onPress: () => dispatch({ type: 'VERIFY', email: email.trim().toLowerCase() }) } : a.error === 'network' ? { label: tr('auth.retry'), onPress: submit } : undefined} />
        ) : null}
      </>}
      footer={<LinkButton testID="to-signup" label={tr('auth.noAccount')} onPress={() => dispatch({ type: 'GO', mode: 'signup' })} t={t} />}
    >
      <TextField t={t} kind="email" label={tr('auth.email')} value={email} onChangeText={setEmail} error={touched ? errors.email : null} returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} testID="si-email" />
      <TextField t={t} kind="password" label={tr('auth.password')} value={pw} onChangeText={setPw} error={touched ? errors.pw : null} inputRef={pwRef} returnKeyType="go" onSubmitEditing={submit} testID="si-pw" />
      <LinkButton testID="to-forgot" label={tr('auth.forgot')} onPress={() => dispatch({ type: 'GO', mode: 'forgot' })} t={t} align="left" />
      <BusyButton testID="si-submit" label={tr('auth.submitSignin')} busy={a.busy} onPress={submit} t={t} />
    </AuthShell>
  );
}

/* ---------- Parolamı unuttum ---------- */
export function Forgot({ t }: { t: Theme }) {
  const { service, dispatch } = useAccount();
  const a = useAction();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return; const h = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(h); }, [wait]);
  const err = emailMsg(validateEmail(email));
  const submit = async () => {
    setTouched(true);
    if (err || wait > 0) return;
    const ok = await a.run(async () => { await service.sendPasswordReset(email); return true; });
    if (ok) { setSent(true); setWait(60); }
  };
  return (
    <AuthShell
      t={t}
      title={tr('auth.forgot.title')}
      subtitle={tr('auth.forgot.sub')}
      onBack={() => dispatch({ type: 'GO', mode: 'signin' })}
      banners={<>
        {a.error ? <Banner kind="error" text={errText(a.error)} t={t} action={a.error === 'network' ? { label: tr('auth.retry'), onPress: submit } : undefined} /> : null}
        {sent ? <Banner kind="good" text={tr('auth.forgot.sent')} t={t} /> : null}
      </>}
      footer={<LinkButton label={tr('auth.forgot.back')} onPress={() => dispatch({ type: 'GO', mode: 'signin' })} t={t} />}
    >
      <TextField t={t} kind="email" label={tr('auth.email')} value={email} onChangeText={setEmail} error={touched ? err : null} returnKeyType="go" onSubmitEditing={submit} testID="fg-email" />
      <BusyButton testID="fg-submit" label={wait > 0 ? tr('auth.verify.resendIn', { n: wait }) : tr('auth.forgot.submit')} busy={a.busy} disabled={wait > 0} onPress={submit} t={t} />
    </AuthShell>
  );
}

/* ---------- E-posta doğrulama bekleniyor ---------- */
export function Verify({ t, email }: { t: Theme; email: string }) {
  const { service, dispatch, state, signOut } = useAccount();
  const a = useAction();
  const [wait, setWait] = useState(60);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (wait <= 0) return; const h = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(h); }, [wait]);
  const resend = async () => {
    if (wait > 0) return;
    const ok = await a.run(async () => { await service.resendVerification(email); return true; });
    if (ok) { setSent(true); setWait(60); }
  };
  return (
    <AuthShell
      t={t}
      title={tr('auth.verify.title')}
      subtitle={tr('auth.verify.body', { email })}
      banners={<>
        {a.error ? <Banner kind="error" text={errText(a.error)} t={t} /> : null}
        {sent && !a.error ? <Banner kind="good" text={tr('auth.verify.sent')} t={t} /> : null}
      </>}
      footer={<>
        <LinkButton testID="vf-wrong" label={tr('auth.verify.wrong')} onPress={() => (state.user ? signOut() : dispatch({ type: 'TO_AUTH', mode: 'signup' }))} t={t} />
      </>}
    >
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="mail-open-outline" size={44} color={t.accent} />
        </View>
      </View>
      <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>{tr('auth.verify.hint')}</Text>
      <BusyButton testID="vf-resend" kind="ghost" label={wait > 0 ? tr('auth.verify.resendIn', { n: wait }) : tr('auth.verify.resend')} busy={a.busy} disabled={wait > 0} onPress={resend} t={t} />
      <BusyButton testID="vf-signin" label={tr('auth.verify.signin')} onPress={() => (state.user ? signOut() : dispatch({ type: 'TO_AUTH', mode: 'signin' }))} t={t} />
    </AuthShell>
  );
}

/* ---------- Şifre sıfırlama bağlantısından sonra yeni parola ---------- */
export function Recovery({ t }: { t: Theme }) {
  const { service, signedIn, setNotice } = useAccount();
  const a = useAction();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [touched, setTouched] = useState(false);
  const pw2Ref = useRef<TextInputInstance>(null);
  const e1 = pw ? pwMsg(validatePassword(pw)) : tr('auth.val.pwEmpty');
  const e2 = pw2 !== pw ? tr('auth.val.pwMismatch') : null;
  const submit = async () => {
    setTouched(true);
    if (e1 || e2) return;
    const u = await a.run(async () => {
      await service.updatePassword(pw);
      const user = await service.getUser();
      if (!user) throw new AuthFailure('reauth_required');
      return user;
    });
    if (u) { setNotice({ kind: 'resetDone' }); signedIn(u); }
  };
  return (
    <AuthShell t={t} title={tr('auth.recovery.title')} banners={a.error ? <Banner kind="error" text={errText(a.error)} t={t} /> : null}>
      <TextField t={t} kind="newPassword" label={tr('auth.passwordNew', { n: MIN_PASSWORD })} value={pw} onChangeText={setPw} error={touched ? e1 : null} returnKeyType="next" onSubmitEditing={() => pw2Ref.current?.focus()} testID="rc-pw"
        hint={pw ? <StrengthMeter level={passwordStrength(pw)} t={t} /> : null} />
      <TextField t={t} kind="newPassword" label={tr('auth.passwordConfirm')} value={pw2} onChangeText={setPw2} error={touched ? e2 : null} inputRef={pw2Ref} returnKeyType="done" onSubmitEditing={submit} testID="rc-pw2" />
      <BusyButton testID="rc-submit" label={tr('auth.recovery.submit')} busy={a.busy} onPress={submit} t={t} />
    </AuthShell>
  );
}
