import { useRef, useState, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, ScrollView, Pressable,
  useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { tokenStorage } from '../lib/storage';
import { useT } from '../lib/i18n';

/**
 * First-run introduction — five slides, shown once after the OTP and before
 * the profile wizard.
 *
 * Every claim on these slides is checked against the product:
 *   · check-in only, no check-out scan (ADR 008)
 *   · Turnos never holds or pays wages, so there is no payment-timing promise
 *   · reputation really does drive notification order (favourites → TOP_RATED)
 * If you edit the copy, edit `mobile.intro` in BOTH catalogues and keep it true.
 *
 * Artwork is the ad-campaign motif library, copied into assets/onboarding/ —
 * `docs/` is excluded by .easignore, so referencing it from there would build
 * an APK with no images. Same motifs as the ads people clicked to get here.
 *
 * Paging is a plain horizontal ScrollView; no carousel dependency is needed
 * for five slides.
 */

const SLIDES = [
  { key: 'slide1', image: require('../assets/onboarding/pin.png') },
  { key: 'slide2', image: require('../assets/onboarding/phone.png') },
  { key: 'slide3', image: require('../assets/onboarding/calendar.png') },
  { key: 'slide4', image: require('../assets/onboarding/qr.png') },
  { key: 'slide5', image: require('../assets/onboarding/star.png') },
] as const;

export default function IntroScreen() {
  const router = useRouter();
  const { t } = useT();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  // Home by default — the existing product decision is that new workers browse
  // first and meet the profile gate when they apply. `next` lets the re-open
  // link from the profile screen return where it came from.
  const { next } = useLocalSearchParams<{ next?: string }>();
  const destination = (next as string) || '/';

  const finish = useCallback(async () => {
    await tokenStorage.markIntroSeen();
    router.replace(destination as never);
  }, [router, destination]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(prev => (prev === i ? prev : i));
  }, [width]);

  const goNext = useCallback(() => {
    if (index >= SLIDES.length - 1) { void finish(); return; }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  }, [index, width, finish]);

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {SLIDES.map(slide => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <View style={styles.imageWrap}>
              <Image source={slide.image} style={styles.image} resizeMode="contain" />
            </View>
            <Text style={styles.title}>{t(`mobile.intro.${slide.key}Title`)}</Text>
            <Text style={styles.body}>{t(`mobile.intro.${slide.key}Body`)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>

        <Pressable onPress={finish} hitSlop={12} style={styles.skipHit}>
          <Text style={styles.skip}>{t('mobile.intro.skip')}</Text>
        </Pressable>

        <Pressable
          onPress={goNext}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>
            {isLast ? t('mobile.intro.start') : t('mobile.intro.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.secondary },
  pager: { flex: 1 },
  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  imageWrap: {
    width: 200, height: 200, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primaryLight, borderRadius: radius.full,
    marginBottom: spacing.xl,
  },
  image: { width: 110, height: 110 },
  title: {
    fontSize: fontSize.h1, fontWeight: fontWeight.extrabold,
    color: colors.textPrimary, textAlign: 'center', lineHeight: 36,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: fontSize.body, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 24, maxWidth: 340,
  },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: {
    width: 8, height: 8, borderRadius: radius.full,
    backgroundColor: colors.neutral,
  },
  dotActive: { backgroundColor: colors.primary, width: 22 },
  skipHit: { alignSelf: 'center' },
  skip: {
    fontSize: fontSize.body, fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  cta: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  ctaPressed: { backgroundColor: colors.primaryDark },
  ctaText: {
    color: colors.white, fontSize: fontSize.body, fontWeight: fontWeight.bold,
  },
});
