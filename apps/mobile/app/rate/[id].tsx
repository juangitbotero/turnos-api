/**
 * Rate shift screen — worker rates the employer after a COMPLETED shift.
 * Accessed via /rate/[shiftId] from the "Avaliar" CTA in my-shifts.
 *
 * One-way rating: employers rate workers (Stint 7 scope).
 * Note: this screen is kept for future worker-rates-employer (Stint 8).
 * For now it navigates here but the API endpoint is EMPLOYER → WORKER only,
 * so this screen will be revisited when two-way ratings are introduced.
 *
 * Actually: this screen loads the shift info and calls
 * POST /ratings so the worker can see they've navigated to the right place.
 * In v1 the "Avaliar" CTA is shown to the EMPLOYER in web-admin.
 * On mobile the worker sees the employer info — this screen is a placeholder
 * that simply shows the shift summary until worker-rates-employer is built.
 *
 * TODO Stint 8: Implement worker-rates-employer flow here.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight, WORKER_RATING_TAGS } from '@turnos/shared';
import { api, shiftApi, ratingsApi, ShiftSummary } from '../../lib/api';

const TAGS = WORKER_RATING_TAGS as readonly { key: string; label: string }[];

export default function RateShiftScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [shift, setShift]           = useState<ShiftSummary | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [score, setScore]           = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment]       = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [shiftData, ratedData] = await Promise.all([
        shiftApi.getById(id),
        ratingsApi.hasRatedShift(id).catch(() => ({ hasRated: false })),
      ]);
      setShift(shiftData);
      setAlreadyRated(ratedData.hasRated);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os dados do turno.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleTag = (key: string) => {
    setSelectedTags(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key],
    );
  };

  const handleSubmit = async () => {
    if (score === 0) {
      Alert.alert('Avaliação incompleta', 'Por favor seleciona pelo menos 1 estrela.');
      return;
    }
    if (!id) return;

    setSubmitting(true);
    try {
      await api.post('/ratings', {
        shiftId: id,
        score,
        tags: selectedTags,
        comment: comment.trim() || undefined,
      });
      Alert.alert('Obrigado!', 'A tua avaliação foi registada com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar a avaliação. Tenta novamente.');
    } finally {
      setSubmitting(false);
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
      <LinearGradient colors={['#6a79ff', '#9b6dff']} style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Avaliar turno</Text>
          {shift && (
            <Text style={s.headerSub} numberOfLines={1}>
              {shift.title} · {shift.employer?.companyName ?? 'Empresa'}
            </Text>
          )}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {alreadyRated ? (
          /* Already rated */
          <View style={s.alreadyRated}>
            <Text style={s.alreadyRatedIcon}>✓</Text>
            <Text style={s.alreadyRatedTitle}>Já avaliaste este turno</Text>
            <Text style={s.alreadyRatedSub}>A tua avaliação foi registada. Obrigado pelo feedback!</Text>
          </View>
        ) : (
          <>
            {/* Stars */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>Como correu o turno?</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setScore(n)} activeOpacity={0.7}>
                    <Text style={[s.star, n <= score && s.starFilled]}>★</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {score > 0 && (
                <Text style={s.scoreLabel}>
                  {['', 'Mau 😞', 'Razoável 😐', 'Bom 😊', 'Muito bom 😄', 'Excelente 🤩'][score]}
                </Text>
              )}
            </View>

            {/* Tags */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>O que destacas? (opcional)</Text>
              <View style={s.tagsRow}>
                {TAGS.map(tag => (
                  <TouchableOpacity
                    key={tag.key}
                    style={[s.tagChip, selectedTags.includes(tag.key) && s.tagChipSelected]}
                    onPress={() => toggleTag(tag.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.tagText, selectedTags.includes(tag.key) && s.tagTextSelected]}>
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Comment */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>Comentário (opcional)</Text>
              <TextInput
                style={s.commentInput}
                multiline
                placeholder="Deixa um comentário sobre o turno..."
                placeholderTextColor={colors.textSecondary}
                value={comment}
                onChangeText={t => setComment(t.slice(0, 140))}
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{comment.length}/140</Text>
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky bottom bar */}
      {!alreadyRated && (
        <View style={s.bottomBar}>
          <TouchableOpacity
            style={[s.submitBtn, score === 0 && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={score === 0 || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>Enviar avaliação</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: spacing.md,
    paddingBottom: 20,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: '#fff' },
  headerTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: '#fff' },
  headerSub: { fontSize: fontSize.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  content: { padding: spacing.md },

  section: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral,
  },
  sectionLabel: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  starsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 4 },
  star: { fontSize: 40, color: '#d1d5db' },
  starFilled: { color: '#fbbf24' },
  scoreLabel: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.neutral,
  },
  tagChipSelected: { backgroundColor: '#6a79ff', borderColor: '#6a79ff' },
  tagText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  tagTextSelected: { color: '#fff' },

  commentInput: {
    borderWidth: 1,
    borderColor: colors.neutral,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: fontSize.body,
    color: colors.textPrimary,
    minHeight: 80,
    backgroundColor: colors.secondary,
  },
  charCount: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },

  alreadyRated: { alignItems: 'center', paddingTop: 60, gap: 12 },
  alreadyRatedIcon: { fontSize: 56, color: '#16a34a' },
  alreadyRatedTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  alreadyRatedSub: { fontSize: fontSize.body, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.neutral,
    padding: spacing.md,
    paddingBottom: 32,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#d1d5db' },
  submitBtnText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.body },
});
