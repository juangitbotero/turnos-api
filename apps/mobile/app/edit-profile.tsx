import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Image, Switch, Modal, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  colors, spacing, radius, fontSize, fontWeight, SHIFT_CATEGORIES, ShiftCategory,
  LANGUAGES, isValidIBAN, isValidNIF, STORED_WEEKDAYS,
  JOB_TITLES, EXPERIENCE_LEVELS, ExperienceLevel, WorkerExperience,
} from '@turnos/shared';
import { authApi, ApiError } from '../lib/api';
import { tokenStorage } from '../lib/storage';
import { useT } from '../lib/i18n';

const SKILL_CATEGORIES = Object.keys(SHIFT_CATEGORIES) as ShiftCategory[];

// Category icons map
const CATEGORY_ICONS: Record<string, string> = {
  'Restauração':   'restaurant-outline',
  'Hotelaria':     'bed-outline',
  'Eventos':       'star-outline',
  'Vendas':        'pricetag-outline',
  'Apoio ao Cliente': 'headset-outline',
  'Logística':     'cube-outline',
  'Administração': 'briefcase-outline',
  'Limpeza e Segurança': 'sparkles-outline',
} as const;

// Collapsible category accordion for skills
function SkillCategoryAccordion({
  category, skills, selected, onToggle,
}: {
  category: ShiftCategory;
  skills: readonly string[];
  selected: string[];
  onToggle: (sk: string) => void;
}) {
  const { tCategory, tSkill } = useT();
  const [open, setOpen] = useState(false);
  const activeInCategory = skills.filter(sk => selected.includes(sk)).length;

  return (
    <View style={acc.wrapper}>
      <TouchableOpacity
        style={acc.header}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.7}
      >
        <Ionicons name={(CATEGORY_ICONS[category] ?? 'grid-outline') as any} size={16} color={colors.primary} />
        <Text style={acc.headerText}>{tCategory(category)}</Text>
        {activeInCategory > 0 && (
          <View style={acc.countBadge}>
            <Text style={acc.countText}>{activeInCategory}</Text>
          </View>
        )}
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
          style={{ marginLeft: 'auto' }}
        />
      </TouchableOpacity>

      {open && (
        <View style={acc.body}>
          <View style={acc.chips}>
            {skills.map(sk => {
              const active = selected.includes(sk);
              return (
                <TouchableOpacity
                  key={sk}
                  style={[acc.chip, active && acc.chipActive]}
                  onPress={() => onToggle(sk)}
                  activeOpacity={0.8}
                >
                  {/* Display only — `sk` stays the stored PT value on toggle */}
                  <Text style={[acc.chipText, active && acc.chipTextActive]}>{tSkill(sk)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const acc = StyleSheet.create({
  wrapper: {
    borderWidth: 1, borderColor: colors.neutral, borderRadius: radius.md, overflow: 'hidden',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: '#fff',
  },
  headerText: { fontSize: fontSize.body, fontWeight: fontWeight.semibold as any, color: colors.textPrimary, flex: 1 },
  countBadge: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  countText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.bold as any },
  body: { backgroundColor: '#fafbff', padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.neutral },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: colors.secondary, borderWidth: 1.5, borderColor: colors.neutral,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold as any, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
});

/**
 * Two-step picker: choose the job title, then how long you've worked it.
 * Titles come from the shared JOB_TITLES list, so a declared experience always
 * matches the exact string employers post shifts with.
 */
function ExperiencePicker({
  visible, existing, onCancel, onPick,
}: {
  visible: boolean;
  existing: WorkerExperience[];
  onCancel: () => void;
  onPick: (jobTitle: string, level: ExperienceLevel) => void;
}) {
  const { t, tSkill } = useT();
  const [chosenTitle, setChosenTitle] = useState<string | null>(null);

  // Reset to step 1 whenever the modal reopens
  useEffect(() => { if (visible) setChosenTitle(null); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={ep.overlay}>
        <View style={ep.sheet}>
          <View style={ep.head}>
            {chosenTitle ? (
              <TouchableOpacity onPress={() => setChosenTitle(null)} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : <View style={{ width: 22 }} />}
            <Text style={ep.title}>
              {chosenTitle
                ? t('mobile.editProfile.experiencePickYears')
                : t('mobile.editProfile.experiencePickJob')}
            </Text>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {chosenTitle && <Text style={ep.chosen}>{tSkill(chosenTitle)}</Text>}

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {chosenTitle ? (
              (Object.keys(EXPERIENCE_LEVELS) as ExperienceLevel[]).map(level => (
                <TouchableOpacity
                  key={level}
                  style={ep.row}
                  onPress={() => onPick(chosenTitle, level)}
                  activeOpacity={0.75}
                >
                  <Text style={ep.rowText}>{t(`domain.experienceLevels.${level}`)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ))
            ) : (
              JOB_TITLES.map(title => {
                const already = existing.find(e => e.jobTitle === title);
                return (
                  <TouchableOpacity
                    key={title}
                    style={ep.row}
                    onPress={() => setChosenTitle(title)}
                    activeOpacity={0.75}
                  >
                    <Text style={ep.rowText}>{tSkill(title)}</Text>
                    {already
                      ? <Text style={ep.already}>{t(`domain.experienceLevelsShort.${already.level}`)}</Text>
                      : <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const ep = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingBottom: 32, paddingHorizontal: spacing.md, paddingTop: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontSize: fontSize.h3, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  chosen: {
    fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.primary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.neutral, gap: 10,
  },
  rowText: { fontSize: fontSize.body, color: colors.textPrimary, fontWeight: fontWeight.semibold as any, flex: 1 },
  already: { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: colors.primary },
});

export default function EditProfileScreen() {
  const router = useRouter();
  const { t, tSkill, tWorkerLanguage, tWeekday } = useT();

  const [fullName, setFullName]           = useState('');
  const [bio, setBio]                     = useState('');
  const [skills, setSkills]               = useState<string[]>([]);
  const [languages, setLanguages]         = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [isAvailableForWork, setIsAvailableForWork] = useState(true);
  const [experiences, setExperiences]     = useState<WorkerExperience[]>([]);
  const [expPickerOpen, setExpPickerOpen] = useState(false);
  const [cvUrl, setCvUrl]                 = useState<string | null>(null);
  const [cvFileName, setCvFileName]       = useState<string | null>(null);
  const [uploadingCv, setUploadingCv]     = useState(false);
  const [nif, setNif]                     = useState('');
  const [nifError, setNifError]           = useState('');
  const [iban, setIban]                   = useState('');
  const [ibanError, setIbanError]         = useState('');
  const [ibanShareConsent, setIbanShareConsent] = useState(false);
  const [contactEmail, setContactEmail]   = useState('');
  const [photoUrl, setPhotoUrl]           = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      // Normalise to NFC to prevent é/è encoding mismatches from the DB
      // causing includes() to silently fail and create duplicates.
      const normalise = (arr: string[]) =>
        [...new Set(arr.map(s => s.normalize('NFC')))];

      setFullName(data.fullName ?? '');
      setBio((data as any).bio ?? '');
      setSkills(normalise(data.skills ?? []));
      setLanguages(normalise((data as any).languages ?? []));
      setAvailableDays(normalise(data.availableDays ?? []));
      setIsAvailableForWork(data.isAvailableForWork ?? true);
      setExperiences(data.experiences ?? []);
      setCvUrl(data.cvUrl ?? null);
      setCvFileName(data.cvFileName ?? null);
      setNif(data.nif ?? '');
      setIban(data.iban ?? '');
      setIbanShareConsent(!!(data as any).ibanShareConsent);
      setContactEmail((data as any).contactEmail ?? '');
      setPhotoUrl(data.photoUrl ?? null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await tokenStorage.clear();
        Alert.alert(
          t('common.sessionExpired'),
          t('common.sessionExpiredBody'),
          [{ text: t('common.signIn'), onPress: () => router.replace('/login') }],
        );
        return;
      }
      Alert.alert(t('common.error'), t('mobile.profile.loadError'));
    } finally {
      setLoading(false);
    }
  }, [router, t]);

  useEffect(() => { load(); }, [load]);

  const toggleSkill = (sk: string) => {
    const n = sk.normalize('NFC');
    setSkills(prev => prev.includes(n) ? prev.filter(s => s !== n) : [...prev, n]);
  };

  const toggleLanguage = (lang: string) => {
    const n = lang.normalize('NFC');
    setLanguages(prev => prev.includes(n) ? prev.filter(l => l !== n) : [...prev, n]);
  };

  const toggleDay = (d: string) =>
    setAvailableDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('mobile.editProfile.photoPermTitle'), t('mobile.editProfile.photoPermBody'));
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
    const ext   = asset.uri.split('.').pop() ?? 'jpg';
    const mime  = ext === 'png' ? 'image/png' : 'image/jpeg';

    setUploadingPhoto(true);
    try {
      const { photoUrl: newUrl } = await authApi.uploadWorkerPhoto(asset.uri, mime);
      setPhotoUrl(newUrl);
      Alert.alert(t('mobile.editProfile.photoSavedTitle'), t('mobile.editProfile.photoSavedBody'));
    } catch {
      Alert.alert(t('common.error'), t('mobile.editProfile.photoFailed'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── CV ──────────────────────────────────────────────────────────────────────
  const handlePickCv = async () => {
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
      Alert.alert(t('mobile.editProfile.cvTooBigTitle'), t('mobile.editProfile.cvTooBigBody'));
      return;
    }

    setUploadingCv(true);
    try {
      const res = await authApi.uploadWorkerCv(
        asset.uri,
        asset.mimeType ?? 'application/pdf',
        asset.name ?? 'cv.pdf',
      );
      setCvUrl(res.cvUrl);
      setCvFileName(res.cvFileName);
      Alert.alert(
        t('mobile.editProfile.cvDoneTitle'),
        t('mobile.editProfile.cvDoneBody', { score: res.profileQualityScore }),
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('mobile.editProfile.cvFailed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setUploadingCv(false);
    }
  };

  const handleRemoveCv = () => {
    Alert.alert(t('mobile.editProfile.cvRemoveTitle'), t('mobile.editProfile.cvRemoveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'), style: 'destructive',
        onPress: async () => {
          try {
            await authApi.deleteWorkerCv();
            setCvUrl(null);
            setCvFileName(null);
          } catch {
            Alert.alert(t('common.error'), t('mobile.editProfile.cvRemoveFailed'));
          }
        },
      },
    ]);
  };

  // ── Experiences ─────────────────────────────────────────────────────────────
  const addExperience = (jobTitle: string, level: ExperienceLevel) => {
    setExperiences(prev => [
      ...prev.filter(e => e.jobTitle !== jobTitle),
      { jobTitle, level },
    ]);
    setExpPickerOpen(false);
  };

  const removeExperience = (jobTitle: string) =>
    setExperiences(prev => prev.filter(e => e.jobTitle !== jobTitle));

  const ibanClean = iban.replace(/\s/g, '').toUpperCase();

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert(t('mobile.editProfile.nameRequiredTitle'), t('mobile.editProfile.nameRequiredBody'));
      return;
    }
    setSaving(true);
    try {
      // Validate NIF if provided
      const nifClean = nif.replace(/\D/g, '').slice(0, 9);
      if (nifClean && !isValidNIF(nifClean)) {
        setNifError(t('mobile.editProfile.nifInvalid'));
        setSaving(false);
        return;
      }
      setNifError('');

      // Validate IBAN if provided
      if (ibanClean && !isValidIBAN(ibanClean)) {
        setIbanError(t('mobile.editProfile.ibanInvalid'));
        setSaving(false);
        return;
      }
      setIbanError('');

      await authApi.updateWorkerPartial({
        fullName: fullName.trim(),
        bio: bio.trim(),
        skills,
        languages,
        availableDays,
        isAvailableForWork,
        experiences,
        nif: nifClean || undefined,
        iban: ibanClean || undefined,
        contactEmail: contactEmail.trim() || undefined,
        // Only meaningful with an IBAN on file; withdrawing it clears the consent
        ibanShareConsent: ibanClean ? ibanShareConsent : false,
      });
      Alert.alert(t('mobile.editProfile.savedTitle'), t('mobile.editProfile.savedBody'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('mobile.editProfile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <LinearGradient colors={['#6a79ff', '#9b6dff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('mobile.editProfile.title')}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={s.saveBtn}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveBtnText}>{t('common.save')}</Text>
          }
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Photo ── */}
        <View style={s.photoSection}>
          <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto} activeOpacity={0.85}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitial}>
                  {(fullName?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            <View style={s.cameraOverlay}>
              {uploadingPhoto
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="camera" size={18} color="#fff" />
              }
            </View>
          </TouchableOpacity>
          <Text style={s.photoHint}>{t('mobile.editProfile.photoHint')}</Text>
        </View>

        {/* ── Name ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="person-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>{t('mobile.editProfile.nameTitle')}</Text>
          </View>
          <TextInput
            style={s.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder={t('mobile.editProfile.namePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* ── Bio / Introdução ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>{t('mobile.editProfile.bioTitle')}</Text>
          </View>
          <Text style={s.cardSub}>{t('mobile.editProfile.bioSub')}</Text>
          <TextInput
            style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
            value={bio}
            onChangeText={text => setBio(text.slice(0, 200))}
            placeholder={t('mobile.editProfile.bioPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={200}
          />
          <Text style={s.chipCount}>{bio.length}/200</Text>
        </View>

        {/* ── CV ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="document-text-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>{t('mobile.editProfile.cvTitle')}</Text>
          </View>
          <Text style={s.cardSub}>{t('mobile.editProfile.cvSub')}</Text>

          {cvUrl ? (
            <View style={s.cvRow}>
              <View style={s.cvInfo}>
                <Ionicons name="document-attach" size={20} color="#16a34a" />
                <Text style={s.cvName} numberOfLines={1}>{cvFileName ?? t('mobile.editProfile.cvFallback')}</Text>
              </View>
              <View style={s.cvActions}>
                <TouchableOpacity onPress={() => Linking.openURL(cvUrl)} activeOpacity={0.7}>
                  <Text style={s.cvView}>{t('mobile.editProfile.cvView')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePickCv} disabled={uploadingCv} activeOpacity={0.7}>
                  <Text style={s.cvReplace}>{uploadingCv ? '...' : t('mobile.editProfile.cvReplace')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRemoveCv} activeOpacity={0.7}>
                  <Text style={s.cvRemove}>{t('common.remove')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={s.cvUploadBtn}
              onPress={handlePickCv}
              disabled={uploadingCv}
              activeOpacity={0.85}
            >
              {uploadingCv ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                  <Text style={s.cvUploadText}>{t('mobile.editProfile.cvUpload')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Experiências profissionais ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>{t('mobile.editProfile.experiencesTitle')}</Text>
          </View>
          <Text style={s.cardSub}>{t('mobile.editProfile.experiencesSub')}</Text>

          {experiences.map(exp => (
            <View key={exp.jobTitle} style={s.expRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.expTitle}>{tSkill(exp.jobTitle)}</Text>
                <Text style={s.expLevel}>{t(`domain.experienceLevels.${exp.level}`)}</Text>
              </View>
              <TouchableOpacity onPress={() => removeExperience(exp.jobTitle)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={22} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={s.expAddBtn} onPress={() => setExpPickerOpen(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={s.expAddText}>{t('mobile.editProfile.experienceAdd')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── NIF + IBAN (both editable) ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="card-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>{t('mobile.editProfile.legalTitle')}</Text>
          </View>
          <Text style={s.cardSub}>{t('mobile.editProfile.legalSub')}</Text>

          {/* NIF — editable */}
          <Text style={[s.fieldLabel, { marginTop: 4 }]}>NIF <Text style={s.optText}>{t('common.optional')}</Text></Text>
          <TextInput
            style={[s.input, nifError ? s.inputError : {}]}
            value={nif}
            onChangeText={v => { setNif(v.replace(/\D/g, '').slice(0, 9)); setNifError(''); }}
            placeholder="123 456 789"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            autoCorrect={false}
            maxLength={9}
          />
          {nifError
            ? <Text style={s.errorText}>{nifError}</Text>
            : nif.length === 9 && isValidNIF(nif)
              ? <Text style={s.validText}>{t('mobile.editProfile.nifValid')}</Text>
              : null
          }
          <Text style={s.fieldHint}>{t('mobile.editProfile.nifHint')}</Text>

          {/* IBAN — editable */}
          <Text style={[s.fieldLabel, { marginTop: 12 }]}>IBAN <Text style={s.optText}>{t('common.optional')}</Text></Text>
          <TextInput
            style={[s.input, ibanError ? s.inputError : {}]}
            value={iban}
            onChangeText={v => { setIban(v.toUpperCase()); setIbanError(''); }}
            placeholder="PT50 0000 0000 0000 0000 0000 0"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={25}
          />
          {ibanError
            ? <Text style={s.errorText}>{ibanError}</Text>
            : iban.replace(/\s/g, '').length === 25 && isValidIBAN(iban.replace(/\s/g, ''))
              ? <Text style={s.validText}>{t('mobile.editProfile.ibanValid')}</Text>
              : null
          }
          <Text style={s.fieldHint}>{t('mobile.editProfile.ibanHint')}</Text>

          {/* ── IBAN sharing consent (GDPR) ── */}
          {ibanClean.length > 0 && (
            <TouchableOpacity
              style={s.consentRow}
              onPress={() => setIbanShareConsent(v => !v)}
              activeOpacity={0.7}
            >
              <View style={[s.checkbox, ibanShareConsent && s.checkboxOn]}>
                {ibanShareConsent && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={s.consentText}>{t('mobile.editProfile.ibanConsent')}</Text>
            </TouchableOpacity>
          )}
          {ibanClean.length > 0 && !ibanShareConsent && (
            <Text style={s.consentWarn}>{t('mobile.editProfile.ibanConsentWarn')}</Text>
          )}

          {/* removed: NIF read-only note */}
          <View style={[s.mutedRow, { marginTop: 8 }]}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.textSecondary} />
            <Text style={s.mutedNote}>{t('mobile.editProfile.nifLocked')}</Text>
          </View>
        </View>

        {/* ── Skills — grouped by category accordion ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="construct-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>{t('mobile.editProfile.skillsTitle')}</Text>
          </View>
          <Text style={s.cardSub}>{t('mobile.editProfile.skillsSub')}</Text>
          {SKILL_CATEGORIES.map(cat => (
            <SkillCategoryAccordion
              key={cat}
              category={cat}
              skills={SHIFT_CATEGORIES[cat]}
              selected={skills}
              onToggle={toggleSkill}
            />
          ))}
          <Text style={s.chipCount}>
            {skills.length === 1
              ? t('mobile.editProfile.skillsCountOne')
              : t('mobile.editProfile.skillsCountOther', { count: skills.length })}
          </Text>
        </View>

        {/* ── Languages ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="language-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>{t('mobile.editProfile.languagesTitle')}</Text>
          </View>
          <Text style={s.cardSub}>{t('mobile.editProfile.languagesSub')}</Text>
          <View style={s.chipsWrap}>
            {LANGUAGES.map(lang => {
              const active = languages.includes(lang);
              return (
                <TouchableOpacity
                  key={lang}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => toggleLanguage(lang)}
                  activeOpacity={0.8}
                >
                  {/* Display only — `lang` stays the stored PT value on toggle */}
                  <Text style={[s.chipText, active && s.chipTextActive]}>{tWorkerLanguage(lang)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.chipCount}>
            {languages.length === 1
              ? t('mobile.editProfile.languagesCountOne')
              : t('mobile.editProfile.languagesCountOther', { count: languages.length })}
          </Text>
        </View>

        {/* ── Availability — one concept: a master switch + the days it covers ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>{t('mobile.editProfile.availabilityTitle')}</Text>
          </View>

          <View style={s.availSwitchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.availSwitchTitle}>{t('mobile.editProfile.availabilitySwitch')}</Text>
              <Text style={s.availSwitchSub}>
                {isAvailableForWork
                  ? t('mobile.editProfile.availabilityOnSub')
                  : t('mobile.editProfile.availabilityOffSub')}
              </Text>
            </View>
            <Switch
              value={isAvailableForWork}
              onValueChange={setIsAvailableForWork}
              trackColor={{ false: '#d1d5db', true: '#86efac' }}
              thumbColor={isAvailableForWork ? '#16a34a' : '#f4f4f5'}
            />
          </View>

          <Text style={[s.cardSub, { marginTop: 12, opacity: isAvailableForWork ? 1 : 0.45 }]}>
            {t('mobile.profile.onDays')}
          </Text>
          <View style={[s.daysRow, !isAvailableForWork && { opacity: 0.45 }]}>
            {/* Stored PT values ('Seg'…) are the keys — only the label changes */}
            {STORED_WEEKDAYS.map(d => {
              const active = availableDays.includes(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[s.dayBtn, active && s.dayBtnActive]}
                  onPress={() => toggleDay(d)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.dayText, active && s.dayTextActive]}>{tWeekday(d)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Email de contacto (editable) ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="mail-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>{t('mobile.editProfile.emailTitle')}</Text>
          </View>
          <Text style={s.cardSub}>{t('mobile.editProfile.emailSub')}</Text>
          <TextInput
            style={s.input}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder={t('mobile.editProfile.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[s.submitBtn, saving && s.submitBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitBtnText}>{t('mobile.editProfile.saveAll')}</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      <ExperiencePicker
        visible={expPickerOpen}
        existing={experiences}
        onCancel={() => setExpPickerOpen(false)}
        onPick={addExperience}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: fontSize.h3, fontWeight: fontWeight.bold as any, textAlign: 'center' },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.full },
  saveBtnText: { color: '#fff', fontSize: fontSize.caption, fontWeight: fontWeight.bold as any },

  scroll: { padding: spacing.md, gap: 16 },

  /* Photo */
  photoSection: { alignItems: 'center', paddingVertical: spacing.md, gap: 8 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#eef0ff',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 38, fontWeight: fontWeight.bold as any, color: colors.primary },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  photoHint: { fontSize: fontSize.caption, color: colors.textSecondary },

  /* Card */
  card: {
    backgroundColor: '#fff', borderRadius: radius.lg,
    padding: spacing.md, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2,
  },
  cardMuted: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: colors.neutral },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: {
    fontSize: 11, fontWeight: fontWeight.bold as any, color: colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  cardSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: -4 },
  mutedNote: { fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 18, flex: 1 },
  mutedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: fontWeight.semibold as any, color: colors.textPrimary, marginBottom: 4 },
  optText: { fontWeight: fontWeight.regular as any, color: colors.textSecondary, fontSize: 12 },
  fieldHint: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  validText: { fontSize: fontSize.caption, color: '#16a34a', fontWeight: fontWeight.bold as any, marginTop: 2 },
  errorText: { fontSize: fontSize.caption, color: '#ef4444', marginTop: 2 },
  inputError: { borderColor: '#ef4444' },

  // IBAN sharing consent
  consentRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12,
    padding: 12, borderRadius: radius.sm,
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: '#d7dcff',
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', marginTop: 1,
  },
  checkboxOn:  { backgroundColor: colors.primary },
  consentText: { flex: 1, fontSize: fontSize.caption, color: colors.textPrimary, lineHeight: 17 },
  consentWarn: { fontSize: 11, color: '#b45309', marginTop: 6, lineHeight: 15 },

  /* Input */
  input: {
    borderWidth: 1, borderColor: colors.neutral, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: fontSize.body, color: colors.textPrimary,
    backgroundColor: colors.secondary,
  },

  /* Skill chips */
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: colors.secondary, borderWidth: 1.5, borderColor: colors.neutral,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold as any, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  chipCount: { fontSize: fontSize.caption, color: colors.textSecondary, textAlign: 'right' },

  /* Days */
  /* CV */
  cvUploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
    backgroundColor: '#f5f6ff', marginTop: 4,
  },
  cvUploadText: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.primary },
  cvRow: {
    backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0',
    borderRadius: radius.md, padding: spacing.sm, gap: 10, marginTop: 4,
  },
  cvInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cvName: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.semibold as any, color: '#166534' },
  cvActions: { flexDirection: 'row', gap: 16, paddingLeft: 28 },
  cvView:    { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: colors.primary },
  cvReplace: { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: colors.textSecondary },
  cvRemove:  { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: '#dc2626' },

  /* Experiences */
  expRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: radius.md, padding: spacing.sm, marginTop: 6,
  },
  expTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: '#92400e' },
  expLevel: { fontSize: fontSize.caption, color: '#b45309', marginTop: 1, fontWeight: fontWeight.semibold as any },
  expAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: radius.md, marginTop: 10,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed',
    backgroundColor: '#f5f6ff',
  },
  expAddText: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.primary },

  /* Availability master switch */
  availSwitchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: colors.neutral,
    borderRadius: radius.md, padding: spacing.sm,
  },
  availSwitchTitle: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  availSwitchSub: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },

  daysRow: { flexDirection: 'row', gap: 6 },
  dayBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.secondary, borderWidth: 1.5, borderColor: colors.neutral,
    alignItems: 'center',
  },
  dayBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontSize: 11, fontWeight: fontWeight.bold as any, color: colors.textSecondary },
  dayTextActive: { color: '#fff' },

  /* Submit */
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4,
  },
  submitBtnDisabled: { backgroundColor: '#d1d5db' },
  submitBtnText: { color: '#fff', fontSize: fontSize.body, fontWeight: fontWeight.bold as any },
});
