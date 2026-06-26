/**
 * User Data Initializer Service
 * 
 * This service ensures all user data is automatically loaded when a user logs in.
 * It initializes data for all screens and categories.
 */

import { loadUserData, tryRecoverOrphanedUserDataOnDevice } from '../utils/userStorage';
import WellnessDataManager from './WellnessDataManager';
import { notifyUserDataReady } from '../utils/userDataEvents';

interface UserDataState {
  isInitialized: boolean;
  lastInitialized: string | null;
}

class UserDataInitializer {
  private initializationState: UserDataState = {
    isInitialized: false,
    lastInitialized: null,
  };

  /**
   * Initialize all user data when user logs in
   * This should be called after authentication
   */
  async initializeUserData(): Promise<{ keysCopied: number }> {
    console.log('[UserDataInitializer] Initializing user data...');

    let keysCopied = 0;
    try {
      const recovery = await tryRecoverOrphanedUserDataOnDevice();
      keysCopied = recovery.keysCopied;
      if (recovery.recovered) {
        console.log(
          `[UserDataInitializer] Restored ${recovery.keysCopied} local data key(s) from a previous session on this device`
        );
      }

      // Initialize Wellness Data Manager (for AI sync)
      await WellnessDataManager.initialize();
      
      // Load and verify data exists for all categories
      const dataChecks = await Promise.all([
        this.checkDataExists('workoutHistory'),
        this.checkDataExists('meals'),
        this.checkDataExists('savedMeals'),
        this.checkDataExists('nutritionGoals'),
        this.checkDataExists('savedWorkoutPlans'),
        this.checkDataExists('moodEntries'),
        this.checkDataExists('emotionalExercises'),
        this.checkDataExists('breathingExercises'),
        this.checkDataExists('visualizationExercises'),
        this.checkDataExists('mindfulnessExercises'),
        this.checkDataExists('dailyMentalProgress'),
        this.checkDataExists('gratitudeEntries'),
        this.checkDataExists('affirmationEntries'),
        this.checkDataExists('reflectionEntries'),
        this.checkDataExists('dashboardTasks'),
        this.checkDataExists('dailyCheckIn'),
      ]);

      const existingData = dataChecks.filter(Boolean).length;
      console.log(`[UserDataInitializer] Found ${existingData} data categories with existing data`);

      this.initializationState = {
        isInitialized: true,
        lastInitialized: new Date().toISOString(),
      };

      console.log('[UserDataInitializer] User data initialization complete');
      return { keysCopied };
    } catch (error) {
      console.error('[UserDataInitializer] Error initializing user data:', error);
      throw error;
    } finally {
      notifyUserDataReady();
    }
  }

  /**
   * Check if data exists for a given key
   */
  private async checkDataExists(key: string): Promise<boolean> {
    try {
      const data = await loadUserData(key);
      return data !== null && data !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get initialization state
   */
  getInitializationState(): UserDataState {
    return { ...this.initializationState };
  }

  /**
   * Reset initialization state (call on logout)
   */
  reset(): void {
    this.initializationState = {
      isInitialized: false,
      lastInitialized: null,
    };
  }
}

export default new UserDataInitializer();







