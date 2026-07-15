import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppTheme } from '../../../theme/appVisualTheme';

/** Reserved AI insights surface from the Progress Photos mockup. */
export default function AiInsightsPlaceholder(): React.ReactElement {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.lock}>🔒</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>AI Insights</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Coming Soon</Text>
            </View>
          </View>
          <Text style={styles.body}>
            Photo analysis, posture cues, and transformation notes will appear here — reserved for a
            future update.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderStyle: 'dashed',
    padding: 16,
    marginBottom: 16,
    opacity: 0.9,
  },
  row: { flexDirection: 'row', gap: 12 },
  lock: { fontSize: 20, marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: AppTheme.textPrimary },
  badge: {
    backgroundColor: 'rgba(0,255,136,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: AppTheme.accent },
  body: { fontSize: 13, lineHeight: 18, color: AppTheme.textMuted },
});
