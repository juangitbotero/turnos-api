import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors, spacing, radius, fontSize, fontWeight } from '@turnos/shared';

// Mock data matching the feed
const MOCK_SHIFT = {
  id: '1',
  title: 'Bartender',
  description: 'Looking for an experienced bartender for a busy rooftop evening shift. Must know how to mix classic cocktails and handle a fast-paced environment.',
  employerName: 'Rooftop Bar Lisboa',
  grossHourlyRate: 8.5,
  startTime: '18:00',
  endTime: '02:00',
  date: 'Today, 14 Aug',
  address: 'Rua do Alecrim 12, Lisboa',
  coordinate: { latitude: 38.711, longitude: -9.135 },
};

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isApplying, setIsApplying] = useState(false);

  // In a real app, we'd fetch the shift using the ID
  const shift = MOCK_SHIFT;

  const handleApply = async () => {
    setIsApplying(true);
    // TODO: await api.post(`/shifts/${id}/apply`);
    
    // Simulate network delay
    setTimeout(() => {
      setIsApplying(false);
      Alert.alert(
        'Application Sent!', 
        'Your application has been sent to the employer for approval. You will be notified when they respond.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <ScrollView bounces={false}>
        {/* Header Map */}
        <MapView
          style={styles.mapHeader}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            ...shift.coordinate,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker coordinate={shift.coordinate} />
        </MapView>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{shift.title}</Text>
            <Text style={styles.rate}>€{shift.grossHourlyRate.toFixed(2)}/hr</Text>
          </View>
          
          <Text style={styles.employer}>{shift.employerName}</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>{shift.date}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>{shift.startTime} - {shift.endTime}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{shift.address}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>About the Shift</Text>
          <Text style={styles.description}>{shift.description}</Text>
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Estimated Payout</Text>
          {/* Mock 8 hours computation */}
          <Text style={styles.totalValue}>€{(shift.grossHourlyRate * 8).toFixed(2)}</Text>
        </View>
        <TouchableOpacity 
          style={styles.applyBtn} 
          onPress={handleApply}
          disabled={isApplying}
        >
          <Text style={styles.applyBtnText}>
            {isApplying ? 'Applying...' : 'Apply Now'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.secondary,
  },
  mapHeader: {
    height: 200,
    width: '100%',
  },
  content: {
    padding: spacing.xl,
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    marginTop: -20, // Overlap the map
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  rate: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  employer: {
    fontSize: fontSize.body,
    color: '#666',
    marginBottom: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.secondary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.neutral,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: fontSize.caption,
    color: '#888',
  },
  infoValue: {
    fontSize: fontSize.body,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
  },
  sectionTitle: {
    fontSize: fontSize.h3,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSize.body,
    color: '#444',
    lineHeight: 24,
    marginBottom: 100, // Space for bottom bar
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: spacing.md,
    paddingBottom: 40, // Safe area
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.neutral,
  },
  totalBox: {
    flex: 1,
  },
  totalLabel: {
    fontSize: fontSize.caption,
    color: '#888',
  },
  totalValue: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  applyBtnText: {
    fontSize: fontSize.body,
    color: '#fff',
    fontWeight: fontWeight.bold,
  },
});
