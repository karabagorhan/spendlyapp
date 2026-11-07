import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';
import { FONTS } from './theme';

/**
 * Açılış animasyonu (~3,2 sn). Yerel açılış ekranıyla aynı kareden başlar (aynı zemin, aynı boyutta "M"), böylece geçiş görünmez.
 *   1. Işık "M" şeridinin üzerinden ağır ağır akar (sol ayaktan sağ ayağa)
 *   2. Logonun arkasından ince altın bir halka açılıp söner, altında "Monibo" yazısı belirir
 *   3. Kısa bir bekleyişten sonra logo hafifçe büyürken katman sönerek uygulamayı açar
 * Hareketi azalt açıksa yalnızca kısa bir solma kalır.
 */

/** Açılış ekranının zemini ve logo boyutu: app.json'daki expo-splash-screen ayarıyla aynı olmalı. */
export const SPLASH_BG = '#0B0D0F';
const LOGO = 200;
const GOLD = '#d9c08b';

// "M" şeridinin orta çizgisi (1024'lük görsel koordinatlarında): sol ayak, sol köşegen, sağ köşegen, sağ ayak
const RIBBON = 'M 242 705 L 242 331 L 506 596 L 778 331 L 778 705';
const RIBBON_LEN = 1505;
const GLINT = 240;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const RING = 300; // halkanın çizildiği kare (logo bunun ortasında)

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

export function Intro({ onDone }: { onDone: () => void }) {
  const run = useRef(new Animated.Value(0)).current; // ışığın şerit üzerindeki konumu (0 → 1)
  const ring = useRef(new Animated.Value(0)).current; // halka ve yazı (0 → 1)
  const out = useRef(new Animated.Value(0)).current; // çıkış: 0 tam görünür → 1 kayboldu
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        const exit = Animated.timing(out, { toValue: 1, duration: reduce ? 250 : 520, easing: EASE, useNativeDriver: true });
        const seq = reduce
          ? exit
          : Animated.sequence([
              Animated.delay(150),
              Animated.parallel([
                Animated.timing(run, { toValue: 1, duration: 1450, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
                Animated.sequence([
                  Animated.delay(1050),
                  Animated.timing(ring, { toValue: 1, duration: 1000, easing: EASE, useNativeDriver: false }),
                ]),
              ]),
              Animated.delay(420),
              exit,
            ]);
        seq.start(() => alive && doneRef.current());
      });
    return () => { alive = false; };
  }, [run, ring, out]);

  // Işık şeridin başından sonuna kayar; iki katman (geniş-soluk + dar-parlak) yumuşak bir parıltı verir
  const offset = run.interpolate({ inputRange: [0, 1], outputRange: [GLINT, -RIBBON_LEN] });
  const glintOpacity = run.interpolate({ inputRange: [0, 0.08, 0.88, 1], outputRange: [0, 1, 1, 0] });
  // Halka logonun arkasından açılır ve söner
  const ringR = ring.interpolate({ inputRange: [0, 1], outputRange: [86, 146] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });
  // Yazı halkayla birlikte 8px yükselerek belirir ve çıkışa kadar kalır
  const wordOpacity = ring.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] });
  const wordRise = ring.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, s.root, { opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
      // İlk kare çizilince yerel açılış ekranı kaldırılır: ikisi aynı olduğu için geçiş görünmez
      onLayout={() => { SplashScreen.hideAsync().catch(() => {}); }}
      testID="intro"
    >
      <Animated.View style={[s.stage, { transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <ACircle cx={RING / 2} cy={RING / 2} r={ringR} stroke={GOLD} strokeWidth={1.5} fill="none" strokeOpacity={ringOpacity} />
        </Svg>
        <View style={{ width: LOGO, height: LOGO }}>
          <Image source={require('../assets/splash-icon.png')} style={{ width: LOGO, height: LOGO }} />
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: glintOpacity }]}>
            <Svg width={LOGO} height={LOGO} viewBox="0 0 1024 1024">
              <APath d={RIBBON} stroke="#fff3d6" strokeOpacity={0.16} strokeWidth={104} strokeLinecap="round" strokeLinejoin="round" fill="none"
                strokeDasharray={[GLINT, RIBBON_LEN + GLINT]} strokeDashoffset={offset} />
              <APath d={RIBBON} stroke="#fffaf0" strokeOpacity={0.28} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" fill="none"
                strokeDasharray={[GLINT * 0.6, RIBBON_LEN + GLINT]} strokeDashoffset={offset} />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
      <Animated.Text style={[s.word, { opacity: wordOpacity, transform: [{ translateY: wordRise }] }]}>Monibo</Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: SPLASH_BG, alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
  stage: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  // Yazı logonun altında, logo ekranın tam ortasında kalsın diye mutlak konumlu
  word: { position: 'absolute', top: '50%', marginTop: LOGO / 2 + 20, color: GOLD, fontFamily: FONTS.semi, fontSize: 20, letterSpacing: 6 },
});
