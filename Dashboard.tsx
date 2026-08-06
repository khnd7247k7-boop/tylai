import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  AppState,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loadUserData, saveUserData } from './src/utils/userStorage';
import { AppTheme } from './src/theme/appVisualTheme';
import { AICoachChat } from './src/components/AICoachChat';
import PremiumFeatureGate from './src/components/PremiumFeatureGate';
import { useSubscription } from './src/context/SubscriptionContext';
import { WorkoutSession } from './data/workoutPrograms';
import {
  COACH_MOCK_HEALTH_KEY,
  type CoachMockHealthSettings,
} from './src/constants/coachMockHealth';
import { type LoggedMeal, filterMealsLoggedToday } from './src/utils/loggedMeals';
import { getProgramWeeksFromSavedPlan, inferScheduleMode, getSuggestedFlexibleRotation, flexibleRotationLabel } from './src/utils/customWorkoutPlan';
import { TOUR_TARGET_IDS } from './src/tour/tourTargets';
import { fireTourTargetIfNeeded } from './src/tour/fireTourTarget';
import { useTourTargetRef } from './src/tour/useTourTargetRef';
import { loadPersistedNutritionGoals } from './src/utils/nutritionGoalsStorage';
import { subscribeUserDataReady } from './src/utils/userDataEvents';
import { isMindsetCheckInDoneToday } from './src/utils/mindsetCheckIn';
import { NotificationCenterModal } from './src/components/NotificationCenterModal';
import {
  clearNotificationCenterEntries,
  countUnreadNotifications,
  deleteNotificationCenterEntry,
  fetchTodayNotificationCenterEntries,
  markNotificationCenterRead,
  subscribeNotificationCenter,
  type NotificationCenterEntry,
} from './src/utils/notificationCenterStore';

interface DashboardProps {
  onLogout: () => void;
  onNavigateToFitness: () => void;
  /** Jump straight into today's workout on the active plan. */
  onStartTodayWorkout: () => void;
  onNavigateToLogFood: () => void;
  onNavigateToHistory: () => void;
  onNavigateToMental: () => void;
  onNavigateToEmotional: () => void;
  onNavigateToAI: () => void;
  onNavigateToSpiritual: () => void;
  onNavigateToHealth: () => void;
  /** Apple Health bento tile — detail fields (not the Trends / charts screen). */
  onNavigateToAppleHealthData: () => void;
}

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function workoutStreak(sessions: WorkoutSession[]): number {
  const keys = new Set(
    sessions.filter((s) => s.completed).map((s) => localDateKey(new Date(s.date)))
  );
  let check = new Date();
  check.setHours(0, 0, 0, 0);
  if (!keys.has(localDateKey(check))) {
    check.setDate(check.getDate() - 1);
  }
  let streak = 0;
  while (keys.has(localDateKey(check))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

function hasWorkoutToday(sessions: WorkoutSession[]): boolean {
  const t = localDateKey(new Date());
  return sessions.some((s) => s.completed && localDateKey(new Date(s.date)) === t);
}

function mondayStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Completed sets logged this calendar week (Mon–Sun) — training volume proxy */
function countWeeklyCompletedSets(sessions: WorkoutSession[]): number {
  const start = mondayStart(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  let n = 0;
  for (const s of sessions) {
    if (!s.completed) continue;
    const dt = new Date(s.date);
    if (dt < start || dt >= end) continue;
    for (const ex of s.exercises || []) {
      for (const st of ex.sets || []) {
        if (st.completed) n += 1;
      }
    }
  }
  return n;
}

function getTodayWorkoutLabel(
  savedPlans: any[],
  activeIds: string[],
  workoutHistory: WorkoutSession[] = []
): string {
  const plan =
    activeIds.map((id) => savedPlans.find((p) => p.id === id)).find(Boolean) || null;
  if (!plan) return 'Workout';

  const weeks = getProgramWeeksFromSavedPlan(plan);
  const weekIndex = Math.max(
    0,
    Math.min(weeks.length - 1, (plan.activeProgramWeek ?? 1) - 1)
  );
  const days = weeks[weekIndex]?.weekDays ?? plan.weeklyPlan?.weekDays;

  if (inferScheduleMode(plan) === 'flexible_days' && days?.length) {
    const suggested = getSuggestedFlexibleRotation(plan, workoutHistory);
    if (suggested) return flexibleRotationLabel(suggested);
    return `${plan.name || 'Workout'} · ${days.length} workouts`;
  }

  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = names[new Date().getDay()];

  if (days?.length) {
    const wd =
      days.find(
        (d: any) => d.dayName && String(d.dayName).toLowerCase() === todayName.toLowerCase()
      ) ||
      days.find((d: any) => {
        const n = Number(d.day);
        return n >= 1 && n <= 7 && names[n % 7] === todayName;
      });
    if (wd?.workoutName) return String(wd.workoutName);
    if (wd?.dayName) return `${plan.name || 'Workout'} — ${String(wd.dayName)}`;
  }
  return plan.name || 'Workout';
}

export default function Dashboard({
  onLogout: _onLogout,
  onNavigateToFitness,
  onStartTodayWorkout,
  onNavigateToLogFood,
  onNavigateToHistory,
  onNavigateToMental,
  onNavigateToEmotional: _onNavigateToEmotional,
  onNavigateToAI: _onNavigateToAI,
  onNavigateToSpiritual: _onNavigateToSpiritual,
  onNavigateToHealth,
  onNavigateToAppleHealthData,
}: DashboardProps) {
  const { isPremium } = useSubscription();
  const startTodayRef = useTourTargetRef(TOUR_TARGET_IDS.startToday);
  const logFoodRef = useTourTargetRef(TOUR_TARGET_IDS.logFood);
  const [focusWorkoutLabel, setFocusWorkoutLabel] = useState('Workout');
  const [caloriesToday, setCaloriesToday] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState(2200);
  const [mindsetDone, setMindsetDone] = useState(false);
  const [workoutDone, setWorkoutDone] = useState(false);
  const [calPct, setCalPct] = useState(0);
  const [weeklySetsLogged, setWeeklySetsLogged] = useState(0);
  const [coachHealthData, setCoachHealthData] = useState<Record<string, unknown>>({});
  const [dailyMindsetPrompt, setDailyMindsetPrompt] = useState<string | null>(null);
  const weeklySetTarget = 60;
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationEntries, setNotificationEntries] = useState<NotificationCenterEntry[]>([]);

  const refreshNotificationCenter = useCallback(async () => {
    const entries = await fetchTodayNotificationCenterEntries();
    setNotificationEntries(entries);
  }, []);

  useEffect(() => {
    void refreshNotificationCenter();
    return subscribeNotificationCenter(() => {
      void refreshNotificationCenter();
    });
  }, [refreshNotificationCenter]);

  const unreadNotificationCount = countUnreadNotifications(notificationEntries);

  const openNotificationCenter = useCallback(async () => {
    setNotificationCenterOpen(true);
    await markNotificationCenterRead();
    await refreshNotificationCenter();
  }, [refreshNotificationCenter]);

  const handleDeleteNotification = useCallback(
    async (id: string) => {
      await deleteNotificationCenterEntry(id);
      await refreshNotificationCenter();
    },
    [refreshNotificationCenter]
  );

  const handleClearAllNotifications = useCallback(async () => {
    await clearNotificationCenterEntries();
    await refreshNotificationCenter();
  }, [refreshNotificationCenter]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    await markNotificationCenterRead();
    await refreshNotificationCenter();
  }, [refreshNotificationCenter]);

  const loadHomeSnapshot = useCallback(async () => {
    try {
      const meals = (await loadUserData<LoggedMeal[]>('meals')) || [];
      const goals = (await loadPersistedNutritionGoals()) || {
        calories: 2200,
        protein: 180,
        carbs: 250,
        fat: 80,
        water: 64,
      };
      const hist = (await loadUserData<WorkoutSession[]>('workoutHistory')) || [];
      const plans = (await loadUserData<any[]>('savedWorkoutPlans')) || [];
      const active = (await loadUserData<string[]>('activeWorkoutPlans')) || [];

      const todayMeals = filterMealsLoggedToday(meals).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const calSum = todayMeals.reduce((a, m) => a + (m.calories || 0), 0);
      const protSum = todayMeals.reduce((a, m) => a + (m.protein || 0), 0);
      const carbsSum = todayMeals.reduce((a, m) => a + (m.carbs || 0), 0);
      const fatSum = todayMeals.reduce((a, m) => a + (m.fat || 0), 0);
      const g = goals || { calories: 2200, protein: 180, carbs: 250, fat: 80, water: 64 };

      setCaloriesToday(calSum);
      setCalorieGoal(Math.max(1, g.calories));
      setCalPct(Math.min(100, Math.round((calSum / Math.max(1, g.calories)) * 100)));

      setFocusWorkoutLabel(getTodayWorkoutLabel(plans, active, hist));
      const mindset = await isMindsetCheckInDoneToday();
      setMindsetDone(mindset);

      const wkToday = hasWorkoutToday(hist);
      const wSets = countWeeklyCompletedSets(hist);
      setWorkoutDone(wkToday);
      setWeeklySetsLogged(wSets);

      const healthEnd = new Date();
      const healthStart = new Date();
      healthStart.setDate(healthStart.getDate() - 7);
      let wearableLast7: Record<string, unknown> = {
        note: 'No samples in range, sync off, or permissions not granted.',
      };
      const HealthService = (await import('./src/services/HealthService')).default;
      try {
        const raw = await HealthService.getHistoricalHealthData(healthStart, healthEnd);
        const hrs = raw.heartRate.map((p) => p.value);
        const avgHr = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;
        wearableLast7 = {
          heartRateSampleCount: raw.heartRate.length,
          heartRateAvgBpmApprox: avgHr,
          activeEnergyKcalTotalApprox: Math.round(raw.calories.reduce((a, c) => a + c.value, 0)),
          stepsTotalApprox: raw.steps.reduce((a, c) => a + c.value, 0),
          distanceMetersTotalApprox: raw.distance.reduce((a, d) => a + d.value, 0),
        };
      } catch {
        wearableLast7 = { note: 'Wearable summary unavailable.' };
      }

      let mindfulBlock: Record<string, unknown> = {
        minutesTodayAggregated: 0,
        dataSource: 'unavailable',
        localDayKey: localDateKey(new Date()),
        aggregationNote: 'sum_mindful_session_duration_over_local_calendar_day_no_raw_events',
      };
      try {
        const m = await HealthService.getMindfulMinutesTodayLocal();
        mindfulBlock = {
          minutesTodayAggregated: m.minutes,
          dataSource: m.source,
          localDayKey: localDateKey(new Date()),
          aggregationNote: 'sum_mindful_session_duration_over_local_calendar_day_no_raw_events',
          nativeReadSucceeded: m.known,
        };
      } catch {
        mindfulBlock = {
          minutesTodayAggregated: 0,
          dataSource: 'unavailable',
          localDayKey: localDateKey(new Date()),
          aggregationNote: 'sum_mindful_session_duration_over_local_calendar_day_no_raw_events',
        };
      }

      try {
        const mockRaw = await loadUserData<Partial<CoachMockHealthSettings>>(COACH_MOCK_HEALTH_KEY);
        if (mockRaw?.enabled) {
          const mins: 0 | 20 = mockRaw.mindfulMinutesMock === 20 ? 20 : 0;
          mindfulBlock = {
            minutesTodayAggregated: mins,
            dataSource: 'healthkit_aggregate',
            localDayKey: localDateKey(new Date()),
            aggregationNote: 'mock_testing_coach_only',
            nativeReadSucceeded: true,
            coachMockHealth: true,
          };
        }
      } catch {
        /* ignore mock read errors */
      }

      const w = wearableLast7 as Record<string, unknown>;
      const recoverySignals = {
        hrvAvailable: false,
        note: 'HRV is not collected in-app; use heart rate and activity summaries only as load proxies.',
        heartRateSamples7d: w.heartRateSampleCount ?? null,
        heartRateAvgBpmApprox7d: w.heartRateAvgBpmApprox ?? null,
        stepsTotalApprox7d: w.stepsTotalApprox ?? null,
        activeEnergyKcalTotalApprox7d: w.activeEnergyKcalTotalApprox ?? null,
      };

      setCoachHealthData({
        generatedAt: new Date().toISOString(),
        appSnapshot: {
          caloriesToday: calSum,
          calorieGoal: g.calories,
          calorieProgressPct: Math.min(100, Math.round((calSum / Math.max(1, g.calories)) * 100)),
          proteinTodayG: protSum,
          proteinGoalG: g.protein,
          carbsTodayG: carbsSum,
          carbsGoalG: g.carbs,
          fatTodayG: fatSum,
          fatGoalG: g.fat,
          workoutStreakDays: workoutStreak(hist),
          workoutCompletedToday: wkToday,
          weeklyCompletedSets: wSets,
          weeklySetTarget,
          mindsetCheckInDone: mindset,
          todayFocusPlanLabel: getTodayWorkoutLabel(plans, active, hist),
        },
        wearableLast7Days: wearableLast7,
        mindful: mindfulBlock,
        recoverySignals,
        coachingContext: await (async () => {
          try {
            const { buildCoachingContextSnapshot } = await import('./src/services/CoachingEngine');
            return await buildCoachingContextSnapshot();
          } catch {
            return { note: 'Coaching context unavailable.' };
          }
        })(),
      });
    } catch (e) {
      console.error('loadHomeSnapshot', e);
    }
  }, []);

  useEffect(() => {
    loadHomeSnapshot();
    return subscribeUserDataReady(() => {
      loadHomeSnapshot();
    });
  }, [loadHomeSnapshot]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadHomeSnapshot();
    });
    return () => sub.remove();
  }, [loadHomeSnapshot]);

  const coachDataVersion = typeof coachHealthData.generatedAt === 'string' ? coachHealthData.generatedAt : '';

  useEffect(() => {
    if (!coachDataVersion || !isPremium) return;
    let cancelled = false;
    (async () => {
      const dayKey = localDateKey(new Date());
      const cacheKey = `aiDailyMindsetPrompt_${dayKey}`;
      try {
        const cached = await loadUserData<string>(cacheKey);
        if (typeof cached === 'string' && cached.trim()) {
          if (!cancelled) setDailyMindsetPrompt(cached.trim());
          return;
        }
        const { sanitizeCoachHealthContext } = await import('./src/utils/healthContextPrivacy');
        const { generateDailyMindsetPrompt } = await import('./src/services/geminiService');
        const safe = sanitizeCoachHealthContext(coachHealthData);
        const prompt = await generateDailyMindsetPrompt(safe);
        if (!cancelled && prompt?.trim()) {
          setDailyMindsetPrompt(prompt.trim());
          await saveUserData(cacheKey, prompt.trim());
        }
      } catch {
        if (!cancelled) setDailyMindsetPrompt(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coachDataVersion, coachHealthData, isPremium]);

  const runOptimizeDay = () => {
    const lines: string[] = [];
    if (calPct < 60 && new Date().getHours() >= 15) {
      lines.push('Calories are still under target for today. Add a balanced meal or snack if you are hungry.');
    }
    if (!workoutDone) {
      lines.push('Movement is still open today. Even a short session counts toward your streak.');
    }
    if (!mindsetDone) {
      lines.push('Mindset is open today. A quick gratitude or breathing exercise still counts.');
    }
    if (lines.length === 0) {
      lines.push('Solid progress today. Stay hydrated, prioritize sleep, and keep the rhythm tomorrow.');
    }
    Alert.alert('Optimize My Day', lines.join('\n\n'));
  };

  const todayNum = new Date().getDate();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.keyboardAvoid}>
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>TylAI Home</Text>
          <View style={styles.headerActions}>
            <View style={styles.headerPill}>
              <Text style={styles.headerPillIcon}>📅</Text>
              <Text style={styles.headerPillText}>
                Dashboard <Text style={styles.headerPillDate}>{todayNum}</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={() => void openNotificationCenter()}
              accessibilityRole="button"
              accessibilityLabel={
                unreadNotificationCount > 0
                  ? `Notifications, ${unreadNotificationCount} unread`
                  : 'Notifications'
              }
            >
              <View style={styles.bellWrap}>
                <Text style={styles.iconBtnText}>🔔</Text>
                {unreadNotificationCount > 0 ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Today's Focus</Text>
        <View style={styles.focusCard}>
          <Text style={styles.focusLine}>
            <Text style={styles.focusKey}>Workout: </Text>
            <Text style={styles.focusVal}>{focusWorkoutLabel}</Text>
          </Text>
          <Text style={styles.focusLine}>
            <Text style={styles.focusKey}>Calories: </Text>
            <Text style={styles.focusVal}>
              {Math.round(caloriesToday).toLocaleString()} / {calorieGoal.toLocaleString()}
            </Text>
          </Text>
          <TouchableOpacity
            style={styles.focusCheckInRow}
            onPress={onNavigateToMental}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={
              mindsetDone ? 'Mental check-in completed. Open mental exercises.' : 'Start mental check-in'
            }
          >
            <Text style={styles.focusLine}>
              <Text style={styles.focusKey}>Mental check-in: </Text>
              <Text
                style={[
                  styles.focusVal,
                  styles.focusCheckInAction,
                  mindsetDone ? styles.focusDone : styles.focusPending,
                ]}
              >
                {mindsetDone ? 'Done' : 'Tap to start'}
              </Text>
            </Text>
            <Text style={styles.focusChevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rule} />

        <View style={styles.gridRow}>
          <TouchableOpacity
            style={[styles.gridTile, styles.tileGreen]}
            ref={startTodayRef}
            onPress={() => {
              onStartTodayWorkout();
              fireTourTargetIfNeeded(TOUR_TARGET_IDS.startToday);
            }}
            activeOpacity={0.85}
            nativeID={TOUR_TARGET_IDS.startToday}
          >
            <Text style={styles.gridIcon}>🏋</Text>
            <Text style={styles.gridLabel}>Start Workout</Text>
            <Text style={styles.gridSubLabel} numberOfLines={2}>
              {focusWorkoutLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gridTile, styles.tileBlue]}
            ref={logFoodRef}
            onPress={() => {
              onNavigateToLogFood();
              fireTourTargetIfNeeded(TOUR_TARGET_IDS.logFood);
            }}
            activeOpacity={0.85}
            nativeID={TOUR_TARGET_IDS.logFood}
          >
            <Text style={styles.gridIcon}>🍽</Text>
            <Text style={styles.gridLabel}>Log Food</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.gridRow}>
          <TouchableOpacity
            style={[styles.gridTile, styles.tileTeal]}
            onPress={onNavigateToHealth}
            activeOpacity={0.85}
          >
            <Text style={styles.gridIcon}>📈</Text>
            <Text style={styles.gridLabel}>Trends</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gridTile, styles.tilePurple]}
            onPress={onNavigateToHistory}
            activeOpacity={0.85}
          >
            <Text style={styles.gridIcon}>📅</Text>
            <Text style={styles.gridLabel}>History</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>AI Coach</Text>
        <View style={styles.coachChatWrap}>
          <PremiumFeatureGate
            featureName="AI Coach"
            description="Chat with your AI wellness coach and daily mindset prompts — powered by Gemini. Included with TYL Premium."
          >
            <AICoachChat
              healthData={coachHealthData}
              dailyMindsetPrompt={dailyMindsetPrompt}
            />
          </PremiumFeatureGate>
        </View>

        <Text style={styles.sectionTitle}>Weekly snapshot</Text>
        <View style={styles.bentoRow}>
          <View style={[styles.bentoCard, styles.bentoCardDark]}>
            <Text style={styles.bentoLabel}>Training volume</Text>
            <Text style={styles.bentoValue}>
              {weeklySetsLogged} / {weeklySetTarget} sets
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(100, Math.round((weeklySetsLogged / Math.max(1, weeklySetTarget)) * 100))}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.bentoFoot}>Completed sets logged this week (Mon–Sun)</Text>
          </View>
          <TouchableOpacity
            style={[styles.bentoCard, styles.bentoCardDark]}
            onPress={onNavigateToAppleHealthData}
            activeOpacity={0.85}
          >
            <Text style={styles.bentoLabel}>Apple Health</Text>
            <Text style={styles.bentoSub}>
              Extra HealthKit metrics will live here. Use Trends for heart rate, sleep & VO₂ charts when sync is on.
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rule} />

        <TouchableOpacity style={styles.optimizeBtn} onPress={runOptimizeDay} activeOpacity={0.85}>
          <Text style={styles.optimizeBtnText}>Optimize My Day</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.mentalLink} onPress={onNavigateToMental} activeOpacity={0.7}>
          <Text style={styles.mentalLinkText}>Open mental exercises</Text>
        </TouchableOpacity>
        </ScrollView>
      </View>

      <NotificationCenterModal
        visible={notificationCenterOpen}
        entries={notificationEntries}
        onClose={() => setNotificationCenterOpen(false)}
        onMarkAllRead={() => {
          void handleMarkAllNotificationsRead();
        }}
        onDeleteEntry={(id) => {
          void handleDeleteNotification(id);
        }}
        onClearAll={() => {
          void handleClearAllNotifications();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  keyboardAvoid: {
    flex: 1,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  coachChatWrap: {
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
    marginRight: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.cardHover,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppTheme.borderMuted,
    marginRight: 4,
  },
  headerPillIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  headerPillText: {
    color: AppTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  headerPillDate: {
    color: AppTheme.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  iconBtn: {
    padding: 4,
    marginLeft: 4,
  },
  bellWrap: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: AppTheme.bgScreen,
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  iconBtnText: {
    fontSize: 18,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: AppTheme.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  focusCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.28)',
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    padding: 10,
    marginBottom: 8,
  },
  focusLine: {
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 17,
    flex: 1,
  },
  focusCheckInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingVertical: 2,
  },
  focusCheckInAction: {
    textDecorationLine: 'underline',
  },
  focusDone: {
    color: AppTheme.accent,
    textDecorationLine: 'none',
  },
  focusChevron: {
    color: AppTheme.textMuted,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  focusKey: {
    color: AppTheme.textMuted,
    fontWeight: '600',
  },
  focusVal: {
    color: '#fff',
    fontWeight: '700',
  },
  focusPending: {
    color: '#fbbf24',
  },
  rule: {
    height: 1,
    backgroundColor: AppTheme.border,
    marginVertical: 8,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  gridTile: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 62,
    borderWidth: 1,
  },
  tileGreen: {
    backgroundColor: 'rgba(0, 255, 136, 0.14)',
    borderColor: 'rgba(0, 255, 136, 0.42)',
  },
  tileBlue: {
    backgroundColor: 'rgba(77, 171, 247, 0.18)',
    borderColor: 'rgba(77, 171, 247, 0.42)',
  },
  tileTeal: {
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    borderColor: 'rgba(34, 211, 238, 0.38)',
  },
  tilePurple: {
    backgroundColor: 'rgba(180, 130, 255, 0.16)',
    borderColor: 'rgba(180, 130, 255, 0.4)',
  },
  gridIcon: {
    fontSize: 20,
    marginBottom: 3,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#f3f4f6',
    textAlign: 'center',
  },
  gridSubLabel: {
    marginTop: 3,
    fontSize: 10,
    color: AppTheme.textMuted,
    textAlign: 'center',
    lineHeight: 13,
  },
  bentoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bentoCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 12,
    padding: 10,
    minHeight: 96,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  bentoCardDark: {
    backgroundColor: AppTheme.card,
  },
  bentoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: AppTheme.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bentoValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  bentoSub: {
    fontSize: 11,
    color: AppTheme.textSecondary,
    lineHeight: 15,
    marginTop: 2,
  },
  bentoFoot: {
    fontSize: 10,
    color: AppTheme.textMuted,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: AppTheme.inputBg,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: AppTheme.accent,
  },
  optimizeBtn: {
    backgroundColor: '#14532d',
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.35)',
  },
  optimizeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e8ffef',
  },
  mentalLink: {
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 2,
  },
  mentalLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4dabf7',
  },
});
