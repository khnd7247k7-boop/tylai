/**
 * User Profile Service
 * 
 * Provides access to user profile data for AI workout generation
 */

import { loadUserData } from '../utils/userStorage';

export interface UserProfileData {
  age: string;
  sex: 'male' | 'female' | 'other' | '';
  height: string;
  weight: string;
  trainingExperience: string; // experienceLevel
  primaryGoals: string; // fitnessGoal
  secondaryGoals?: string[];
  injuries?: string;
  limitations?: string;
  daysPerWeek?: number;
  equipmentAvailability?: string;
  preferredWorkoutLength?: number; // in minutes
}

class UserProfileService {
  /**
   * Get complete user profile data for AI workout generation
   */
  async getUserProfileData(): Promise<UserProfileData | null> {
    try {
      const profile = await loadUserData<any>('userProfile');
      if (!profile) return null;

      return {
        age: profile.age || '',
        sex: profile.sex || '',
        height: profile.height || '',
        weight: profile.weight || '',
        trainingExperience: profile.experienceLevel || '',
        primaryGoals: profile.fitnessGoal || '',
        secondaryGoals: profile.secondaryGoals || [],
        injuries: profile.injuries || '',
        limitations: profile.limitations || '',
        daysPerWeek: profile.daysPerWeek || undefined,
        equipmentAvailability: profile.equipmentAvailability || '',
        preferredWorkoutLength: profile.preferredWorkoutLength || undefined,
      };
    } catch (error) {
      console.error('[UserProfileService] Error loading user profile:', error);
      return null;
    }
  }

  /**
   * Get user profile summary for AI context
   */
  async getProfileSummary(): Promise<string> {
    const profile = await this.getUserProfileData();
    if (!profile) return 'No profile data available';

    const parts: string[] = [];

    if (profile.age) parts.push(`Age: ${profile.age}`);
    if (profile.sex) parts.push(`Sex: ${profile.sex}`);
    if (profile.height) parts.push(`Height: ${profile.height}`);
    if (profile.weight) parts.push(`Weight: ${profile.weight}`);
    if (profile.trainingExperience) parts.push(`Training Experience: ${profile.trainingExperience}`);
    if (profile.primaryGoals) parts.push(`Primary Goal: ${profile.primaryGoals}`);
    if (profile.secondaryGoals && profile.secondaryGoals.length > 0) {
      parts.push(`Secondary Goals: ${profile.secondaryGoals.join(', ')}`);
    }
    if (profile.injuries) parts.push(`Injuries: ${profile.injuries}`);
    if (profile.limitations) parts.push(`Limitations: ${profile.limitations}`);
    if (profile.daysPerWeek) parts.push(`Training Days Per Week: ${profile.daysPerWeek}`);
    if (profile.equipmentAvailability) parts.push(`Equipment: ${profile.equipmentAvailability}`);
    if (profile.preferredWorkoutLength) parts.push(`Preferred Workout Length: ${profile.preferredWorkoutLength} minutes`);

    return parts.join('\n');
  }
}

export default new UserProfileService();







