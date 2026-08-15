/**
 * Health Service for Smartwatch / Apple Health integration.
 *
 * iOS uses the native HealthKit bridge (`HealthKitBridge` → `HealthKitManager`).
 * Expo Go has no HealthKit — use a dev client / TestFlight / App Store build.
 */

import {
  isAnyExpoHealthMetricEnabled,
  isHealthMetricEnabled,
} from '../utils/healthDataPermissions';
import {
  fetchQuantitySamplesNative,
  fetchWorkoutsNative,
  hasHealthKitAuthFlowCompletedNative,
  isHealthDataAvailableNative,
  isHealthKitBridgeAvailable,
  requestHealthKitAuthorizationNative,
  type HealthKitQuantityMetric,
  type HealthKitWorkoutSample,
} from '../native/healthKitBridge';

export interface HealthMetrics {
  averageHeartRate?: number;
  maxHeartRate?: number;
  minHeartRate?: number;
  caloriesBurned?: number;
  steps?: number;
  distance?: number; // in meters
  heartRateZones?: {
    fatBurn: number; // minutes in fat burn zone (50-60% max HR)
    cardio: number;  // minutes in cardio zone (60-70% max HR)
    peak: number;    // minutes in peak zone (80-90% max HR)
  };
}

export interface HeartRateDataPoint {
  value: number;
  timestamp: Date;
}

class HealthService {
  private hasPermissions: boolean = false;
  private estimatedMaxHeartRate: number = 220; // Default, will be calculated based on age if available

  /** Call after user wipes local data so the next permission check re-queries the OS. */
  clearPermissionCache(): void {
    this.hasPermissions = false;
  }

  /**
   * Check if health data sync is enabled in user settings
   */
  async isHealthDataSyncEnabled(): Promise<boolean> {
    try {
      const { loadUserData } = await import('../utils/userStorage');
      const appSettings = await loadUserData<any>('appSettings');
      // Default to true if setting doesn't exist (for backward compatibility)
      return appSettings?.healthDataSyncEnabled !== false;
    } catch (error) {
      console.warn('Error checking health data sync setting:', error);
      // Default to true if there's an error
      return true;
    }
  }

  /**
   * Request health data permissions from the user.
   * Shows the system Health sheet (first time) and registers TYLAI under
   * Settings → Health → Data Access & Devices.
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (!(await this.isHealthDataSyncEnabled())) {
        return false;
      }
      if (!(await isAnyExpoHealthMetricEnabled())) {
        return false;
      }
      if (!isHealthKitBridgeAvailable()) {
        console.warn(
          '[HealthService] HealthKit bridge unavailable (Expo Go or missing native module). Use a device build.'
        );
        return false;
      }
      if (!(await isHealthDataAvailableNative())) {
        return false;
      }

      const ok = await requestHealthKitAuthorizationNative();
      this.hasPermissions = ok;
      return ok;
    } catch (error) {
      console.warn('Health permissions not available:', error);
      return false;
    }
  }

  /**
   * Check if health permissions have been granted.
   * Apple does not reliably expose per-type *read* grants, so we treat a completed
   * auth flow as sufficient to attempt reads.
   */
  async checkPermissions(): Promise<boolean> {
    if (!(await isAnyExpoHealthMetricEnabled())) {
      this.hasPermissions = false;
      return false;
    }

    if (this.hasPermissions) return true;

    try {
      if (!isHealthKitBridgeAvailable()) {
        this.hasPermissions = false;
        return false;
      }
      if (!(await isHealthDataAvailableNative())) {
        this.hasPermissions = false;
        return false;
      }
      const completed = await hasHealthKitAuthFlowCompletedNative();
      this.hasPermissions = completed;
      return completed;
    } catch {
      return false;
    }
  }

  private async readQuantitySamples(
    metric: HealthKitQuantityMetric,
    startTime: Date,
    endTime: Date
  ): Promise<Array<{ value: number; timestamp: Date }>> {
    const samples = await fetchQuantitySamplesNative(metric, startTime, endTime);
    return samples.map((s) => ({
      value: s.value,
      timestamp: new Date(s.dateMs),
    }));
  }

  /**
   * Get heart rate data for a specific time range
   */
  async getHeartRateData(
    startTime: Date,
    endTime: Date
  ): Promise<HeartRateDataPoint[]> {
    try {
      if (!(await this.isHealthDataSyncEnabled())) {
        return [];
      }
      if (!(await isHealthMetricEnabled('heartRate'))) {
        return [];
      }

      if (!(await this.checkPermissions())) {
        return [];
      }

      return this.readQuantitySamples('heartRate', startTime, endTime);
    } catch (error) {
      console.error('Error fetching heart rate data:', error);
      return [];
    }
  }

  /**
   * Get calories burned during a workout
   */
  async getCaloriesBurned(
    startTime: Date,
    endTime: Date
  ): Promise<number> {
    try {
      if (!(await this.isHealthDataSyncEnabled())) {
        return 0;
      }
      if (!(await isHealthMetricEnabled('activeEnergy'))) {
        return 0;
      }

      if (!(await this.checkPermissions())) {
        return 0;
      }

      const samples = await this.readQuantitySamples('activeEnergy', startTime, endTime);
      return samples.reduce((total, entry) => total + (entry.value || 0), 0);
    } catch (error) {
      console.error('Error fetching calories:', error);
      return 0;
    }
  }

  /**
   * Get steps taken during a workout
   */
  async getSteps(
    startTime: Date,
    endTime: Date
  ): Promise<number> {
    try {
      if (!(await this.isHealthDataSyncEnabled())) {
        return 0;
      }
      if (!(await isHealthMetricEnabled('steps'))) {
        return 0;
      }

      if (!(await this.checkPermissions())) {
        return 0;
      }

      const samples = await this.readQuantitySamples('steps', startTime, endTime);
      return samples.reduce((total, entry) => total + (entry.value || 0), 0);
    } catch (error) {
      console.error('Error fetching steps:', error);
      return 0;
    }
  }

  /**
   * Get distance traveled during a workout (in meters)
   */
  async getDistance(
    startTime: Date,
    endTime: Date
  ): Promise<number> {
    try {
      if (!(await this.isHealthDataSyncEnabled())) {
        return 0;
      }
      if (!(await isHealthMetricEnabled('distance'))) {
        return 0;
      }

      if (!(await this.checkPermissions())) {
        return 0;
      }

      const samples = await this.readQuantitySamples('distance', startTime, endTime);
      return samples.reduce((total, entry) => total + (entry.value || 0), 0);
    } catch (error) {
      console.error('Error fetching distance:', error);
      return 0;
    }
  }

  /**
   * Calculate heart rate zones based on estimated max heart rate
   */
  private calculateHeartRateZones(heartRateData: HeartRateDataPoint[]): {
    fatBurn: number;
    cardio: number;
    peak: number;
  } {
    if (heartRateData.length === 0) {
      return { fatBurn: 0, cardio: 0, peak: 0 };
    }

    const maxHR = this.estimatedMaxHeartRate;
    const fatBurnMin = maxHR * 0.5;
    const fatBurnMax = maxHR * 0.6;
    const cardioMin = maxHR * 0.6;
    const cardioMax = maxHR * 0.7;
    const peakMin = maxHR * 0.8;
    const peakMax = maxHR * 0.9;

    // Count minutes in each zone (assuming 1 data point per minute)
    let fatBurn = 0;
    let cardio = 0;
    let peak = 0;

    heartRateData.forEach(point => {
      const hr = point.value;
      if (hr >= fatBurnMin && hr < fatBurnMax) {
        fatBurn++;
      } else if (hr >= cardioMin && hr < cardioMax) {
        cardio++;
      } else if (hr >= peakMin && hr <= peakMax) {
        peak++;
      }
    });

    return { fatBurn, cardio, peak };
  }

  /**
   * Get comprehensive health metrics for a workout
   */
  async getWorkoutMetrics(
    startTime: Date,
    endTime: Date,
    userAge?: number
  ): Promise<HealthMetrics> {
    try {
      if (!(await this.isHealthDataSyncEnabled())) {
        return {};
      }

      if (!(await isAnyExpoHealthMetricEnabled())) {
        return {};
      }

      if (!(await this.checkPermissions())) {
        return {};
      }

      // Calculate estimated max heart rate if age is provided
      if (userAge) {
        this.estimatedMaxHeartRate = 220 - userAge;
      }

      const [heartRateData, calories, steps, distance] = await Promise.all([
        this.getHeartRateData(startTime, endTime),
        this.getCaloriesBurned(startTime, endTime),
        this.getSteps(startTime, endTime),
        this.getDistance(startTime, endTime),
      ]);

      // Calculate heart rate statistics
      let averageHeartRate: number | undefined;
      let maxHeartRate: number | undefined;
      let minHeartRate: number | undefined;

      if (heartRateData.length > 0) {
        const values = heartRateData.map(point => point.value);
        averageHeartRate = Math.round(
          values.reduce((sum, val) => sum + val, 0) / values.length
        );
        maxHeartRate = Math.max(...values);
        minHeartRate = Math.min(...values);
      }

      // Calculate heart rate zones
      const heartRateZones = this.calculateHeartRateZones(heartRateData);

      return {
        averageHeartRate,
        maxHeartRate,
        minHeartRate,
        caloriesBurned: Math.round(calories),
        steps: Math.round(steps),
        distance: Math.round(distance),
        heartRateZones,
      };
    } catch (error) {
      console.error('Error fetching workout metrics:', error);
      return {};
    }
  }

  /**
   * Get real-time heart rate (if available)
   * Note: This may not be available on all devices/platforms
   */
  async getCurrentHeartRate(): Promise<number | null> {
    try {
      if (!(await this.isHealthDataSyncEnabled())) {
        return null;
      }
      if (!(await isHealthMetricEnabled('heartRate'))) {
        return null;
      }

      if (!(await this.checkPermissions())) {
        return null;
      }

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const recentData = await this.getHeartRateData(oneMinuteAgo, now);
      
      if (recentData.length === 0) {
        return null;
      }

      // Return the most recent heart rate
      const sorted = recentData.sort((a, b) => 
        b.timestamp.getTime() - a.timestamp.getTime()
      );
      return sorted[0].value;
    } catch (error) {
      console.error('Error fetching current heart rate:', error);
      return null;
    }
  }

  /**
   * Get historical health data for a date range
   */
  async getHistoricalHealthData(
    startDate: Date,
    endDate: Date
  ): Promise<{
    heartRate: HeartRateDataPoint[];
    calories: Array<{ date: Date; value: number }>;
    steps: Array<{ date: Date; value: number }>;
    distance: Array<{ date: Date; value: number }>;
  }> {
    try {
      if (!(await this.isHealthDataSyncEnabled())) {
        return {
          heartRate: [],
          calories: [],
          steps: [],
          distance: [],
        };
      }

      if (!(await isAnyExpoHealthMetricEnabled())) {
        return { heartRate: [], calories: [], steps: [], distance: [] };
      }

      if (!(await this.checkPermissions())) {
        return { heartRate: [], calories: [], steps: [], distance: [] };
      }

      const [heartRateData, caloriesData, stepsData, distanceData] = await Promise.all([
        this.getHeartRateData(startDate, endDate),
        this.getCaloriesBurnedByDay(startDate, endDate),
        this.getStepsByDay(startDate, endDate),
        this.getDistanceByDay(startDate, endDate),
      ]);

      return {
        heartRate: heartRateData,
        calories: caloriesData,
        steps: stepsData,
        distance: distanceData,
      };
    } catch (error) {
      console.error('Error fetching historical health data:', error);
      return { heartRate: [], calories: [], steps: [], distance: [] };
    }
  }

  /**
   * Get calories burned grouped by day
   */
  private groupSamplesByDay(
    samples: Array<{ value: number; timestamp: Date }>
  ): Array<{ date: Date; value: number }> {
    const daily = new Map<string, number>();
    samples.forEach((entry) => {
      const date = entry.timestamp;
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      daily.set(dateKey, (daily.get(dateKey) || 0) + (entry.value || 0));
    });
    return Array.from(daily.entries()).map(([dateKey, value]) => ({
      date: new Date(`${dateKey}T12:00:00`),
      value: Math.round(value),
    }));
  }

  private async getCaloriesBurnedByDay(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: Date; value: number }>> {
    try {
      if (!(await isHealthMetricEnabled('activeEnergy'))) return [];
      const samples = await this.readQuantitySamples('activeEnergy', startDate, endDate);
      return this.groupSamplesByDay(samples);
    } catch (error) {
      console.error('Error fetching daily calories:', error);
      return [];
    }
  }

  /**
   * Get steps grouped by day
   */
  private async getStepsByDay(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: Date; value: number }>> {
    try {
      if (!(await isHealthMetricEnabled('steps'))) return [];
      const samples = await this.readQuantitySamples('steps', startDate, endDate);
      return this.groupSamplesByDay(samples);
    } catch (error) {
      console.error('Error fetching daily steps:', error);
      return [];
    }
  }

  /**
   * Get distance grouped by day
   */
  private async getDistanceByDay(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: Date; value: number }>> {
    try {
      if (!(await isHealthMetricEnabled('distance'))) return [];
      const samples = await this.readQuantitySamples('distance', startDate, endDate);
      return this.groupSamplesByDay(samples);
    } catch (error) {
      console.error('Error fetching daily distance:', error);
      return [];
    }
  }

  /**
   * Calculate average heart rate during workout periods
   * Uses workout history to identify workout time periods
   */
  async getAverageHeartRateDuringWorkouts(
    workoutSessions: Array<{ date: string; duration: number }>
  ): Promise<number | null> {
    try {
      if (!(await this.isHealthDataSyncEnabled())) {
        return null;
      }
      if (!(await isHealthMetricEnabled('heartRate'))) {
        return null;
      }

      if (!(await this.checkPermissions()) || workoutSessions.length === 0) {
        return null;
      }

      const allHeartRates: number[] = [];

      for (const session of workoutSessions) {
        const workoutStart = new Date(session.date);
        const workoutEnd = new Date(workoutStart.getTime() + session.duration * 60 * 1000);

        const heartRateData = await this.getHeartRateData(workoutStart, workoutEnd);
        const heartRates = heartRateData.map(point => point.value);
        allHeartRates.push(...heartRates);
      }

      if (allHeartRates.length === 0) {
        return null;
      }

      const average = allHeartRates.reduce((sum, hr) => sum + hr, 0) / allHeartRates.length;
      return Math.round(average);
    } catch (error) {
      console.error('Error calculating average workout heart rate:', error);
      return null;
    }
  }

  /**
   * Mindful minutes for **today** (device local calendar day) from HealthKit mindful sessions.
   * Only a numeric aggregate crosses the JS bridge — no per-session timestamps or identifiers.
   */
  async getMindfulMinutesTodayLocal(): Promise<{
    minutes: number;
    known: boolean;
    source: 'healthkit_aggregate' | 'unavailable';
  }> {
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'ios') {
        return { minutes: 0, known: false, source: 'unavailable' };
      }
      const { fetchMindfulMinutesForDateNative } = await import('../native/mindfulMinutesBridge');
      const raw = await fetchMindfulMinutesForDateNative(new Date());
      if (raw === null) {
        return { minutes: 0, known: false, source: 'unavailable' };
      }
      const rounded = Math.round(raw * 10) / 10;
      return { minutes: rounded, known: true, source: 'healthkit_aggregate' };
    } catch {
      return { minutes: 0, known: false, source: 'unavailable' };
    }
  }

  /**
   * Import body-weight samples from Apple Health (smart scales, Health manual entries, etc.).
   * Returns merged entries and how many new days were added (existing manual entries are kept).
   */
  async syncBodyWeightFromAppleHealth(daysBack = 90): Promise<{
    imported: number;
    added: number;
    merged: import('../utils/workoutHistoryChartData').WeightEntry[];
  }> {
    const empty = {
      imported: 0,
      added: 0,
      merged: [] as import('../utils/workoutHistoryChartData').WeightEntry[],
    };
    try {
      const { Platform } = await import('react-native');
      if (Platform.OS !== 'ios') return empty;
      if (!(await this.isHealthDataSyncEnabled())) return empty;
      if (!(await isHealthMetricEnabled('bodyMass'))) return empty;

      await this.requestPermissions();

      const { fetchBodyMassSamplesSinceDaysNative } = await import('../native/bodyMassBridge');
      const { loadUserData } = await import('../utils/userStorage');
      const { mergeWeightEntriesFromHealth } = await import('../utils/weightSync');

      const samples = await fetchBodyMassSamplesSinceDaysNative(daysBack);
      if (samples.length === 0) return empty;

      const imported = samples.map((sample) => {
        const date = new Date(sample.dateMs);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return { date: dateKey, weightLbs: sample.weightLbs };
      });

      const existing =
        (await loadUserData<import('../utils/workoutHistoryChartData').WeightEntry[]>('weightEntries')) ??
        [];
      const { merged, added } = mergeWeightEntriesFromHealth(existing, imported);

      if (added > 0) {
        const { saveUserData } = await import('../utils/userStorage');
        await saveUserData('weightEntries', merged);
      }

      return { imported: imported.length, added, merged };
    } catch (error) {
      console.warn('[HealthService] Body weight sync failed:', error);
      return empty;
    }
  }

  /**
   * Apple Watch / Health discrete workouts overlapping a window.
   * Used to prefill Track Cardio and merge watch calories/distance with user type + duration.
   */
  async fetchNearbyCardioWorkouts(
    start: Date,
    end: Date
  ): Promise<HealthKitWorkoutSample[]> {
    try {
      if (!(await this.isHealthDataSyncEnabled())) return [];
      if (!isHealthKitBridgeAvailable()) return [];
      if (!(await this.checkPermissions())) return [];
      const rows = await fetchWorkoutsNative(start, end);
      return rows.filter((w) => {
        const label = String(w.activityLabel || '').toLowerCase();
        return !/strength|core|flexibility/.test(label);
      });
    } catch (error) {
      console.warn('[HealthService] fetchNearbyCardioWorkouts failed:', error);
      return [];
    }
  }
}

export default new HealthService();

