/**
 * Unified Wellness Data Manager
 * 
 * This is the main service that coordinates all data operations across the app.
 * It provides a single interface for saving/loading data and automatically
 * triggers AI sync when data changes.
 * 
 * Key Responsibilities:
 * - Centralized data operations
 * - Automatic AI sync on data changes
 * - Data validation
 * - Error handling
 */

import { saveUserData, loadUserData } from '../utils/userStorage';
import WellnessDataSync from './WellnessDataSync';
import WellnessDataAggregator from './WellnessDataAggregator';

type WellnessCategory = 'fitness' | 'mental' | 'emotional' | 'spiritual';

class WellnessDataManager {
  /**
   * Save data for a specific category and trigger AI sync
   */
  async saveCategoryData<T>(
    category: WellnessCategory,
    dataKey: string,
    data: T
  ): Promise<void> {
    try {
      // Save the data
      await saveUserData(dataKey, data);
      
      // Notify sync service of the update
      await WellnessDataSync.notifyDataUpdate(category);
      
      console.log(`[DataManager] Saved ${dataKey} for category ${category}`);
    } catch (error) {
      console.error(`[DataManager] Error saving ${dataKey}:`, error);
      throw error;
    }
  }

  /**
   * Load data for a specific key
   */
  async loadCategoryData<T>(dataKey: string): Promise<T | null> {
    try {
      return await loadUserData<T>(dataKey);
    } catch (error) {
      console.error(`[DataManager] Error loading ${dataKey}:`, error);
      return null;
    }
  }

  /**
   * Save fitness data
   */
  async saveFitnessData(dataKey: string, data: any): Promise<void> {
    return this.saveCategoryData('fitness', dataKey, data);
  }

  /**
   * Save mental wellness data
   */
  async saveMentalData(dataKey: string, data: any): Promise<void> {
    return this.saveCategoryData('mental', dataKey, data);
  }

  /**
   * Save emotional wellness data
   */
  async saveEmotionalData(dataKey: string, data: any): Promise<void> {
    return this.saveCategoryData('emotional', dataKey, data);
  }

  /**
   * Save spiritual wellness data
   */
  async saveSpiritualData(dataKey: string, data: any): Promise<void> {
    return this.saveCategoryData('spiritual', dataKey, data);
  }

  /**
   * Get aggregated wellness data for AI analysis
   */
  async getAggregatedData() {
    return await WellnessDataAggregator.aggregateAllData();
  }

  /**
   * Get data freshness score
   */
  async getDataFreshnessScore(): Promise<number> {
    const data = await WellnessDataAggregator.aggregateAllData();
    return WellnessDataAggregator.getDataFreshnessScore(data);
  }

  /**
   * Get data completeness score
   */
  async getDataCompletenessScore(): Promise<number> {
    const data = await WellnessDataAggregator.aggregateAllData();
    return WellnessDataAggregator.getDataCompletenessScore(data);
  }

  /**
   * Force AI sync (useful for manual refresh)
   */
  async syncAI(): Promise<{
    insights: any[];
    recommendations: any[];
  }> {
    return await WellnessDataSync.forceSync();
  }

  /**
   * Get cached AI insights
   */
  async getAIInsights(): Promise<any[]> {
    return await WellnessDataSync.getCachedInsights();
  }

  /**
   * Get cached AI recommendations
   */
  async getAIRecommendations(): Promise<any[]> {
    return await WellnessDataSync.getCachedRecommendations();
  }

  /**
   * Initialize the data manager (call on app start)
   */
  async initialize(): Promise<void> {
    console.log('[DataManager] Initializing...');
    await WellnessDataSync.initialize();
    console.log('[DataManager] Initialization complete');
  }
}

export default new WellnessDataManager();



