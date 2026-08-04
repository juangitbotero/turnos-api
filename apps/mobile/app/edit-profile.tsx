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
  LANGUAGES, isValidIBAN, isValidNIF,
  JOB_TITLES, EXPERIENCE_LEVELS, ExperienceLevel, WorkerExperience, experienceLevelLabel,
} from '@turnos/shared';
import { authApi, ApiError } from '../lib/api';
import { tokenStorage } from '../lib/storage';

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
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
        <Text style={acc.headerText}>{category}</Text>
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
                  <Text style={[acc.chipText, active && acc.chipTextActive]}>{sk}</Text>
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
              {chosenTitle ? 'Quantos anos?' : 'Escolhe a função'}
            </Text>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {chosenTitle && <Text style={ep.chosen}>{chosenTitle}</Text>}

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {chosenTitle ? (
              (Object.keys(EXPERIENCE_LEVELS) as ExperienceLevel[]).map(level => (
                <TouchableOpacity
                  key={level}
                  style={ep.row}
                  onPress={() => onPick(chosenTitle, level)}
                  activeOpacity={0.75}
                >
                  <Text style={ep.rowText}>{EXPERIENCE_LEVELS[level]}</Text>
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
                    <Text style={ep.rowText}>{title}</Text>
                    {already
                      ? <Text style={ep.already}>{experienceLevelLabel(already.level)}</Text>
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
          'Sessão expirada',
          'A tua sessão expirou. Por favor inicia sessão novamente.',
          [{ text: 'Iniciar sessão', onPress: () => router.replace('/login') }],
        );
        return;
      }
      Alert.alert('Erro', 'Não foi possível carregar o perfil.');
    } finally {
      setLoading(false);
    }
  }, [router]);

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
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para alterar a foto.');
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
      Alert.alert('Foto atualizada!', 'A tua foto de perfil foi guardada.');
    } catch {
      Alert.alert('Erro', 'Não foi possível fazer upload da foto. Tenta novamente.');
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
      Alert.alert('Ficheiro demasiado grande', 'O CV não pode exceder 10 MB.');
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
      Alert.alert('CV carregado!', `O teu perfil está agora ${res.profileQualityScore}% completo.`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Não foi possível carregar o CV. Tenta novamente.';
      Alert.alert('Erro', msg);
    } finally {
      setUploadingCv(false);
    }
  };

  const handleRemoveCv = () => {
    Alert.alert('Remover CV', 'Tens a certeza? Vais perder 10 pontos no perfil.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          try {
            await authApi.deleteWorkerCv();
            setCvUrl(null);
            setCvFileName(null);
          } catch {
            Alert.alert('Erro', 'Não foi possível remover o CV.');
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
      Alert.alert('Nome obrigatório', 'Por favor introduz o teu nome completo.');
      return;
    }
    setSaving(true);
    try {
      // Validate NIF if provided
      const nifClean = nif.replace(/\D/g, '').slice(0, 9);
      if (nifClean && !isValidNIF(nifClean)) {
        setNifError('NIF inválido — deve ter 9 dígitos válidos.');
        setSaving(false);
        return;
      }
      setNifError('');

      // Validate IBAN if provided
      if (ibanClean && !isValidIBAN(ibanClean)) {
        setIbanError('IBAN inválido — verifica o formato PT50...');
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
      Alert.alert('Perfil guardado!', 'As tuas alterações foram guardadas com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar as alterações. Tenta novamente.');
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
        <Text style={s.headerTitle}>Editar perfil</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={s.saveBtn}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveBtnText}>Guardar</Text>
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
          <Text style={s.photoHint}>Toca para alterar a foto</Text>
        </View>

        {/* ── Name ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="person-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>NOME COMPLETO</Text>
          </View>
          <TextInput
            style={s.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="O teu nome completo"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        {/* ── Bio / Introdução ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>INTRODUÇÃO</Text>
          </View>
          <Text style={s.cardSub}>Uma breve apresentação para os empregadores (máx. 200 caracteres)</Text>
          <TextInput
            style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
            value={bio}
            onChangeText={t => setBio(t.slice(0, 200))}
            placeholder="Ex: Tenho 3 anos de experiência em restauração e sou pontual e proativo..."
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
            <Text style={s.cardTitle}>CURRÍCULO (CV)</Text>
          </View>
          <Text style={s.cardSub}>
            PDF ou Word, até 10 MB. As empresas veem-no quando escolhem candidatos. Vale +10pts no perfil.
          </Text>

          {cvUrl ? (
            <View style={s.cvRow}>
              <View style={s.cvInfo}>
                <Ionicons name="document-attach" size={20} color="#16a34a" />
                <Text style={s.cvName} numberOfLines={1}>{cvFileName ?? 'CV carregado'}</Text>
              </View>
              <View style={s.cvActions}>
                <TouchableOpacity onPress={() => Linking.openURL(cvUrl)} activeOpacity={0.7}>
                  <Text style={s.cvView}>Ver</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePickCv} disabled={uploadingCv} activeOpacity={0.7}>
                  <Text style={s.cvReplace}>{uploadingCv ? '...' : 'Substituir'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRemoveCv} activeOpacity={0.7}>
                  <Text style={s.cvRemove}>Remover</Text>
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
                  <Text style={s.cvUploadText}>Carregar o meu CV</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Experiências profissionais ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="briefcase-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>AS MINHAS EXPERIÊNCIAS</Text>
          </View>
          <Text style={s.cardSub}>
            Quantos anos já trabalhaste em cada função. As empresas veem isto ao escolher candidatos.
          </Text>

          {experiences.map(exp => (
            <View key={exp.jobTitle} style={s.expRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.expTitle}>{exp.jobTitle}</Text>
                <Text style={s.expLevel}>{experienceLevelLabel(exp.level)}</Text>
              </View>
              <TouchableOpacity onPress={() => removeExperience(exp.jobTitle)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={22} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={s.expAddBtn} onPress={() => setExpPickerOpen(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={s.expAddText}>Adicionar experiência</Text>
          </TouchableOpacity>
        </View>

        {/* ── NIF + IBAN (both editable) ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="card-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>DADOS LEGAIS & BANCÁRIOS</Text>
          </View>
          <Text style={s.cardSub}>Necessários para contratos MCD e receber pagamentos. Valem +20pts cada no perfil.</Text>

          {/* NIF — editable */}
          <Text style={[s.fieldLabel, { marginTop: 4 }]}>NIF <Text style={s.optText}>(opcional)</Text></Text>
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
              ? <Text style={s.validText}>✓ NIF válido</Text>
              : null
          }
          <Text style={s.fieldHint}>Número de Identificação Fiscal português (9 dígitos).</Text>

          {/* IBAN — editable */}
          <Text style={[s.fieldLabel, { marginTop: 12 }]}>IBAN <Text style={s.optText}>(opcional)</Text></Text>
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
              ? <Text style={s.validText}>✓ IBAN válido</Text>
              : null
          }
          <Text style={s.fieldHint}>Necessário para receberes o pagamento por transferência.</Text>

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
              <Text style={s.consentText}>
                Autorizo a partilha do meu nome e IBAN com as empresas onde fiz turnos,
                para que me possam pagar por transferência. Podes retirar esta autorização
                aqui a qualquer momento.
              </Text>
            </TouchableOpacity>
          )}
          {ibanClean.length > 0 && !ibanShareConsent && (
            <Text style={s.consentWarn}>
              Sem esta autorização, as empresas só te podem pagar por Turnos Pay Link ou MB WAY.
            </Text>
          )}

          {/* removed: NIF read-only note */}
          <View style={[s.mutedRow, { marginTop: 8 }]}>
            <Ionicons name="lock-closed-outline" size={13} color={colors.textSecondary} />
            <Text style={s.mutedNote}>
              O NIF não pode ser alterado. Para o corrigir contacta o suporte.
            </Text>
          </View>
        </View>

        {/* ── Skills — grouped by category accordion ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="construct-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>COMPETÊNCIAS</Text>
          </View>
          <Text style={s.cardSub}>Toca numa categoria para expandir e selecionar</Text>
          {SKILL_CATEGORIES.map(cat => (
            <SkillCategoryAccordion
              key={cat}
              category={cat}
              skills={SHIFT_CATEGORIES[cat]}
              selected={skills}
              onToggle={toggleSkill}
            />
          ))}
          <Text style={s.chipCount}>{skills.length} selecionada{skills.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* ── Languages ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="language-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>IDIOMAS</Text>
          </View>
          <Text style={s.cardSub}>Idiomas em que és fluente</Text>
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
                  <Text style={[s.chipText, active && s.chipTextActive]}>{lang}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.chipCount}>{languages.length} selecionado{languages.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* ── Availability — one concept: a master switch + the days it covers ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>DISPONIBILIDADE</Text>
          </View>

          <View style={s.availSwitchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.availSwitchTitle}>Estou disponível para trabalhar</Text>
              <Text style={s.availSwitchSub}>
                {isAvailableForWork
                  ? 'As empresas podem encontrar-te na pesquisa de trabalhadores.'
                  : 'Ficas oculto na pesquisa das empresas. Não afeta a tua pontuação de perfil.'}
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
            Nos dias:
          </Text>
          <View style={[s.daysRow, !isAvailableForWork && { opacity: 0.45 }]}>
            {DAYS.map(d => {
              const active = availableDays.includes(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[s.dayBtn, active && s.dayBtnActive]}
                  onPress={() => toggleDay(d)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.dayText, active && s.dayTextActive]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Email de contacto (editable) ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="mail-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>EMAIL DE CONTACTO</Text>
          </View>
          <Text style={s.cardSub}>
            O teu acesso usa SMS — este email é só para recibos e comunicações.
          </Text>
          <TextInput
            style={s.input}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="o.teu@email.com"
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
            : <Text style={s.submitBtnText}>Guardar alterações</Text>
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
