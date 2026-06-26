import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';
import { useSubscription } from '../context/SubscriptionContext';

type Props = {
  featureName: string;
  description?: string;
  children: React.ReactNode;
};

/**
 * Renders children when the user has Premium; otherwise shows a compact upsell card.
 */
export default function PremiumFeatureGate({ featureName, description, children }: Props) {
  const { isPremium, isLoading, presentUpgrade } = useSubscription();

  if (isLoading) {
    return (
      <View style={styles.lockedCard}>
        <Text style={styles.lockedTitle}>Loading…</Text>
      </View>
    );
  }

  if (isPremium) {
    return <>{children}</>;
  }

  return (
    <View style={styles.lockedCard}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>PREMIUM</Text>
      </View>
      <Text style={styles.lockedTitle}>{featureName}</Text>
      <Text style={styles.lockedBody}>
        {description ??
          'AI coaching and Gemini-powered search are part of TYL Premium. Workout tracking, your plans, nutrition, and trends stay on Basic.'}
      </Text>
      <TouchableOpacity style={styles.upgradeBtn} onPress={presentUpgrade} activeOpacity={0.88}>
        <Text style={styles.upgradeBtnText}>View Premium</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  lockedCard: {
    backgroundColor: '#161616',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10,
  },
  badgeText: {
    color: AppTheme.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lockedTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  lockedBody: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  upgradeBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '800',
  },
});
