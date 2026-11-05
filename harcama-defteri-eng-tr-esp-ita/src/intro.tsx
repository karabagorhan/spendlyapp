import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';

/**
 * Açılış animasyonu. Yerel açılış ekranıyla aynı kareden başlar (aynı zemin, aynı boyutta "M"), böylece geçiş görünmez;
 * sonra "M" şeridinin üzerinden bir ışık geçer, logo hafifçe büyürken katman sönerek uygulamayı açar.
 * Hareketi azalt açıksa ışık atlanır, yalnızca kısa bir solma kalır.
 */

/** Açılış ekranının zemini ve logo boyutu: app.json'daki expo-splash-screen ayarıyla aynı olmalı. */
export const SPLASH_BG = '#0B0D0F';
const LOGO = 200;

// "M" şeridinin orta çizgisi (1024'lük görsel koordinatlarında): sol ayak, sol köşegen, sağ köşegen, sağ ayak
const RIBBON = 'M 242 705 L 242 331 L 506 596 L 778 331 L 778 705';
const RIBBON_LEN = 1505;
const GLINT = 220;
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

const APath = Animated.createAnimatedComponent(Path);

export function Intro({ onDone }: { onDone: () => void }) {
  const run = useRef(new Animated.Value(0)).current; // ışığın şerit üzerindeki konumu (0 → 1)
  const out = useRef(new Animated.Value(0)).current; // çıkış: 0 tam görünür → 1 kayboldu
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        const exit = Animated.timing(out, { toValue: 1, duration: reduce ? 250 : 420, easing: EASE, useNativeDriver: true });
        const seq = reduce
          ? exit
          : Animated.sequence([
              Animated.delay(120),
              Animated.timing(run, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
              exit,
            ]);
        seq.start(() => alive && doneRef.current());
      });
    return () => { alive = false; };
  }, [run, out]);

  // Işık şeridin başından sonuna kayar; iki katman (geniş-soluk + dar-parlak) yumuşak bir parıltı verir
  const offset = run.interpolate({ inputRange: [0, 1], outputRange: [GLINT, -RIBBON_LEN] });
  const glintOpacity = run.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });

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
      <Animated.View style={{ width: LOGO, height: LOGO, transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
        <Image source={require('../assets/splash-icon.png')} style={{ width: LOGO, height: LOGO }} />
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: glintOpacity }]}>
          <Svg width={LOGO} height={LOGO} viewBox="0 0 1024 1024">
            <APath d={RIBBON} stroke="#fff3d6" strokeOpacity={0.16} strokeWidth={104} strokeLinecap="round" strokeLinejoin="round" fill="none"
              strokeDasharray={[GLINT, RIBBON_LEN + GLINT]} strokeDashoffset={offset} />
            <APath d={RIBBON} stroke="#fffaf0" strokeOpacity={0.28} strokeWidth={44} strokeLinecap="round" strokeLinejoin="round" fill="none"
              strokeDasharray={[GLINT * 0.6, RIBBON_LEN + GLINT]} strokeDashoffset={offset} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: SPLASH_BG, alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
});
