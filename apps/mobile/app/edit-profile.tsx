import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, fontSize, fontWeight, SHIFT_CATEGORIES, ShiftCategory, LANGUAGES, isValidIBAN } from '@turnos/shared';
import { authApi } from '../lib/api';

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

export default function EditProfileScreen() {
  const router = useRouter();

  const [fullName, setFullName]           = useState('');
  const [bio, setBio]                     = useState('');
  const [skills, setSkills]               = useState<string[]>([]);
  const [languages, setLanguages]         = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [iban, setIban]                   = useState('');
  const [ibanError, setIbanError]         = useState('');
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
      setIban(data.iban ?? '');
      setContactEmail((data as any).contactEmail ?? '');
      setPhotoUrl(data.photoUrl ?? null);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o perfil.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Nome obrigatório', 'Por favor introduz o teu nome completo.');
      return;
    }
    setSaving(true);
    try {
      // Validate IBAN if provided
      const ibanClean = iban.replace(/\s/g, '').toUpperCase();
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
        iban: ibanClean || undefined,
        contactEmail: contactEmail.trim() || undefined,
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

        {/* ── IBAN (editable) + NIF (read-only) ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="card-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>DADOS BANCÁRIOS</Text>
          </View>

          {/* IBAN — editable */}
          <Text style={s.fieldLabel}>IBAN <Text style={s.optText}>(opcional)</Text></Text>
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
          <Text style={s.fieldHint}>Necessário para receber o teu pagamento após o turno.</Text>

          {/* NIF — read-only */}
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

        {/* ── Availability ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={s.cardTitle}>DISPONIBILIDADE SEMANAL</Text>
          </View>
          <Text style={s.cardSub}>Dias em que estás disponível para trabalhar</Text>
          <View style={s.daysRow}>
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
