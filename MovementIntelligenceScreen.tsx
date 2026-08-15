/**
 * TYL Premium — Movement Intelligence home.
 * Shows how training is adapting from movement + feedback (coach tone, not medical).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppTheme } from './src/theme/appVisualTheme';
import PremiumFeatureGate from './src/components/PremiumFeatureGate';
import {
  loadDiscomfortReports,
  loadLatestAdaptationPlan,
  loadMovementProfile,
  loadPostWorkoutMovementFeedback,
  loadTrainingConstraints,
} from './src/services/MovementIntelligenceService';
import {
  shouldPromptMovementResponseFeedback,
} from './src/services/MovementFeedbackLoopService';
import { subscribeUserDataReady } from './src/utils/userDataEvents';
import {
  buildMovementIntelligenceDashboard,
  type MovementIntelligenceDashboardModel,
} from './src/utils/movementIntelligenceDashboard';
import DiscomfortAssessmentFlow, {
  DiscomfortReportCTA,
} from './src/components/movement/DiscomfortAssessmentFlow';
import MovementResponseFeedbackModal from './src/components/movement/MovementResponseFeedbackModal';

type Props = {
  onBack?: () => void;
};

export default function MovementIntelligenceScreen({ onBack }: Props): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState<MovementIntelligenceDashboardModel | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [responseVisible, setResponseVisible] = useState(false);
  const [canCheckIn, setCanCheckIn] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [profile, constraints, feedback, reports, plan, prompt] = await Promise.all([
        loadMovementProfile(),
        loadTrainingConstraints(),
        loadPostWorkoutMovementFeedback(),
        loadDiscomfortReports(),
        loadLatestAdaptationPlan(),
        shouldPromptMovementResponseFeedback(),
      ]);
      setModel(
        buildMovementIntelligenceDashboard({
          profile,
          constraints,
          feedback,
          reports,
          plan,
        })
      );
      setCanCheckIn(prompt);
    } catch (e) {
      console.warn('[MovementIntelligenceScreen] refresh failed', e);
      setModel(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeUserDataReady(() => {
      void refresh();
    });
  }, [refresh]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={12} accessibilityRole="button">
            <Text style={styles.back}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View style={styles.headerText}>
          <Text style={styles.title}>Movement Intelligence</Text>
          <Text style={styles.subtitle}>Your training adapts as your body changes.</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <PremiumFeatureGate
          featureName="Movement Intelligence"
          description="See how TYL adapts your training from movement check-ins — focus areas, adjustments, and the why behind changes. Part of TYL Premium."
        >
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={AppTheme.accent} size="large" />
            </View>
          ) : (
            <DashboardBody
              model={model}
              canCheckIn={canCheckIn}
              onReport={() => setReportVisible(true)}
              onCheckIn={() => setResponseVisible(true)}
            />
          )}
        </PremiumFeatureGate>
      </ScrollView>

      <DiscomfortAssessmentFlow
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onCompleted={() => {
          setReportVisible(false);
          void refresh();
        }}
      />
      <MovementResponseFeedbackModal
        visible={responseVisible}
        onClose={() => setResponseVisible(false)}
        onDone={() => {
          setResponseVisible(false);
          void refresh();
        }}
      />
    </SafeAreaView>
  );
}

function DashboardBody({
  model,
  canCheckIn,
  onReport,
  onCheckIn,
}: {
  model: MovementIntelligenceDashboardModel | null;
  canCheckIn: boolean;
  onReport: () => void;
  onCheckIn: () => void;
}): React.ReactElement {
  if (!model || !model.hasAnySignal) {
    return (
      <View>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>COACH VIEW</Text>
          <Text style={styles.heroTitle}>No adaptations yet</Text>
          <Text style={styles.heroBody}>
            When you report how a movement feels, TYL builds focus areas and training adjustments
            here — so changes never feel random.
          </Text>
        </View>
        <DiscomfortReportCTA label="Report discomfort" onPress={onReport} />
        <HubPreview items={model?.upcomingHubItems ?? []} />
      </View>
    );
  }

  return (
    <View>
      {model.whyExplanation ? (
        <View style={styles.whyCard}>
          <Text style={styles.whyLabel}>Why this changed</Text>
          <Text style={styles.whyBody}>{model.whyExplanation}</Text>
        </View>
      ) : null}

      <Section title="Current Movement Focus">
        {model.focusAreas.length ? (
          <View style={styles.chipWrap}>
            {model.focusAreas.map((f) => (
              <View key={f.id} style={styles.chip}>
                <Text style={styles.chipText}>{f.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyLine}>Focus areas appear after movement check-ins.</Text>
        )}
      </Section>

      <Section title="Current Training Adjustments">
        {model.adjustments.length ? (
          model.adjustments.map((row) => (
            <View key={row.id} style={styles.adjustRow}>
              <Text style={styles.adjustTitle}>{row.title}</Text>
              <Text style={styles.adjustDetail}>{row.detail}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyLine}>No active modifications right now.</Text>
        )}
      </Section>

      <Section title="Progress">
        {model.trends.length ? (
          model.trends.map((t) => (
            <View key={t.id} style={styles.trendRow}>
              <Text style={styles.trendLabel}>{t.label}</Text>
              <Text style={styles.trendStatus}>{t.status}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyLine}>
            Trends show once there&apos;s enough session feedback — we won&apos;t invent progress.
          </Text>
        )}
      </Section>

      <View style={styles.actions}>
        <DiscomfortReportCTA label="Report discomfort" onPress={onReport} />
        {canCheckIn ? (
          <DiscomfortReportCTA
            compact
            label="How did that movement feel?"
            onPress={onCheckIn}
          />
        ) : null}
      </View>

      <HubPreview items={model.upcomingHubItems} />
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function HubPreview({
  items,
}: {
  items: Array<{ id: string; label: string; locked?: boolean }>;
}): React.ReactElement {
  return (
    <View style={styles.hub}>
      <Text style={styles.hubTitle}>Coming together here</Text>
      <Text style={styles.hubSubtitle}>
        This screen becomes home for your Movement Profile, assessments, form analysis, and
        adaptation history.
      </Text>
      <View style={styles.hubGrid}>
        {items.map((item) => (
          <View key={item.id} style={[styles.hubTile, item.locked && styles.hubTileLocked]}>
            <Text style={styles.hubTileText}>{item.label}</Text>
            {item.locked ? <Text style={styles.hubSoon}>Soon</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppTheme.bgScreen },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  back: {
    color: AppTheme.accent,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  backSpacer: { height: 8 },
  headerText: {},
  title: {
    color: AppTheme.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: AppTheme.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  heroCard: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 18,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: AppTheme.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitle: {
    color: AppTheme.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroBody: {
    color: AppTheme.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  whyCard: {
    backgroundColor: '#121a16',
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.22)',
    padding: 18,
    marginBottom: 18,
  },
  whyLabel: {
    color: AppTheme.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  whyBody: {
    color: AppTheme.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    color: AppTheme.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 16,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: 'rgba(0,255,136,0.12)',
    borderRadius: AppTheme.radiusPill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.25)',
  },
  chipText: {
    color: AppTheme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyLine: {
    color: AppTheme.textFaint,
    fontSize: 14,
    lineHeight: 20,
  },
  adjustRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.border,
  },
  adjustTitle: {
    color: AppTheme.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  adjustDetail: {
    color: AppTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AppTheme.border,
  },
  trendLabel: {
    color: AppTheme.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
  },
  trendStatus: {
    color: AppTheme.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  actions: { marginTop: 4, marginBottom: 8, gap: 4 },
  hub: { marginTop: 12 },
  hubTitle: {
    color: AppTheme.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  hubSubtitle: {
    color: AppTheme.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  hubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hubTile: {
    width: '48%',
    backgroundColor: AppTheme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  hubTileLocked: { opacity: 0.55 },
  hubTileText: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  hubSoon: {
    color: AppTheme.textFaint,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
