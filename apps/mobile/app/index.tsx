import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Turnos</Text>
      <Text style={styles.subtitle}>Work Today. Staff Today.</Text>
      <Text style={styles.badge}>🚧 MVP — Stint 0 Scaffold</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    padding: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: '#94A3B8',
    marginTop: 8,
  },
  badge: {
    marginTop: 32,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    color: '#6366F1',
    fontSize: 13,
    fontWeight: '600',
  },
});
