/**
 * The worker's roles — up to MAX_WORKER_ROLES, each with a level and the tasks
 * they have done. Same vocabulary companies post shifts with (ROLE_CATALOGUE),
 * so every field can be matched. Used by onboarding and edit-profile.
 *
 * Adding or editing a role opens a sheet: role → level (described by what the
 * person can DO, the same words the company reads) → tasks → years (optional).
 */
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert, Linking, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import {
  colors, spacing, radius, fontSize, fontWeight,
  SHIFT_CATEGORIES, ShiftCategory, EXPERIENCE_LEVELS, ExperienceLevel,
  MAX_WORKER_ROLES, ROLE_CERTIFICATE_LABELS, ROLE_CONFIRMED_MIN_SHIFTS,
  WorkerRole, RoleLevel, getRole, roleMaxLevel, roleNeedsCertificate,
} from '@turnos/shared';
import { useT } from '../lib/i18n';
import { authApi, ApiError } from '../lib/api';

/** One icon per role family. Record over the union: a new family without an icon fails to compile. */
export const ROLE_CATEGORY_ICONS: Record<ShiftCategory, string> = {
  'Sala e Bar':           'wine-outline',
  'Cozinha':              'restaurant-outline',
  'Alojamento':           'bed-outline',
  'Eventos':              'star-outline',
  'Limpeza e Manutenção': 'sparkles-outline',
  'Segurança':            'shield-checkmark-outline',
  'Retalho':              'pricetag-outline',
  'Logística':            'cube-outline',
  'Apoio ao Cliente':     'headset-outline',
  'Administração':        'briefcase-outline',
};

export function RolesEditor({ roles, onChange, savedRoleNames }: {
  roles: WorkerRole[];
  onChange: (roles: WorkerRole[]) => void;
  /**
   * Roles already stored on the server. A licensed role's document can only
   * be uploaded once the role is saved; omit (onboarding) to show the hint.
   */
  savedRoleNames?: string[];
}) {
  const { t, tSkill, tRoleLevel, language } = useT();
  const [uploading, setUploading] = useState<string | null>(null);

  // The server returns the roles with the new document attached; keep the
  // worker's unsaved edits and take only the certificate from it.
  const mergeCertificates = (fromServer: WorkerRole[]) =>
    onChange(roles.map(r => {
      const s = fromServer.find(x => x.role === r.role);
      return s ? { ...r, certificate: s.certificate ?? null } : r;
    }));

  const uploadCertificate = async (role: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 10 * 1024 * 1024) {
      Alert.alert(t('mobile.roles.title'), t('mobile.roles.certificateTooBig'));
      return;
    }
    setUploading(role);
    try {
      const res = await authApi.uploadRoleCertificate(
        role, asset.uri, asset.mimeType ?? 'application/pdf', asset.name ?? 'documento.pdf',
      );
      mergeCertificates(res.roles);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof ApiError && err.status < 500 ? err.message : t('mobile.roles.certificateFailed'));
    } finally {
      setUploading(null);
    }
  };

  const removeCertificate = (role: string) => {
    Alert.alert(t('mobile.roles.certificateRemoveTitle'), t('mobile.roles.certificateRemoveBody', { role: tSkill(role) }), [
      { text: t('mobile.roles.cancel'), style: 'cancel' },
      {
        text: t('mobile.roles.remove'), style: 'destructive',
        onPress: async () => {
          try { mergeCertificates((await authApi.removeRoleCertificate(role)).roles); }
          catch { Alert.alert(t('common.error'), t('mobile.roles.certificateFailed')); }
        },
      },
    ]);
  };
  // null = closed; '' = adding a new role; a role name = editing that role
  const [editing, setEditing] = useState<string | null>(null);

  const save = (role: WorkerRole) => {
    const rest = roles.filter(r => r.role !== role.role && r.role !== editing);
    // Keep the edited role in its place; a new one goes last
    const at = roles.findIndex(r => r.role === editing);
    const next = [...rest];
    next.splice(at === -1 ? next.length : at, 0, role);
    onChange(next.slice(0, MAX_WORKER_ROLES));
    setEditing(null);
  };

  const remove = (name: string) => {
    Alert.alert(t('mobile.roles.removeTitle'), t('mobile.roles.removeBody', { role: tSkill(name) }), [
      { text: t('mobile.roles.cancel'), style: 'cancel' },
      { text: t('mobile.roles.remove'), style: 'destructive', onPress: () => onChange(roles.filter(r => r.role !== name)) },
    ]);
  };

  const full = roles.length >= MAX_WORKER_ROLES;

  return (
    <View>
      {roles.map(r => {
        const confirmed = (r.confirmedShifts ?? 0) >= ROLE_CONFIRMED_MIN_SHIFTS;
        return (
          <View key={r.role} style={[re.card, r.provisional && re.cardProvisional]}>
            <View style={re.cardHead}>
              <Text style={re.roleName}>{tSkill(r.role)}</Text>
              <View style={re.levelPill}>
                <Text style={re.levelPillText}>{t('mobile.roles.levelN', { level: r.level })}</Text>
              </View>
              {r.provisional && (
                <View style={re.provisionalPill}>
                  <Text style={re.provisionalPillText}>{t('mobile.roles.provisionalTag')}</Text>
                </View>
              )}
            </View>
            <Text style={re.levelText}>{tRoleLevel(r.role, r.level)}</Text>
            <Text style={re.meta}>
              {r.tasks.length ? t('mobile.roles.tasksCount', { count: r.tasks.length }) : t('mobile.roles.noTasks')}
              {r.years ? ` · ${t(`domain.experienceLevelsShort.${r.years}`)}` : ''}
            </Text>
            {/* Licensed roles: the legally required document */}
            {roleNeedsCertificate(r.role) && (() => {
              const doc = getRole(r.role)?.certificate;
              const docLabel = doc ? ROLE_CERTIFICATE_LABELS[doc][language] : '';
              if (r.certificate?.url) {
                return (
                  <View style={re.certOk}>
                    <Ionicons name="shield-checkmark" size={15} color="#166534" />
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(r.certificate!.url)} activeOpacity={0.7}>
                      <Text style={re.certOkText} numberOfLines={1}>
                        {t('mobile.roles.certificateSent', { name: r.certificate.fileName })}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => uploadCertificate(r.role)} activeOpacity={0.7}>
                      <Text style={re.edit}>{t('mobile.roles.certificateReplace')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeCertificate(r.role)} activeOpacity={0.7}>
                      <Text style={re.remove}>{t('mobile.roles.remove')}</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
              const saved = !!savedRoleNames?.includes(r.role);
              return (
                <View style={re.certNeeded}>
                  <Text style={re.certNeededText}>{t('mobile.roles.certificateNeeded', { doc: docLabel })}</Text>
                  {saved ? (
                    <TouchableOpacity
                      style={re.certBtn}
                      onPress={() => uploadCertificate(r.role)}
                      disabled={uploading === r.role}
                      activeOpacity={0.85}
                    >
                      {uploading === r.role
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />}
                      <Text style={re.certBtnText}>
                        {uploading === r.role ? t('mobile.roles.certificateUploading') : t('mobile.roles.certificateUpload')}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={re.certHint}>{t('mobile.roles.certificateSaveFirst')}</Text>
                  )}
                </View>
              );
            })()}
            <View style={re.cardFoot}>
              <View style={confirmed ? re.confirmed : undefined}>
                <Text style={confirmed ? re.confirmedText : re.declaredText}>
                  {confirmed
                    ? `✓ ${t('mobile.roles.confirmed', { count: r.confirmedShifts ?? 0 })}`
                    : t('mobile.roles.declared')}
                </Text>
              </View>
              <View style={re.actions}>
                <TouchableOpacity onPress={() => setEditing(r.role)} activeOpacity={0.7}>
                  <Text style={re.edit}>{t('mobile.roles.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(r.role)} activeOpacity={0.7}>
                  <Text style={re.remove}>{t('mobile.roles.remove')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={[re.addBtn, full && re.addBtnDisabled]}
        onPress={() => full
          ? Alert.alert(t('mobile.roles.title'), t('mobile.roles.maxReached', { max: MAX_WORKER_ROLES }))
          : setEditing('')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={18} color={full ? colors.textSecondary : colors.primary} />
        <Text style={[re.addText, full && { color: colors.textSecondary }]}>
          {t('mobile.roles.addCount', { count: roles.length, max: MAX_WORKER_ROLES })}
        </Text>
      </TouchableOpacity>

      <RoleSheet
        visible={editing !== null}
        initial={editing ? roles.find(r => r.role === editing) ?? null : null}
        taken={roles.map(r => r.role).filter(name => name !== editing)}
        onCancel={() => setEditing(null)}
        onSave={save}
      />
    </View>
  );
}

function RoleSheet({ visible, initial, taken, onCancel, onSave }: {
  visible: boolean;
  initial: WorkerRole | null;
  taken: string[];
  onCancel: () => void;
  onSave: (role: WorkerRole) => void;
}) {
  const { t, tSkill, tCategory, tRoleLevel, tTask, language } = useT();
  const [role, setRole]   = useState<string | null>(null);
  const [level, setLevel] = useState<RoleLevel>(1);
  const [tasks, setTasks] = useState<string[]>([]);
  const [years, setYears] = useState<ExperienceLevel | null>(null);

  // Start from the role being edited, or from scratch
  useEffect(() => {
    if (!visible) return;
    setRole(initial?.role ?? null);
    setLevel(initial?.level ?? 1);
    setTasks(initial?.tasks ?? []);
    setYears(initial?.years ?? null);
  }, [visible, initial]);

  const def = role ? getRole(role) : undefined;
  const maxLevel = role ? roleMaxLevel(role) : 1;

  const pickRole = (name: string) => {
    setRole(name); setLevel(1); setTasks([]); setYears(null);
  };
  const toggleTask = (id: string) =>
    setTasks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={sh.overlay}>
        <View style={sh.sheet}>
          <View style={sh.head}>
            {role && !initial ? (
              <TouchableOpacity onPress={() => setRole(null)} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : <View style={{ width: 22 }} />}
            <Text style={sh.title} numberOfLines={1}>
              {role ? tSkill(role) : t('mobile.roles.pickRole')}
            </Text>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
            {!role || !def ? (
              <>
                <Text style={sh.sub}>{t('mobile.roles.pickRoleSub')}</Text>
                {(Object.keys(SHIFT_CATEGORIES) as ShiftCategory[]).map(cat => (
                  <View key={cat} style={{ marginBottom: spacing.sm }}>
                    <View style={sh.catHead}>
                      <Ionicons name={ROLE_CATEGORY_ICONS[cat] as any} size={15} color={colors.primary} />
                      <Text style={sh.catText}>{tCategory(cat)}</Text>
                    </View>
                    {SHIFT_CATEGORIES[cat].map(name => {
                      const isTaken = taken.includes(name);
                      return (
                        <TouchableOpacity
                          key={name}
                          style={sh.row}
                          disabled={isTaken}
                          onPress={() => pickRole(name)}
                          activeOpacity={0.75}
                        >
                          <Text style={[sh.rowText, isTaken && { color: colors.textSecondary }]}>{tSkill(name)}</Text>
                          {isTaken
                            ? <Text style={sh.taken}>{t('mobile.roles.chosen')}</Text>
                            : <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </>
            ) : (
              <>
                {/* Level — the same descriptions the company picks from */}
                <Text style={sh.section}>{t('mobile.roles.pickLevel')}</Text>
                <Text style={sh.sub}>{t('mobile.roles.pickLevelSub')}</Text>
                {def.certificate && (
                  <View style={sh.certificate}>
                    <Ionicons name="shield-checkmark-outline" size={15} color="#92400e" />
                    <Text style={sh.certificateText}>
                      {t('mobile.roles.certificate', { doc: ROLE_CERTIFICATE_LABELS[def.certificate][language] })}
                    </Text>
                  </View>
                )}
                {maxLevel === 1 ? (
                  <View style={[sh.levelCard, sh.levelCardActive]}>
                    <Text style={sh.levelText}>{tRoleLevel(role, 1)}</Text>
                    <Text style={sh.singleNote}>{t('mobile.roles.singleLevel')}</Text>
                  </View>
                ) : (
                  Array.from({ length: maxLevel }, (_, i) => (i + 1) as RoleLevel).map(n => {
                    const active = level === n;
                    return (
                      <TouchableOpacity
                        key={n}
                        style={[sh.levelCard, active && sh.levelCardActive]}
                        onPress={() => setLevel(n)}
                        activeOpacity={0.8}
                      >
                        <View style={sh.levelHead}>
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={18}
                            color={active ? colors.primary : colors.textSecondary}
                          />
                          <Text style={sh.levelN}>{t('mobile.roles.levelN', { level: n })}</Text>
                        </View>
                        <Text style={sh.levelText}>{tRoleLevel(role, n)}</Text>
                      </TouchableOpacity>
                    );
                  })
                )}

                {/* Tasks done */}
                <Text style={[sh.section, { marginTop: spacing.md }]}>{t('mobile.roles.tasksTitle')}</Text>
                <Text style={sh.sub}>{t('mobile.roles.tasksSub')}</Text>
                <View style={sh.chips}>
                  {def.tasks.map(task => {
                    const on = tasks.includes(task.id);
                    return (
                      <TouchableOpacity
                        key={task.id}
                        style={[sh.chip, on && sh.chipOn]}
                        onPress={() => toggleTask(task.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={[sh.chipText, on && sh.chipTextOn]}>
                          {on ? '✓ ' : ''}{tTask(role, task.id)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Years — supporting evidence only, never a gate */}
                <Text style={[sh.section, { marginTop: spacing.md }]}>
                  {t('mobile.roles.yearsTitle')} <Text style={sh.optional}>({t('mobile.roles.optional')})</Text>
                </Text>
                <View style={sh.chips}>
                  {(Object.keys(EXPERIENCE_LEVELS) as ExperienceLevel[]).map(y => {
                    const on = years === y;
                    return (
                      <TouchableOpacity
                        key={y}
                        style={[sh.chip, on && sh.chipOn]}
                        onPress={() => setYears(on ? null : y)}
                        activeOpacity={0.8}
                      >
                        <Text style={[sh.chipText, on && sh.chipTextOn]}>{t(`domain.experienceLevelsShort.${y}`)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={sh.doneBtn}
                  onPress={() => onSave({
                    role, level: Math.min(level, maxLevel) as RoleLevel, tasks, years,
                    confirmedShifts: initial?.role === role ? initial.confirmedShifts : 0,
                    certificate: initial?.role === role ? initial.certificate ?? null : null,
                  })}
                  activeOpacity={0.85}
                >
                  <Text style={sh.doneText}>{t('mobile.roles.done')}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const re = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: colors.neutral, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: 8, backgroundColor: '#fff', gap: 4,
  },
  cardProvisional: { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  roleName: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  levelPill: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  levelPillText: { fontSize: 11, fontWeight: fontWeight.bold as any, color: colors.primary },
  provisionalPill: { backgroundColor: '#fef3c7', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  provisionalPillText: { fontSize: 11, fontWeight: fontWeight.bold as any, color: '#92400e' },
  levelText: { fontSize: fontSize.caption, color: colors.textPrimary, lineHeight: 18 },
  meta: { fontSize: fontSize.caption, color: colors.textSecondary },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  confirmed: { backgroundColor: '#dcfce7', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  confirmedText: { fontSize: 11, fontWeight: fontWeight.bold as any, color: '#166534' },
  declaredText: { fontSize: 11, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: 16 },
  edit: { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: colors.primary },
  remove: { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: '#dc2626' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 12, marginTop: 4,
  },
  addBtnDisabled: { borderColor: colors.neutral },
  addText: { fontSize: fontSize.body, fontWeight: fontWeight.semibold as any, color: colors.primary },
  certOk: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
    backgroundColor: '#f0fdf4', borderRadius: radius.sm, padding: 8,
  },
  certOkText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold as any, color: '#166534' },
  certNeeded: {
    marginTop: 4, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d',
    borderRadius: radius.sm, padding: 8, gap: 6,
  },
  certNeededText: { fontSize: fontSize.caption, color: '#92400e', lineHeight: 18 },
  certHint: { fontSize: fontSize.caption, color: '#92400e', fontStyle: 'italic' },
  certBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff',
  },
  certBtnText: { fontSize: fontSize.caption, fontWeight: fontWeight.bold as any, color: colors.primary },
});

const sh = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingBottom: 32, paddingHorizontal: spacing.md, paddingTop: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, gap: 8 },
  title: { flex: 1, textAlign: 'center', fontSize: fontSize.h3, fontWeight: fontWeight.bold as any, color: colors.textPrimary },
  sub: { fontSize: fontSize.caption, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 18 },
  section: { fontSize: fontSize.body, fontWeight: fontWeight.bold as any, color: colors.textPrimary, marginBottom: 2 },
  optional: { fontSize: fontSize.caption, fontWeight: fontWeight.regular as any, color: colors.textSecondary },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  catText: { fontSize: 12, fontWeight: fontWeight.bold as any, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.neutral, gap: 10,
  },
  rowText: { fontSize: fontSize.body, color: colors.textPrimary, fontWeight: fontWeight.semibold as any, flex: 1 },
  taken: { fontSize: fontSize.caption, color: colors.textSecondary },
  certificate: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fffbeb',
    borderWidth: 1, borderColor: '#fcd34d', borderRadius: radius.sm, padding: 10, marginBottom: 8,
  },
  certificateText: { flex: 1, fontSize: fontSize.caption, fontWeight: fontWeight.semibold as any, color: '#92400e' },
  levelCard: {
    borderWidth: 1.5, borderColor: colors.neutral, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: 8, gap: 4,
  },
  levelCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  levelHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelN: { fontSize: 12, fontWeight: fontWeight.bold as any, color: colors.primary, textTransform: 'uppercase' },
  levelText: { fontSize: fontSize.body, color: colors.textPrimary, lineHeight: 20 },
  singleNote: { fontSize: fontSize.caption, color: colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full,
    backgroundColor: colors.secondary, borderWidth: 1.5, borderColor: colors.neutral,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold as any, color: colors.textSecondary },
  chipTextOn: { color: '#fff' },
  doneBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14,
    alignItems: 'center', marginTop: spacing.lg,
  },
  doneText: { color: '#fff', fontSize: fontSize.body, fontWeight: fontWeight.bold as any },
});
