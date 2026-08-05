import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Pressable, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  colors, spacing, radius, fontSize, fontWeight,
  isValidNIF, isValidIBAN, calculateProfileQualityScore, SHIFT_CATEGORIES, ShiftCategory,
  STORED_WEEKDAYS,
} from '@turnos/shared';
import { authApi, ApiError } from '../lib/api';
import { useT } from '../lib/i18n';

const ALL_SKILLS = [...new Set(Object.values(SHIFT_CATEGORIES).flat())];
/** Wizard step ids — the visible name comes from the catalogue. */
const STEPS = ['identity', 'legal', 'availability', 'summary'] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, tSkill, tWeekday } = useT();
  const [step, setStep] = useState(0);

  // Form state
  const [fullName,     setFullName]     = useState('');
  const [nif,          setNif]          = useState('');
  const [iban,         setIban]         = useState('');
  const [ibanShareConsent, setIbanShareConsent] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedDays,   setSelectedDays]   = useState<string[]>([]);
  const [photoUri,    setPhotoUri]    = useState<string | null>(null);
  const [photoMime,   setPhotoMime]   = useState('image/jpeg');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  // CV is picked here but uploaded on submit, alongside the photo
  const [cvAsset, setCvAsset] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [externalMonthlyIncome, setExternalMonthlyIncome] = useState('');

  // Validation errors
  const [nifError,  setNifError]  = useState('');
  const [ibanError, setIbanError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const toggleSkill = useCallback((skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill],
    );
  }, []);

  const toggleDay = useCallback((day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  }, []);

  const pickCv = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 10 * 1024 * 1024) {
      Alert.alert(t('mobile.onboarding.cvTooBigTitle'), t('mobile.onboarding.cvTooBigBody'));
      return;
    }
    setCvAsset({
      uri: asset.uri,
      name: asset.name ?? 'cv.pdf',
      mimeType: asset.mimeType ?? 'application/pdf',
    });
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('mobile.onboarding.photoPermTitle'), t('mobile.onboarding.photoPermBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setPhotoMime(asset.mimeType ?? 'image/jpeg');
  };

  const qualityResult = calculateProfileQualityScore({
    hasPhoto:        !!photoUri,
    hasValidNif:     isValidNIF(nif),
    hasValidIban:    isValidIBAN(iban),
    skillsCount:     selectedSkills.length,
    hasFullName:     fullName.trim().length > 0,
    hasAvailability: selectedDays.length > 0,
    hasCv:           !!cvAsset,
  });

  const validateStep = (): boolean => {
    if (step === 0 && !fullName.trim()) {
      Alert.alert(t('mobile.onboarding.nameRequiredTitle'), t('mobile.onboarding.nameRequiredBody'));
      return false;
    }
    if (step === 1) {
      let ok = true;
      // Only validate if the worker has entered something — both are optional
      if (nif.trim() && !isValidNIF(nif)) { setNifError(t('mobile.onboarding.nifInvalid')); ok = false; }
      else setNifError('');
      if (iban.trim() && !isValidIBAN(iban)) { setIbanError(t('mobile.onboarding.ibanInvalid')); ok = false; }
      else setIbanError('');
      return ok;
    }
    if (step === 2 && selectedSkills.length === 0) {
      Alert.alert(t('mobile.onboarding.skillsRequiredTitle'), t('mobile.onboarding.skillsRequiredBody'));
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Upload photo first if selected
      if (photoUri) {
        setIsUploadingPhoto(true);
        try {
          await authApi.uploadWorkerPhoto(photoUri, photoMime);
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : t('mobile.onboarding.photoUploadError');
          Alert.alert(t('mobile.onboarding.warningTitle'), t('mobile.onboarding.photoSkipped', { message: msg }));
        } finally {
          setIsUploadingPhoto(false);
        }
      }

      // CV upload — best-effort, same treatment as the photo
      if (cvAsset) {
        try {
          await authApi.uploadWorkerCv(cvAsset.uri, cvAsset.mimeType, cvAsset.name);
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : t('mobile.onboarding.cvUploadError');
          Alert.alert(t('mobile.onboarding.warningTitle'), t('mobile.onboarding.cvSkipped', { message: msg }));
        }
      }

      await authApi.updateWorkerProfile({
        fullName,
        nif,
        iban,
        ibanShareConsent: iban.trim() ? ibanShareConsent : false,
        skills: selectedSkills,
        availableDays: selectedDays,
        declaredExternalMonthlyIncome: externalMonthlyIncome
          ? parseFloat(externalMonthlyIncome)
          : 0,
      });

      router.replace('/');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('mobile.onboarding.submitError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <LinearGradient colors={['#6a79ff', '#9b6dff']} style={s.header}>
        {step > 0 && (
          <TouchableOpacity style={s.backBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
        )}
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{t('mobile.onboarding.title')}</Text>
          <Text style={s.headerSub}>
            {t('mobile.onboarding.stepOf', {
              current: step + 1,
              total: STEPS.length,
              name: t(`mobile.onboarding.steps.${STEPS[step]}`),
            })}
          </Text>
        </View>
        {/* Skip for now */}
        <TouchableOpacity onPress={() => router.replace('/')} style={s.skipBtn}>
          <Text style={s.skipText}>{t('mobile.onboarding.skip')}</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` as any }]} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Step 0: Identity ── */}
        {step === 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('mobile.onboarding.nameTitle')}</Text>
            <Text style={s.sectionSub}>{t('mobile.onboarding.nameSub')}</Text>
            <TextInput
              style={s.input}
              placeholder={t('mobile.onboarding.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
            />

            {/* Photo picker */}
            <Text style={[s.sectionTitle, { marginTop: 24, fontSize: 16 }]}>{t('mobile.onboarding.photoTitle')}</Text>
            <Text style={s.sectionSub}>{t('mobile.onboarding.photoSub')}</Text>
            <TouchableOpacity style={s.photoBtn} onPress={pickPhoto} activeOpacity={0.8}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={s.photoPreview} />
              ) : (
                <View style={s.photoPlaceholder}>
                  <Text style={s.photoPlaceholderIcon}>📷</Text>
                  <Text style={s.photoPlaceholderText}>{t('mobile.onboarding.photoAdd')}</Text>
                </View>
              )}
            </TouchableOpacity>
            {photoUri && (
              <TouchableOpacity onPress={() => setPhotoUri(null)} style={s.photoRemove}>
                <Text style={s.photoRemoveText}>{t('mobile.onboarding.photoRemove')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Step 1: Legal (NIF + IBAN) ── */}
        {step === 1 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('mobile.onboarding.legalTitle')}</Text>
            <Text style={s.sectionSub}>{t('mobile.onboarding.legalSub')}</Text>

            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>NIF <Text style={s.optLabel}>{t('common.optional')}</Text></Text>
              <TextInput
                style={[s.input, nifError ? s.inputError : {}]}
                placeholder="123 456 789"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                value={nif}
                onChangeText={v => { setNif(v.replace(/\D/g, '').slice(0, 9)); setNifError(''); }}
                maxLength={9}
              />
              {nifError ? <Text style={s.errorText}>{nifError}</Text> : null}
              {!nifError && nif.length === 9 && isValidNIF(nif) && (
                <Text style={s.validText}>{t('mobile.onboarding.nifValid')}</Text>
              )}
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>IBAN <Text style={s.optLabel}>{t('common.optional')}</Text></Text>
              <TextInput
                style={[s.input, ibanError ? s.inputError : {}]}
                placeholder="PT50 0000 0000 0000 0000 0000 0"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                value={iban}
                onChangeText={v => { setIban(v.toUpperCase()); setIbanError(''); }}
                maxLength={25}
              />
              {ibanError ? <Text style={s.errorText}>{ibanError}</Text> : null}
              {!ibanError && iban.length === 25 && isValidIBAN(iban) && (
                <Text style={s.validText}>{t('mobile.onboarding.ibanValid')}</Text>
              )}
              <Text style={s.fieldHint}>{t('mobile.onboarding.ibanHint')}</Text>

              {/* ── IBAN sharing consent (GDPR) ── */}
              {iban.trim().length > 0 && (
                <>
                  <TouchableOpacity
                    style={s.consentRow}
                    onPress={() => setIbanShareConsent(v => !v)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.checkbox, ibanShareConsent && s.checkboxOn]}>
                      {ibanShareConsent && <Text style={s.checkboxTick}>✓</Text>}
                    </View>
                    <Text style={s.consentText}>{t('mobile.onboarding.ibanConsent')}</Text>
                  </TouchableOpacity>
                  {!ibanShareConsent && (
                    <Text style={s.consentWarn}>{t('mobile.onboarding.ibanConsentWarn')}</Text>
                  )}
                </>
              )}
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>{t('mobile.onboarding.incomeLabel')}</Text>
              <TextInput
                style={s.input}
                placeholder={t('mobile.onboarding.incomePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={externalMonthlyIncome}
                onChangeText={v => setExternalMonthlyIncome(v.replace(/[^0-9.]/g, ''))}
              />
              <View style={s.infoBox}>
                <Text style={s.infoBoxText}>{t('mobile.onboarding.incomeInfo')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Step 2: Skills + Availability ── */}
        {step === 2 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('mobile.onboarding.skillsTitle')}</Text>
            <Text style={s.sectionSub}>{t('mobile.onboarding.skillsSub')}</Text>
            <View style={s.chips}>
              {ALL_SKILLS.map(skill => (
                <Pressable
                  key={skill}
                  style={[s.chip, selectedSkills.includes(skill) && s.chipActive]}
                  onPress={() => toggleSkill(skill)}
                >
                  {/* Display only — the stored PT title is what gets submitted */}
                  <Text style={[s.chipText, selectedSkills.includes(skill) && s.chipTextActive]}>
                    {tSkill(skill)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[s.sectionTitle, { marginTop: 28 }]}>{t('mobile.onboarding.availabilityTitle')}</Text>
            <Text style={s.sectionSub}>{t('mobile.onboarding.availabilitySub')}</Text>
            <View style={s.daysRow}>
              {STORED_WEEKDAYS.map(day => (
                <Pressable
                  key={day}
                  style={[s.dayBtn, selectedDays.includes(day) && s.dayBtnActive]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[s.dayText, selectedDays.includes(day) && s.dayTextActive]}>{tWeekday(day)}</Text>
                </Pressable>
              ))}
            </View>

            {/* CV — optional, worth 10 points */}
            <Text style={[s.sectionTitle, { marginTop: 28 }]}>{t('mobile.onboarding.cvTitle')}</Text>
            <Text style={s.sectionSub}>{t('mobile.onboarding.cvSub')}</Text>
            <Pressable style={s.cvBtn} onPress={pickCv}>
              <Text style={s.cvBtnText}>
                {cvAsset ? `📄 ${cvAsset.name}` : t('mobile.onboarding.cvPick')}
              </Text>
            </Pressable>
            {cvAsset && (
              <Pressable onPress={() => setCvAsset(null)}>
                <Text style={s.cvRemoveText}>{t('mobile.onboarding.cvRemove')}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* ── Step 3: Summary + Score ── */}
        {step === 3 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('mobile.onboarding.summaryTitle')}</Text>
            <Text style={s.sectionSub}>{t('mobile.onboarding.summarySub')}</Text>

            {/* Score widget */}
            <View style={s.scoreCard}>
              <View style={s.scoreCircle}>
                <Text style={s.scoreValue}>{qualityResult.score}</Text>
                <Text style={s.scoreLabel}>/ 100</Text>
              </View>
              <View style={s.scoreInfo}>
                <Text style={s.scoreTitle}>{t('mobile.onboarding.scoreTitle')}</Text>
                <Text style={s.scoreStatus}>
                  {qualityResult.status === 'PENDING_REVIEW'
                    ? t('mobile.onboarding.scoreReady')
                    : t('mobile.onboarding.scoreIncomplete')}
                </Text>
                {qualityResult.score >= 80 ? (
                  <Text style={s.scoreNote}>{t('mobile.onboarding.scoreNote')}</Text>
                ) : (
                  <Text style={s.scoreNoteMissing}>
                    {t('mobile.onboarding.scoreMissing', {
                      items: qualityResult.missingKeys
                        .map(k => t(`mobile.onboarding.missing.${k}`))
                        .join(', '),
                    })}
                  </Text>
                )}
              </View>
            </View>

            {/* Score bar */}
            <View style={s.scoreBarTrack}>
              <LinearGradient
                colors={qualityResult.score >= 80 ? ['#22c55e', '#16a34a'] : ['#6a79ff', '#9b6dff']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.scoreBarFill, { width: `${qualityResult.score}%` as any }]}
              />
            </View>

            {/* Profile summary */}
            {[
              [t('mobile.onboarding.summaryName'), fullName],
              ['NIF', nif],
              ['IBAN', iban ? `${iban.slice(0, 8)}...${iban.slice(-4)}` : ''],
              [t('mobile.onboarding.summarySkills'), selectedSkills.slice(0, 3).map(tSkill).join(', ') + (selectedSkills.length > 3 ? ` +${selectedSkills.length - 3}` : '')],
              [t('mobile.onboarding.summaryAvailability'), selectedDays.map(tWeekday).join(', ')],
              [t('mobile.onboarding.summaryCv'), cvAsset?.name ?? ''],
            ].map(([k, v]) => v ? (
              <View key={k} style={s.summaryRow}>
                <Text style={s.summaryKey}>{k}</Text>
                <Text style={s.summaryVal}>{v}</Text>
              </View>
            ) : null)}

            <View style={s.recebeBadge}>
              <Text style={s.recebeText}>{t('mobile.onboarding.payNote')}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      <View style={s.footer}>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            <LinearGradient colors={['#6a79ff', '#9b6dff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.nextBtnGradient}>
              <Text style={s.nextBtnText}>{t('mobile.onboarding.continue')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.nextBtn, isLoading && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={qualityResult.score >= 80 ? ['#22c55e', '#16a34a'] : ['#6a79ff', '#9b6dff']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.nextBtnGradient}
            >
              <Text style={s.nextBtnText}>
                {isUploadingPhoto
                  ? t('mobile.onboarding.uploadingPhoto')
                  : isLoading
                  ? t('mobile.onboarding.submitting')
                  : qualityResult.score >= 80
                  ? t('mobile.onboarding.submitReady')
                  : t('mobile.onboarding.submitLater')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },

  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 16,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 16, color: '#fff', fontWeight: fontWeight.bold },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.extrabold, color: '#fff' },
  headerSub: { fontSize: fontSize.caption, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  skipBtn: { padding: 8 },
  skipText: { fontSize: fontSize.caption, color: 'rgba(255,255,255,0.7)', fontWeight: fontWeight.semibold },

  progressTrack: { height: 3, backgroundColor: colors.neutral },
  progressFill: { height: '100%', backgroundColor: colors.primary },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xl, paddingBottom: 40 },

  section: { gap: spacing.md },
  sectionTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  sectionSub: { fontSize: fontSize.body, color: colors.textSecondary, lineHeight: 22, marginTop: -6 },

  input: {
    height: 52, backgroundColor: colors.white,
    borderWidth: 1.5, borderColor: colors.neutral,
    borderRadius: radius.sm, paddingHorizontal: spacing.md,
    fontSize: fontSize.body, color: colors.textPrimary,
  },
  inputError: { borderColor: colors.error },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.textPrimary },
  req: { color: colors.error },
  optLabel: { fontWeight: fontWeight.regular as any, color: colors.textSecondary, fontSize: 12 },
  fieldHint: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 18 },
  errorText: { fontSize: fontSize.caption, color: colors.error, fontWeight: fontWeight.semibold },
  validText: { fontSize: fontSize.caption, color: colors.success, fontWeight: fontWeight.bold },

  // IBAN sharing consent
  consentRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10,
    padding: 12, borderRadius: radius.sm,
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: '#d7dcff',
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', marginTop: 1,
  },
  checkboxOn:   { backgroundColor: colors.primary },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: fontWeight.bold as any, lineHeight: 16 },
  consentText:  { flex: 1, fontSize: fontSize.caption, color: colors.textPrimary, lineHeight: 17 },
  consentWarn:  { fontSize: fontSize.caption, color: '#b45309', marginTop: 6, lineHeight: 16 },

  infoCard: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.primaryLight, borderRadius: radius.sm, padding: spacing.md,
    borderWidth: 1, borderColor: 'rgba(106,121,255,0.2)',
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: fontSize.caption, color: colors.primary, fontWeight: fontWeight.semibold, lineHeight: 18 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.neutral,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  chipTextActive: { color: '#fff' },

  daysRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },

  cvBtn: {
    height: 48, borderRadius: radius.md, marginTop: spacing.sm,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
    backgroundColor: '#f5f6ff', alignItems: 'center', justifyContent: 'center',
  },
  cvBtnText: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.primary },
  cvRemoveText: {
    fontSize: fontSize.caption, fontWeight: fontWeight.bold as any,
    color: '#dc2626', marginTop: 8, textAlign: 'center',
  },
  dayBtn: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: colors.neutral,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: 12, fontWeight: fontWeight.bold, color: colors.textSecondary },
  dayTextActive: { color: '#fff' },

  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.neutral,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  scoreCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: colors.primary, flexShrink: 0,
  },
  scoreValue: { fontSize: fontSize.h2, fontWeight: fontWeight.extrabold, color: colors.primary, lineHeight: 28 },
  scoreLabel: { fontSize: 10, color: colors.primary, fontWeight: fontWeight.semibold },
  scoreInfo: { flex: 1, gap: 3 },
  scoreTitle: { fontSize: 14, fontWeight: fontWeight.bold, color: colors.textPrimary },
  scoreStatus: { fontSize: 13, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  scoreNote: { fontSize: fontSize.caption, color: colors.success, fontWeight: fontWeight.semibold, lineHeight: 17 },
  scoreNoteMissing: { fontSize: fontSize.caption, color: colors.warning, fontWeight: fontWeight.semibold, lineHeight: 17 },
  scoreBarTrack: { height: 8, backgroundColor: colors.neutral, borderRadius: radius.full, overflow: 'hidden', marginTop: 4 },
  scoreBarFill: { height: '100%', borderRadius: radius.full },

  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.neutral, gap: 12,
  },
  summaryKey: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.textSecondary, flexShrink: 0 },
  summaryVal: { fontSize: 13, color: colors.textPrimary, fontWeight: fontWeight.semibold, textAlign: 'right', flex: 1 },

  recebeBadge: {
    marginTop: 8, backgroundColor: colors.primaryLight, borderRadius: radius.sm,
    padding: spacing.md, borderWidth: 1, borderColor: 'rgba(106,121,255,0.2)',
  },
  recebeText: { fontSize: 13, color: colors.primary, fontWeight: fontWeight.semibold, lineHeight: 19 },

  footer: { padding: spacing.md, paddingBottom: Platform.OS === 'ios' ? 36 : spacing.md, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.neutral },
  nextBtn: { borderRadius: radius.full, overflow: 'hidden', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  nextBtnGradient: { height: 54, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { fontSize: fontSize.body, fontWeight: fontWeight.bold, color: '#fff' },
  btnDisabled: { opacity: 0.65, shadowOpacity: 0 },

  // Photo picker
  photoBtn: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.neutral,
    marginTop: 8,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderIcon: { fontSize: 32 },
  photoPlaceholderText: {
    fontSize: fontSize.caption,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  photoRemove: {
    alignSelf: 'center',
    marginTop: 8,
    padding: 4,
  },
  photoRemoveText: {
    fontSize: fontSize.caption,
    color: colors.error,
    fontWeight: fontWeight.semibold,
  },
  infoBox: {
    marginTop: 10,
    backgroundColor: '#eff6ff',
    borderRadius: radius.sm,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  infoBoxText: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
});
