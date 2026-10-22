import { ReactNode, useCallback, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLanguage, t as tr } from '../i18n';
import { LEGAL, LEGAL_VERSION, isPlaceholder } from '../legal/config';
import { LegalKind, hasLegalTranslation, legalDoc } from '../legal/texts';
import { FONTS, Theme } from '../theme';
import { Ionicons } from '../ui';

/** Gizlilik Politikası / Kullanım Koşulları metnini tam ekran bir pencerede gösterir. */
export function LegalSheet({ kind, onClose, t }: { kind: LegalKind | null; onClose: () => void; t: Theme }) {
  const insets = useSafeAreaInsets();
  const lang = getLanguage();
  const doc = kind ? legalDoc(kind, lang) : null;
  const url = kind === 'privacy' ? LEGAL.privacyUrl : LEGAL.termsUrl;
  return (
    <Modal visible={!!kind} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={Platform.OS === 'web'}>
      <View style={{ flex: 1, backgroundColor: t.bg }} accessibilityViewIsModal>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8, paddingBottom: 8 }}>
          <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 24, fontFamily: FONTS.display, flex: 1 }}>{doc?.title}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('legal.close')} testID="legal-close" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={26} color={t.fg} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 18 }}>
          {!hasLegalTranslation(lang) ? (
            <View style={{ backgroundColor: t.accentSoft, borderRadius: 14, padding: 12 }}>
              <Text style={{ color: t.fg, fontSize: 14, lineHeight: 20 }}>{tr('legal.noTranslation')}</Text>
            </View>
          ) : null}
          {doc?.sections.map((sec, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Text accessibilityRole="header" style={{ color: t.fg, fontSize: 17, fontWeight: '700' }}>{i + 1}. {sec.title}</Text>
              {sec.body.map((p, j) => <Text key={j} style={{ color: t.fg, fontSize: 15, lineHeight: 22, opacity: 0.9 }}>{p}</Text>)}
            </View>
          ))}
          <Text style={{ color: t.muted, fontSize: 13 }}>{tr('legal.version', { v: LEGAL_VERSION })}</Text>
          {!isPlaceholder(url) ? (
            <Pressable onPress={() => Linking.openURL(url).catch(() => {})} accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: t.accent, fontWeight: '600', fontSize: 15 }}>{tr('legal.openWeb')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Ekranlarda yasal metin penceresini açmak için: `[sheet, open] = useLegal(t)`. `sheet` ekrana bir kez yerleştirilir. */
export function useLegal(t: Theme): [ReactNode, (k: LegalKind) => void] {
  const [kind, setKind] = useState<LegalKind | null>(null);
  const close = useCallback(() => setKind(null), []);
  return [<LegalSheet key="legal" kind={kind} onClose={close} t={t} />, setKind];
}
