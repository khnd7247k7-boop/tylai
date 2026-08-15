/**
 * Progress-facing Movement Intelligence teaser → opens Premium MI home.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppTheme } from '../../theme/appVisualTheme';
import { loadMovementProfile } from '../../services/MovementIntelligenceService';
import { subscribeUserDataReady } from '../../utils/userDataEvents';
import { useSubscription } from '../../context/SubscriptionContext';

type Props = {
  onOpenFullScreen?: () => void;
};

export default function MovementIntelligenceSection({
  onOpenFullScreen,
}: Props): React.ReactElement {
  const { isPremium, presentUpgrade } = useSubscription();
  const [focusPreview, setFocusPreview] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const profile = await loadMovementProfile();
      setFocusPreview((profile.currentFocusAreas ?? []).slice(0, 3));
    } catch (e) {
      console.warn('MovementIntelligenceSection refresh failed', e);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeUserDataReady(() => {
      void refresh();
    });
  }, [refresh]);

  const open = () => {
    if (!isPremium) {
      presentUpgrade();
      return;
    }
    onOpenFullScreen?.();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Movement Intelligence</Text>
          <Text style={styles.subtitle}>Your training adapts as your body changes.</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Premium</Text>
        </View>
      </View>

      {focusPreview.length > 0 ? (
        <Text style={styles.meta}>Focus: {focusPreview.join(' · ')}</Text>
      ) : (
        <Text style={styles.meta}>See focus areas, adjustments, and why TYL changed a workout.</Text>
      )}

      <TouchableOpacity style={styles.cta} onPress={open} activeOpacity={0.85}>
        <Text style={styles.ctaText}>
          {isPremium ? 'Open Movement Intelligence' : 'Unlock with Premium'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    color: AppTheme.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: AppTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    backgroundColor: 'rgba(0,255,136,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: AppTheme.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  meta: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 18,
  },
  cta: {
    backgroundColor: AppTheme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: AppTheme.accent,
    fontWeight: '800',
    fontSize: 14,
  },
});
