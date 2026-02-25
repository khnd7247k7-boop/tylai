/**
 * Health Service for Smartwatch Integration
 * 
 * Provides access to health data from Apple Watch (HealthKit) and Android wearables (Google Fit)
 * using expo-health package.
 */

// Note: This service uses expo-health which needs to be installed
// Run: npx expo install expo-health

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
   * Request health data permissions from the user
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // Dynamic import to avoid errors if package isn't installed
      const Health = await import('expo-health');
      
      const permissions = await Health.requestPermissionsAsync({
        permissions: [
          'steps',
          'heartRate',
          'activeEnergy',
          'distance',
        ],
      });

      this.hasPermissions = 
        permissions.status === 'granted' ||
        (permissions.permissions?.steps === 'granted' &&
         permissions.permissions?.heartRate === 'granted');

      return this.hasPermissions;
    } catch (error) {
      console.warn('Health permissions not available:', error);
      console.warn('Install expo-health: npx expo install expo-health');
      return false;
    }
  }

  /**
   * Check if health permissions have been granted
   */
  async checkPermissions(): Promise<boolean> {
    if (this.hasPermissions) return true;

    try {
      const Health = await import('expo-health');
      const permissions = await Health.getPermissionsAsync();
      
      this.hasPermissions = 
        permissions.status === 'granted' ||
        (permissions.permissions?.steps === 'granted' &&
         permissions.permissions?.heartRate === 'granted');

      return this.hasPermissions;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get heart rate data for a specific time range
   */
  async getHeartRateData(
    startTime: Date,
    endTime: Date
  ): Promise<HeartRateDataPoint[]> {
    try {
      // Check if health data sync is enabled
      if (!(await this.isHealthDataSyncEnabled())) {
        return [];
      }
      
      if (!(await this.checkPermissions())) {
        return [];
      }

      const Health = await import('expo-health');
      const heartRateData = await Health.getHeartRateAsync({
        startDate: startTime,
        endDate: endTime,
      });

      if (!heartRateData || heartRateData.length === 0) {
        return [];
      }

      return heartRateData.map((point: any) => ({
        value: point.value || 0,
        timestamp: new Date(point.startDate || point.timestamp),
      }));
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
      // Check if health data sync is enabled
      if (!(await this.isHealthDataSyncEnabled())) {
        return 0;
      }
      
      if (!(await this.checkPermissions())) {
        return 0;
      }

      const Health = await import('expo-health');
      const caloriesData = await Health.getActiveEnergyAsync({
        startDate: startTime,
        endDate: endTime,
      });

      if (!caloriesData || caloriesData.length === 0) {
        return 0;
      }

      // Sum all calories in the time range
      return caloriesData.reduce((total: number, entry: any) => {
        return total + (entry.value || 0);
      }, 0);
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
      // Check if health data sync is enabled
      if (!(await this.isHealthDataSyncEnabled())) {
        return 0;
      }
      
      if (!(await this.checkPermissions())) {
        return 0;
      }

      const Health = await import('expo-health');
      const stepsData = await Health.getStepsAsync({
        startDate: startTime,
        endDate: endTime,
      });

      if (!stepsData || stepsData.length === 0) {
        return 0;
      }

      // Sum all steps in the time range
      return stepsData.reduce((total: number, entry: any) => {
        return total + (entry.value || 0);
      }, 0);
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
      // Check if health data sync is enabled
      if (!(await this.isHealthDataSyncEnabled())) {
        return 0;
      }
      
      if (!(await this.checkPermissions())) {
        return 0;
      }

      const Health = await import('expo-health');
      const distanceData = await Health.getDistanceAsync({
        startDate: startTime,
        endDate: endTime,
      });

      if (!distanceData || distanceData.length === 0) {
        return 0;
      }

      // Sum all distance in the time range (already in meters)
      return distanceData.reduce((total: number, entry: any) => {
        return total + (entry.value || 0);
      }, 0);
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
      // Check if health data sync is enabled
      if (!(await this.isHealthDataSyncEnabled())) {
        return {};
      }
      
      if (!(await this.checkPermissions())) {
        return {};
      }

      // Calculate estimated max heart rate if age is provided
      if (userAge) {
        this.estimatedMaxHeartRate = 220 - userAge;
      }

      // Fetch all metrics in parallel
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
      // Check if health data sync is enabled
      if (!(await this.isHealthDataSyncEnabled())) {
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
      // Check if health data sync is enabled
      if (!(await this.isHealthDataSyncEnabled())) {
        return {
          heartRate: [],
          calories: [],
          steps: [],
          distance: [],
        };
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
  private async getCaloriesBurnedByDay(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: Date; value: number }>> {
    try {
      const Health = await import('expo-health');
      const caloriesData = await Health.getActiveEnergyAsync({
        startDate,
        endDate,
      });

      if (!caloriesData || caloriesData.length === 0) {
        return [];
      }

      // Group by day
      const dailyCalories = new Map<string, number>();
      caloriesData.forEach((entry: any) => {
        const date = new Date(entry.startDate || entry.timestamp);
        const dateKey = date.toISOString().split('T')[0];
        dailyCalories.set(dateKey, (dailyCalories.get(dateKey) || 0) + (entry.value || 0));
      });

      return Array.from(dailyCalories.entries()).map(([dateKey, value]) => ({
        date: new Date(dateKey),
        value: Math.round(value),
      }));
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
      const Health = await import('expo-health');
      const stepsData = await Health.getStepsAsync({
        startDate,
        endDate,
      });

      if (!stepsData || stepsData.length === 0) {
        return [];
      }

      // Group by day
      const dailySteps = new Map<string, number>();
      stepsData.forEach((entry: any) => {
        const date = new Date(entry.startDate || entry.timestamp);
        const dateKey = date.toISOString().split('T')[0];
        dailySteps.set(dateKey, (dailySteps.get(dateKey) || 0) + (entry.value || 0));
      });

      return Array.from(dailySteps.entries()).map(([dateKey, value]) => ({
        date: new Date(dateKey),
        value: Math.round(value),
      }));
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
      const Health = await import('expo-health');
      const distanceData = await Health.getDistanceAsync({
        startDate,
        endDate,
      });

      if (!distanceData || distanceData.length === 0) {
        return [];
      }

      // Group by day
      const dailyDistance = new Map<string, number>();
      distanceData.forEach((entry: any) => {
        const date = new Date(entry.startDate || entry.timestamp);
        const dateKey = date.toISOString().split('T')[0];
        dailyDistance.set(dateKey, (dailyDistance.get(dateKey) || 0) + (entry.value || 0));
      });

      return Array.from(dailyDistance.entries()).map(([dateKey, value]) => ({
        date: new Date(dateKey),
        value: Math.round(value),
      }));
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
      // Check if health data sync is enabled
      if (!(await this.isHealthDataSyncEnabled())) {
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
}

export default new HealthService();

