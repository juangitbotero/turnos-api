/**
 * /scan — QR code scanner for shift check-in (v2.1: check-in only).
 *
 * Flow:
 *   1. Request camera + location permissions
 *   2. Worker points camera at the printed check-in QR at the venue
 *   3. CameraView decodes the QR → check-in API
 *   4. Success alert → back to shift detail page
 *
 * There is no check-out scan — the shift completes automatically at its
 * scheduled end time. Payment is ALWAYS based on scheduled shift hours.
 */
import { useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';
import { attendanceApi, ApiError } from '../lib/api';
import { useT } from '../lib/i18n';

export default function ScanScreen() {
  const router = useRouter();
  const { t } = useT();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Guard against duplicate fires — CameraView calls onBarcodeScanned repeatedly
  const processingRef = useRef(false);

  const handleBarcode = useCallback(async ({ data }: BarcodeScanningResult) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      // Best-effort GPS — gracefully skips if permission denied
      let lat = 0, lng = 0;
      const locPermission = await Location.requestForegroundPermissionsAsync();
      if (locPermission.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }

      await attendanceApi.checkIn(data, lat, lng);
      Alert.alert(
        t('mobile.scan.okTitle'),
        t('mobile.scan.okBody'),
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('mobile.scan.failed');
      Alert.alert(t('common.error'), msg, [
        {
          text: t('common.retry'),
          onPress: () => { processingRef.current = false; },
        },
        {
          text: t('common.back'),
          style: 'cancel',
          onPress: () => router.back(),
        },
      ]);
      // Don't reset processingRef here — the user must explicitly tap retry
    }
  }, [router, t]);

  // ── Permission: loading ──────────────────────────────────────────────────

  if (!cameraPermission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // ── Permission: denied ───────────────────────────────────────────────────

  if (!cameraPermission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>{t('mobile.scan.permTitle')}</Text>
        <Text style={styles.permBody}>{t('mobile.scan.permBody')}</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestCameraPermission} activeOpacity={0.85}>
          <Text style={styles.permBtnText}>{t('mobile.scan.permAllow')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.cancelLinkText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Scanner ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('mobile.scan.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Camera fills the middle */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcode}
        />

        {/* Dark overlay with transparent cut-out */}
        <View style={styles.overlayTop} />
        <View style={styles.overlayRow}>
          <View style={styles.overlaySide} />
          <View style={styles.scanFrame}>
            {/* Corner marks */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Instructions */}
      <View style={styles.bottomArea}>
        <Text style={styles.hint}>{t('mobile.scan.hint')}</Text>
        <Text style={styles.subHint}>{t('mobile.scan.subHint')}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const FRAME_SIZE = 240;
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111827', padding: spacing.lg,
  },
  permIcon: { fontSize: 48, marginBottom: 16 },
  permTitle: { fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: '#fff', marginBottom: 8, textAlign: 'center' },
  permBody: { fontSize: fontSize.body, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  permBtn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    paddingHorizontal: 32, paddingVertical: 14, marginBottom: 12,
  },
  permBtnText: { color: '#fff', fontSize: fontSize.body, fontWeight: fontWeight.bold },
  cancelLink: { padding: 8 },
  cancelLinkText: { color: 'rgba(255,255,255,0.6)', fontSize: fontSize.body },

  container: { flex: 1, backgroundColor: '#111827' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: spacing.md, paddingBottom: 16,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon: { fontSize: 16, color: '#fff' },
  headerTitle: { fontSize: fontSize.h3, fontWeight: fontWeight.bold, color: '#fff' },

  cameraContainer: { flex: 1 },

  // Overlay: dark areas around the transparent frame
  overlayTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: '20%', backgroundColor: 'rgba(0,0,0,0.65)' },
  overlayBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%', backgroundColor: 'rgba(0,0,0,0.65)' },
  overlayRow:    { position: 'absolute', top: '20%', bottom: '30%', left: 0, right: 0, flexDirection: 'row' },
  overlaySide:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },

  // Transparent scan frame with corner indicators
  scanFrame: {
    width: FRAME_SIZE, height: FRAME_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE,
    borderColor: '#fff', borderWidth: 0,
  },
  cornerTL: { top: 0,  left: 0,  borderTopWidth: CORNER_THICKNESS,  borderLeftWidth: CORNER_THICKNESS },
  cornerTR: { top: 0,  right: 0, borderTopWidth: CORNER_THICKNESS,  borderRightWidth: CORNER_THICKNESS },
  cornerBL: { bottom: 0, left: 0,  borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },

  bottomArea: {
    padding: spacing.lg, alignItems: 'center',
  },
  hint: {
    fontSize: 15, color: '#fff', fontWeight: fontWeight.semibold,
    textAlign: 'center', marginBottom: 8,
  },
  subHint: {
    fontSize: 12, color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', lineHeight: 18,
  },
});
