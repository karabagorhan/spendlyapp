import { useState } from 'react';
import { Modal, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t as tr } from '../i18n';
import { FONTS, Theme } from '../theme';
import { Label } from '../ui';
import { useAccount } from './AccountProvider';
import { useLegal } from './legalSheet';
import { AuthFailure, AuthUser } from './types';
import { Banner, BusyButton, TextField, useAction } from './ui';

/** Ayarlar'daki "Hesap" ve "Yasal" bölümleri; hesap silme akışı burada. */
export function AccountSection({ t }: { t: Theme }) {
  const { state, service, dispatch, signOut } = useAccount();
  const [legal, openLegal] = useLegal(t);
  const [del, setDel] = useState(false);
  const user = state.user;
  return (
    <>
      {service.configured ? (
        <View style={{ gap: 10 }} testID="account-section">
          <Label t={t}>{tr('acct.title')}</Label>
          {user ? (
            <>
              <Text style={{ color: t.fg, fontSize: 16 }}>{user.email ? tr('acct.signedAs', { email: user.email }) : tr('acct.signedAsNoEmail', { provider: tr('acct.provider.' + user.provider) })}</Text>
              <BusyButton testID="acct-signout" kind="ghost" label={tr('acct.signout')} t={t} onPress={signOut} />
              <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>{tr('acct.signoutHint')}</Text>
              <BusyButton testID="acct-delete" kind="danger" label={tr('acct.delete')} t={t} onPress={() => setDel(true)} />
            </>
          ) : (
            <>
              <Text style={{ color: t.fg, fontSize: 16, fontWeight: '600' }}>{tr('acct.guestTitle')}</Text>
              <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>{tr('acct.guestBody')}</Text>
              <BusyButton testID="acct-open" kind="ghost" label={tr('acct.open')} t={t} onPress={() => dispatch({ type: 'OPEN_AUTH' })} />
            </>
          )}
        </View>
      ) : null}
      <View style={{ gap: 10 }}>
        <Label t={t}>{tr('acct.legal')}</Label>
        <BusyButton testID="legal-privacy" kind="ghost" label={tr('legal.privacy')} t={t} onPress={() => openLegal('privacy')} />
        <BusyButton testID="legal-terms" kind="ghost" label={tr('legal.terms')} t={t} onPress={() => openLegal('terms')} />
      </View>
      {legal}
      {user ? <DeleteSheet visible={del} user={user} onClose={() => setDel(false)} t={t} /> : null}
    </>
  );
}

function DeleteSheet({ visible, user, onClose, t }: { visible: boolean; user: AuthUser; onClose: () => void; t: Theme }) {
  const insets = useSafeAreaInsets();
  const { service, deleteAccount, signOut, meta } = useAccount();
  const a = useAction();
  const [pw, setPw] = useState('');
  const [wipe, setWipe] = useState(false);
  const [touched, setTouched] = useState(false);
  const needPw = user.provider === 'email';
  const providerName = tr('acct.provider.' + user.provider);

  const confirm = async () => {
    setTouched(true);
    if (needPw && !pw) return;
    await a.run(async () => {
      // Güvenlik için silmeden önce yeniden kimlik doğrulama (sunucu da son girişin yakın olmasını ister)
      const fresh = needPw ? await service.signIn(user.email ?? '', pw) : user.provider === 'apple' ? await service.signInWithApple(meta()) : await service.signInWithGoogle(meta());
      if (fresh.id !== user.id) {
        await signOut();
        throw new AuthFailure('mismatch');
      }
      await deleteAccount(wipe);
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <View style={{ flex: 1, backgroundColor: t.bg }} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={{ padding: 22, paddingTop: Platform.OS === 'ios' ? 28 : insets.top + 16, paddingBottom: insets.bottom + 30, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 28, fontFamily: FONTS.display }}>{tr('del.title')}</Text>
          {a.error ? <Banner kind="error" text={tr('auth.err.' + a.error)} t={t} /> : null}
          <Text style={{ color: t.fg, fontSize: 16, lineHeight: 23 }}>{tr('del.body')}</Text>
          {user.provider === 'apple' ? <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>{tr('del.apple')}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: t.fg, fontSize: 16 }}>{tr('del.wipe')}</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>{tr('del.wipeHint')}</Text>
            </View>
            <Switch testID="del-wipe" value={wipe} onValueChange={setWipe} trackColor={{ true: t.accent }} accessibilityLabel={tr('del.wipe')} />
          </View>
          {needPw ? (
            <TextField t={t} kind="password" label={tr('del.reauthPassword')} value={pw} onChangeText={setPw} error={touched && !pw ? tr('auth.val.pwEmpty') : null} returnKeyType="go" onSubmitEditing={confirm} testID="del-pw" />
          ) : (
            <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>{tr('del.reauthSocial', { provider: providerName })}</Text>
          )}
          <BusyButton testID="del-confirm" kind="danger" label={tr('del.confirm')} busy={a.busy} onPress={confirm} t={t} />
          <BusyButton testID="del-cancel" kind="ghost" label={tr('del.cancel')} onPress={onClose} disabled={a.busy} t={t} />
        </ScrollView>
      </View>
    </Modal>
  );
}
