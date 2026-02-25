import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HealthService from './src/services/HealthService';
import { loadUserData } from './src/utils/userStorage';
import { loadUserData as loadWorkoutHistory } from './src/utils/userStorage';

interface HealthTrends {
  averageWorkoutHeartRate: number | null;
  weeklyCalories: number;
  weeklySteps: number;
  weeklyDistance: number;
  last7DaysHeartRate: Array<{ date: string; avg: number }>;
}

interface WorkoutHistory {
  id: string;
  date: string;
  name: string;
  duration: number;
  exercises: number;
}

interface HealthScreenProps {
  onBack: () => void;
}

export default function HealthScreen({ onBack }: HealthScreenProps) {
  const [healthTrends, setHealthTrends] = useState<HealthTrends | null>(null);
  const [loadingHealthData, setLoadingHealthData] = useState(false);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistory[]>([]);

  useEffect(() => {
    loadWorkoutHistoryData();
    loadHealthTrends();
  }, []);

  // Refresh health data when app comes back into focus
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadHealthTrends();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const loadWorkoutHistoryData = async () => {
    try {
      const history = await loadWorkoutHistory<WorkoutHistory[]>('workoutHistory');
      if (history) {
        setWorkoutHistory(history);
      }
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
  };

  const loadHealthTrends = async () => {
    setLoadingHealthData(true);
    try {
      // Check if health data sync is enabled in settings
      const { loadUserData } = await import('./src/utils/userStorage');
      const appSettings = await loadUserData<any>('appSettings');
      const healthDataSyncEnabled = appSettings?.healthDataSyncEnabled !== false;
      
      if (!healthDataSyncEnabled) {
        setHealthTrends({
          averageWorkoutHeartRate: null,
          weeklyCalories: 0,
          weeklySteps: 0,
          weeklyDistance: 0,
          last7DaysHeartRate: [],
        });
        setLoadingHealthData(false);
        return;
      }

      // Request permissions first
      const hasPermissions = await HealthService.requestPermissions();
      if (!hasPermissions) {
        setHealthTrends({
          averageWorkoutHeartRate: null,
          weeklyCalories: 0,
          weeklySteps: 0,
          weeklyDistance: 0,
          last7DaysHeartRate: [],
        });
        setLoadingHealthData(false);
        return;
      }

      // Get last 7 days of data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Get historical health data
      const historicalData = await HealthService.getHistoricalHealthData(startDate, endDate);

      // Calculate weekly totals
      const weeklyCalories = historicalData.calories.reduce((sum, item) => sum + item.value, 0);
      const weeklySteps = historicalData.steps.reduce((sum, item) => sum + item.value, 0);
      const weeklyDistance = historicalData.distance.reduce((sum, item) => sum + item.value, 0);

      // Get average heart rate during workouts
      const workoutSessions = workoutHistory
        .filter(session => {
          const sessionDate = new Date(session.date);
          return sessionDate >= startDate && sessionDate <= endDate;
        })
        .map(session => ({
          date: session.date,
          duration: session.duration || 0,
        }));

      const averageWorkoutHeartRate = workoutSessions.length > 0
        ? await HealthService.getAverageHeartRateDuringWorkouts(workoutSessions)
        : null;

      // Group heart rate data by day for the last 7 days
      const dailyHeartRateMap = new Map<string, number[]>();
      historicalData.heartRate.forEach(point => {
        const dateKey = point.timestamp.toISOString().split('T')[0];
        if (!dailyHeartRateMap.has(dateKey)) {
          dailyHeartRateMap.set(dateKey, []);
        }
        dailyHeartRateMap.get(dateKey)!.push(point.value);
      });

      // Calculate average heart rate per day
      const last7DaysHeartRate: Array<{ date: string; avg: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        const heartRates = dailyHeartRateMap.get(dateKey) || [];
        const avg = heartRates.length > 0
          ? Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length)
          : 0;
        last7DaysHeartRate.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          avg,
        });
      }

      setHealthTrends({
        averageWorkoutHeartRate,
        weeklyCalories: Math.round(weeklyCalories),
        weeklySteps: Math.round(weeklySteps),
        weeklyDistance: Math.round(weeklyDistance * 10) / 10,
        last7DaysHeartRate,
      });
    } catch (error) {
      console.error('Error loading health trends:', error);
      setHealthTrends({
        averageWorkoutHeartRate: null,
        weeklyCalories: 0,
        weeklySteps: 0,
        weeklyDistance: 0,
        last7DaysHeartRate: [],
      });
    } finally {
      setLoadingHealthData(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.healthHeader}>
          <Text style={styles.sectionTitle}>Health Trends</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadHealthTrends}
            disabled={loadingHealthData}
          >
            <Text style={styles.refreshButtonText}>
              {loadingHealthData ? 'Loading...' : '↻ Refresh'}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingHealthData ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Loading health data...</Text>
          </View>
        ) : !healthTrends || (healthTrends.weeklyCalories === 0 && healthTrends.weeklySteps === 0 && healthTrends.averageWorkoutHeartRate === null) ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No health data available</Text>
            <Text style={styles.emptyStateSubtext}>
              Enable "Watch & Health Data Sync" in Settings → Settings → Permissions, then tap Refresh to sync data from your smartwatch and health apps
            </Text>
          </View>
        ) : (
          <>
            {/* Average Workout Heart Rate */}
            {healthTrends.averageWorkoutHeartRate !== null && (
              <View style={styles.healthCard}>
                <Text style={styles.healthCardTitle}>Average Workout Heart Rate</Text>
                <Text style={styles.healthCardValue}>
                  {healthTrends.averageWorkoutHeartRate} bpm
                </Text>
                <Text style={styles.healthCardSubtext}>
                  Based on your recent workouts
                </Text>
              </View>
            )}

            {/* Weekly Summary */}
            <View style={styles.healthCard}>
              <Text style={styles.healthCardTitle}>This Week</Text>
              <View style={styles.healthSummaryRow}>
                <View style={styles.healthSummaryItem}>
                  <Text style={styles.healthSummaryValue}>
                    {healthTrends.weeklyCalories.toLocaleString()}
                  </Text>
                  <Text style={styles.healthSummaryLabel}>Calories</Text>
                </View>
                <View style={styles.healthSummaryItem}>
                  <Text style={styles.healthSummaryValue}>
                    {healthTrends.weeklySteps.toLocaleString()}
                  </Text>
                  <Text style={styles.healthSummaryLabel}>Steps</Text>
                </View>
                <View style={styles.healthSummaryItem}>
                  <Text style={styles.healthSummaryValue}>
                    {healthTrends.weeklyDistance.toFixed(1)}
                  </Text>
                  <Text style={styles.healthSummaryLabel}>Miles</Text>
                </View>
              </View>
            </View>

            {/* Daily Heart Rate Trend */}
            {healthTrends.last7DaysHeartRate.length > 0 && (
              <View style={styles.healthCard}>
                <Text style={styles.healthCardTitle}>Daily Heart Rate Trend</Text>
                <Text style={styles.healthCardSubtext}>Last 7 Days</Text>
                <View style={styles.heartRateTrendContainer}>
                  {healthTrends.last7DaysHeartRate.map((day, index) => {
                    const maxHeartRate = Math.max(
                      ...healthTrends.last7DaysHeartRate.map(d => d.avg).filter(avg => avg > 0),
                      100
                    );
                    const barHeight = day.avg > 0 ? (day.avg / maxHeartRate) * 100 : 0;
                    return (
                      <View key={index} style={styles.heartRateDay}>
                        <View style={styles.heartRateBarContainer}>
                          {day.avg > 0 && (
                            <View
                              style={[
                                styles.heartRateBar,
                                { height: `${barHeight}%` },
                              ]}
                            />
                          )}
                        </View>
                        <Text style={styles.heartRateDayLabel}>{day.date}</Text>
                        <Text style={styles.heartRateDayValue}>
                          {day.avg > 0 ? `${day.avg}` : '-'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 50,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: '#00ff88',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  refreshButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 10,
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  healthCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  healthCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  healthCardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 5,
  },
  healthCardSubtext: {
    fontSize: 14,
    color: '#888',
  },
  healthSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  healthSummaryItem: {
    alignItems: 'center',
  },
  healthSummaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 5,
  },
  healthSummaryLabel: {
    fontSize: 12,
    color: '#888',
  },
  heartRateTrendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginTop: 20,
    height: 150,
  },
  heartRateDay: {
    flex: 1,
    alignItems: 'center',
  },
  heartRateBarContainer: {
    width: '80%',
    height: 100,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  heartRateBar: {
    width: '100%',
    backgroundColor: '#00ff88',
    borderRadius: 4,
    minHeight: 4,
  },
  heartRateDayLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
  },
  heartRateDayValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});


