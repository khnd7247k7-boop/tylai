import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppTheme } from './src/theme/appVisualTheme';
import { loadUserData } from './src/utils/userStorage';
import { loadPersistedNutritionGoals } from './src/utils/nutritionGoalsStorage';
import { loadCoachingProfile } from './src/services/CoachingProfileService';
import { resolveTrainingDaysPerWeek } from './src/services/CoachingEngine';
import {
  computeProgressScores,
  type ProgressScoreResult,
} from './src/services/progressScoreService';
import type { WorkoutSession } from './data/workoutPrograms';
import type { LoggedMeal } from './src/utils/loggedMeals';
import {
  weightEntriesToPoints,
  type WeightEntry,
} from './src/utils/workoutHistoryChartData';
import type { UserMilestones } from './src/types/userMilestones';
import { DEFAULT_USER_MILESTONES } from './src/types/userMilestones';
import ProgressJourney, {
  type ProgressJourneyDataBundle,
} from './src/components/progress/ProgressJourney';
import { subscribeUserDataReady } from './src/utils/userDataEvents';

type MoodEntry = { date?: string; sleepQuality?: number };

type ScoreInput = {
  workoutHistory: WorkoutSession[];
  meals: LoggedMeal[];
  nutritionGoals: Awaited<ReturnType<typeof loadPersistedNutritionGoals>>;
  weightEntries: WeightEntry[];
  milestones: UserMilestones;
  completedTasks: Array<{ category?: string; completed?: boolean; date?: string }>;
  moodEntries: MoodEntry[];
  reflectionEntries: Array<{ date?: string }>;
  gratitudeEntries: Array<{ date?: string }>;
  coachingProfile: Awaited<ReturnType<typeof loadCoachingProfile>>;
  daysPerWeek: number;
};

/** Progress is one interactive movie — a shared week cursor rewrites the whole frame. */
export default function ProgressScreen(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<ProgressJourneyDataBundle | null>(null);
  const [baseScoreInput, setBaseScoreInput] = useState<ScoreInput | null>(null);
  const [selectedProgressDate, setSelectedProgressDate] = useState<string | null>(null);

  const loadProgressData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        workoutHistory,
        meals,
        nutritionGoals,
        weightEntries,
        milestones,
        completedTasks,
        moodEntries,
        reflectionEntries,
        gratitudeEntries,
        coachingProfile,
      ] = await Promise.all([
        loadUserData<WorkoutSession[]>('workoutHistory'),
        loadUserData<LoggedMeal[]>('meals'),
        loadPersistedNutritionGoals(),
        loadUserData<WeightEntry[]>('weightEntries'),
        loadUserData<UserMilestones>('userMilestones'),
        loadUserData<Array<{ category?: string; completed?: boolean; date?: string }>>(
          'completedTasks'
        ),
        loadUserData<MoodEntry[]>('moodEntries'),
        loadUserData<Array<{ date?: string }>>('reflectionEntries'),
        loadUserData<Array<{ date?: string }>>('gratitudeEntries'),
        loadCoachingProfile(),
      ]);

      const daysPerWeek = resolveTrainingDaysPerWeek(coachingProfile, null);
      const input: ScoreInput = {
        workoutHistory: workoutHistory ?? [],
        meals: meals ?? [],
        nutritionGoals,
        weightEntries: weightEntries ?? [],
        milestones: milestones ?? DEFAULT_USER_MILESTONES,
        completedTasks: completedTasks ?? [],
        moodEntries: moodEntries ?? [],
        reflectionEntries: reflectionEntries ?? [],
        gratitudeEntries: gratitudeEntries ?? [],
        coachingProfile,
        daysPerWeek,
      };

      setBaseScoreInput(input);
      setBundle({
        workoutHistory: input.workoutHistory,
        meals: input.meals,
        weightEntries: input.weightEntries,
        moodEntries: input.moodEntries,
        reflectionDates: (reflectionEntries ?? [])
          .map((r) => r.date?.slice(0, 10))
          .filter((d): d is string => !!d),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgressData();
    return subscribeUserDataReady(loadProgressData);
  }, [loadProgressData]);

  const progressResult: ProgressScoreResult | null = useMemo(() => {
    if (!baseScoreInput) return null;
    if (!selectedProgressDate) return computeProgressScores(baseScoreInput);
    return computeProgressScores({
      ...baseScoreInput,
      referenceDate: new Date(`${selectedProgressDate}T12:00:00`),
    });
  }, [baseScoreInput, selectedProgressDate]);

  const weightSeries = useMemo(
    () => weightEntriesToPoints(baseScoreInput?.weightEntries ?? []),
    [baseScoreInput?.weightEntries]
  );

  const handleProgressDateChange = useCallback((date: string | null) => {
    setSelectedProgressDate((prev) => {
      const next = date?.slice(0, 10) ?? null;
      return prev === next ? prev : next;
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
        <Text style={styles.subtitle}>Scrub through your transformation</Text>
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading && !progressResult ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={AppTheme.accent} />
          </View>
        ) : progressResult ? (
          <ProgressJourney
            progressResult={progressResult}
            weightSeries={weightSeries}
            dataBundle={bundle}
            selectedProgressDate={selectedProgressDate}
            onProgressDateChange={handleProgressDateChange}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppTheme.bgScreen },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: AppTheme.textPrimary },
  subtitle: {
    fontSize: 14,
    color: AppTheme.textMuted,
    marginTop: 4,
    lineHeight: 20,
  },
  contentScroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  loadingWrap: { paddingVertical: 48, alignItems: 'center' },
});
