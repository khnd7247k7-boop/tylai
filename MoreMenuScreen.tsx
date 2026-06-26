import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppTheme } from './src/theme/appVisualTheme';
import { useSubscription } from './src/context/SubscriptionContext';

type MoreTarget =
  | 'settings'
  | 'health'
  | 'spiritual'
  | 'emotional'
  | 'workout'
  | 'nutritionSearch'
  | 'appGuide';

interface MoreMenuScreenProps {
  onOpen: (screen: MoreTarget) => void;
}

const rows: {
  key: MoreTarget | 'premium';
  title: string;
  subtitle: string;
  premiumOnly?: boolean;
}[] = [
  { key: 'appGuide', title: 'App guide', subtitle: 'Quick tour — what each main button does' },
  {
    key: 'premium',
    title: 'TYL Premium',
    subtitle: 'AI Coach, Food coach, and AI Workout builder (Gemini)',
    premiumOnly: true,
  },
  { key: 'settings', title: 'Settings', subtitle: 'Account, subscription, and preferences' },
  {
    key: 'nutritionSearch',
    title: 'Nutrition search (offline)',
    subtitle: 'Local USDA sample — included with Basic',
  },
  {
    key: 'workout',
    title: 'AI Workout builder',
    subtitle: 'Personalized plans from your profile — Premium (Gemini)',
    premiumOnly: true,
  },
  { key: 'health', title: 'Health & Trends', subtitle: 'Charts and Apple Health — included with Basic' },
  { key: 'spiritual', title: 'Spiritual', subtitle: 'Reflection and practice' },
  { key: 'emotional', title: 'Emotional', subtitle: 'Mood and journaling' },
];

export default function MoreMenuScreen({ onOpen }: MoreMenuScreenProps) {
  const { isPremium, presentUpgrade } = useSubscription();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Tools and settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {rows.map((row) => (
          <TouchableOpacity
            key={row.key}
            style={styles.row}
            onPress={() => {
              if (row.key === 'premium') {
                presentUpgrade();
                return;
              }
              if (row.premiumOnly && !isPremium) {
                presentUpgrade();
                return;
              }
              onOpen(row.key);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.rowTitleRow}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              {row.premiumOnly && !isPremium ? (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>Premium</Text>
                </View>
              ) : null}
              {row.premiumOnly && isPremium ? (
                <View style={[styles.premiumBadge, styles.premiumBadgeActive]}>
                  <Text style={[styles.premiumBadgeText, styles.premiumBadgeTextActive]}>Active</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AppTheme.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: AppTheme.textMuted,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusRow,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: AppTheme.textPrimary,
    flex: 1,
  },
  rowSubtitle: {
    fontSize: 13,
    color: AppTheme.textMuted,
    marginTop: 4,
  },
  premiumBadge: {
    backgroundColor: 'rgba(0, 255, 136, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.35)',
  },
  premiumBadgeActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.22)',
  },
  premiumBadgeText: {
    color: AppTheme.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  premiumBadgeTextActive: {
    color: '#111',
  },
});
