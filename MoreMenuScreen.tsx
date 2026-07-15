import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppTheme } from './src/theme/appVisualTheme';
import { useSubscription } from './src/context/SubscriptionContext';

const SUPPORT_EMAIL = 'travis@tyl-ai.com';

type MoreTarget =
  | 'settings'
  | 'profile'
  | 'interface'
  | 'legal'
  | 'health'
  | 'spiritual'
  | 'emotional'
  | 'mental'
  | 'workout'
  | 'nutritionSearch'
  | 'appGuide';

type RowDef = {
  key: MoreTarget | 'premium' | 'support' | 'feedback';
  title: string;
  subtitle: string;
  premiumOnly?: boolean;
};

type SectionDef = {
  title: string;
  rows: RowDef[];
};

const SECTIONS: SectionDef[] = [
  {
    title: 'Account',
    rows: [
      {
        key: 'premium',
        title: 'TYL Premium',
        subtitle: 'AI Coach, Food coach, and AI Workout builder',
      },
      {
        key: 'profile',
        title: 'Profile',
        subtitle: 'Name, body stats, and coaching questionnaire',
      },
      {
        key: 'settings',
        title: 'Settings',
        subtitle: 'Notifications, preferences, and subscription',
      },
      {
        key: 'interface',
        title: 'Interface',
        subtitle: 'Theme, font size, and display options',
      },
    ],
  },
  {
    title: 'AI Coach',
    rows: [
      {
        key: 'workout',
        title: 'AI Workout Builder',
        subtitle: 'Personalized plans from your coaching profile',
        premiumOnly: true,
      },
      {
        key: 'nutritionSearch',
        title: 'Nutrition Search',
        subtitle: 'Search foods and restaurant menus',
      },
      {
        key: 'health',
        title: 'Health & Trends',
        subtitle: 'Charts, trends, and Apple Health sync',
      },
    ],
  },
  {
    title: 'Wellness',
    rows: [
      { key: 'spiritual', title: 'Spiritual', subtitle: 'Reflection and practice' },
      { key: 'emotional', title: 'Emotional', subtitle: 'Mood and journaling' },
      { key: 'mental', title: 'Mental', subtitle: 'Breathing, visualization, and performance prep' },
    ],
  },
  {
    title: 'Help',
    rows: [
      { key: 'appGuide', title: 'App Guide', subtitle: 'Quick tour of the main tabs' },
      { key: 'legal', title: 'Legal', subtitle: 'Privacy, disclaimers, and licenses' },
      { key: 'support', title: 'Support', subtitle: 'Get help with your account or billing' },
      { key: 'feedback', title: 'Feedback', subtitle: 'Share ideas and report issues' },
    ],
  },
];

interface MoreMenuScreenProps {
  onOpen: (screen: MoreTarget) => void;
}

async function openMail(subject: string, body?: string) {
  const params = new URLSearchParams({ subject });
  if (body) params.set('body', body);
  const url = `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Email us', `${SUPPORT_EMAIL}\n\nSubject: ${subject}`);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Email us', `${SUPPORT_EMAIL}\n\nSubject: ${subject}`);
  }
}

export default function MoreMenuScreen({ onOpen }: MoreMenuScreenProps) {
  const { isPremium, presentUpgrade } = useSubscription();

  const handlePress = (row: RowDef) => {
    if (row.key === 'premium') {
      presentUpgrade();
      return;
    }
    if (row.key === 'support') {
      void openMail('TYL AI Support', 'Hi TYL team,\n\nI need help with:\n\n');
      return;
    }
    if (row.key === 'feedback') {
      void openMail('TYL AI Feedback', 'Hi TYL team,\n\nMy feedback:\n\n');
      return;
    }
    if (row.premiumOnly && !isPremium) {
      presentUpgrade();
      return;
    }
    onOpen(row.key);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Account, tools, and help</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((section, sectionIndex) => (
          <View key={section.title} style={sectionIndex > 0 ? styles.sectionBlock : undefined}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionDivider} />
            {section.rows.map((row, rowIndex) => {
              const isFirst = rowIndex === 0;
              const isLast = rowIndex === section.rows.length - 1;
              return (
              <TouchableOpacity
                key={row.key}
                style={[
                  styles.row,
                  isFirst && styles.rowFirst,
                  isLast && styles.rowLast,
                  !isLast && styles.rowBorder,
                ]}
                onPress={() => handlePress(row)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={row.title}
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
            );
            })}
          </View>
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
    paddingBottom: 12,
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
  sectionBlock: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    letterSpacing: 0.2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AppTheme.border,
    marginBottom: 0,
  },
  row: {
    backgroundColor: AppTheme.card,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: AppTheme.border,
  },
  rowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: AppTheme.radiusRow,
    borderTopRightRadius: AppTheme.radiusRow,
  },
  rowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: AppTheme.radiusRow,
    borderBottomRightRadius: AppTheme.radiusRow,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.border,
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
