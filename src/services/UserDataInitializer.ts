/**
 * User Data Initializer Service
 *
 * Ensures durable user data is recovered and cloud-synced when a user logs in.
 */

import {
  loadUserData,
  tryRecoverOrphanedUserDataOnDevice,
  flushPendingUserDataWrites,
} from '../utils/userStorage';
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
      await flushPendingUserDataWrites();

      const recovery = await tryRecoverOrphanedUserDataOnDevice();
      keysCopied = recovery.keysCopied;
      if (recovery.recovered) {
        console.log(
          `[UserDataInitializer] Restored ${recovery.keysCopied} local data key(s) from a previous session on this device`
        );
      }

      // Pull durable user saves from Firestore (workouts, meals, history, settings, …).
      // Cap wait time — offline Firestore getDoc can hang and used to block app boot.
      try {
        const { syncCloudSyncedKeysFromServer, scheduleBackgroundCloudSync } = await import(
          './userCloudSync'
        );
        const cloud = await Promise.race([
          syncCloudSyncedKeysFromServer(),
          new Promise<{ updatedKeys: string[] }>((resolve) =>
            setTimeout(() => {
              console.warn('[UserDataInitializer] Cloud sync timed out; continuing with local data');
              resolve({ updatedKeys: [] });
            }, 10000)
          ),
        ]);
        if (cloud.updatedKeys.length > 0) {
          console.log(
            `[UserDataInitializer] Synced from cloud: ${cloud.updatedKeys.join(', ')}`
          );
        }
        // Finish any remaining keys after UI is up.
        scheduleBackgroundCloudSync();
      } catch (syncError) {
        console.warn('[UserDataInitializer] Cloud sync skipped', syncError);
      }

      await flushPendingUserDataWrites();

      await WellnessDataManager.initialize();

      const dataChecks = await Promise.all([
        this.checkDataExists('workoutHistory'),
        this.checkDataExists('meals'),
        this.checkDataExists('savedMeals'),
        this.checkDataExists('nutritionGoals'),
        this.checkDataExists('savedWorkoutPlans'),
        this.checkDataExists('activeWorkoutPlans'),
        this.checkDataExists('moodEntries'),
        this.checkDataExists('emotionalExercises'),
        this.checkDataExists('mentalExercises'),
        this.checkDataExists('dailyMentalProgress'),
        this.checkDataExists('gratitudeEntries'),
        this.checkDataExists('affirmationEntries'),
        this.checkDataExists('reflectionEntries'),
        this.checkDataExists('userProfile'),
        this.checkDataExists('coachingProfile'),
        this.checkDataExists('completedTasks'),
        this.checkDataExists('weightEntries'),
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

  private async checkDataExists(key: string): Promise<boolean> {
    try {
      const data = await loadUserData(key);
      return data !== null && data !== undefined;
    } catch {
      return false;
    }
  }

  getInitializationState(): UserDataState {
    return { ...this.initializationState };
  }

  reset(): void {
    this.initializationState = {
      isInitialized: false,
      lastInitialized: null,
    };
  }
}

export default new UserDataInitializer();
