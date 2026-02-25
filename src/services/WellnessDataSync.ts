/**
 * Wellness Data Sync Service
 * 
 * This service automatically syncs data changes to AI analysis in the background.
 * It listens for data changes and triggers AI updates when needed.
 * 
 * Key Responsibilities:
 * - Monitor data changes across all categories
 * - Trigger AI analysis when data is updated
 * - Debounce rapid updates to avoid excessive processing
 * - Cache analysis results for performance
 */

import { saveUserData, loadUserData } from '../utils/userStorage';
import WellnessDataAggregator from './WellnessDataAggregator';
import AIService from '../../AIService';
import { ExtendedUserWellnessData } from './WellnessDataAggregator';
import { AIInsight, AIRecommendation } from '../../AIService';

interface SyncState {
  lastSyncTimestamp: string | null;
  pendingUpdates: string[]; // Categories that have pending updates
  isSyncing: boolean;
}

class WellnessDataSync {
  private syncState: SyncState = {
    lastSyncTimestamp: null,
    pendingUpdates: [],
    isSyncing: false,
  };

  private syncDebounceTimer: NodeJS.Timeout | null = null;
  private readonly SYNC_DEBOUNCE_MS = 2000; // Wait 2 seconds after last update before syncing

  /**
   * Notify that data in a specific category has been updated
   * This should be called whenever data is saved in any screen
   */
  async notifyDataUpdate(category: 'fitness' | 'mental' | 'emotional' | 'spiritual'): Promise<void> {
    console.log(`[DataSync] Data update notified for category: ${category}`);
    
    // Add to pending updates if not already there
    if (!this.syncState.pendingUpdates.includes(category)) {
      this.syncState.pendingUpdates.push(category);
    }

    // Clear existing debounce timer
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    // Set new debounce timer
    this.syncDebounceTimer = setTimeout(() => {
      this.performSync();
    }, this.SYNC_DEBOUNCE_MS);
  }

  /**
   * Perform the actual sync operation
   */
  private async performSync(): Promise<void> {
    if (this.syncState.isSyncing) {
      console.log('[DataSync] Sync already in progress, skipping...');
      return;
    }

    this.syncState.isSyncing = true;
    console.log('[DataSync] Starting sync for categories:', this.syncState.pendingUpdates);

    try {
      // Aggregate all current data
      const wellnessData = await WellnessDataAggregator.aggregateAllData();

      // Generate AI insights and recommendations
      const insights = AIService.analyzeUserData(wellnessData);
      const recommendations = AIService.generateRecommendations(wellnessData);

      // Save AI results
      await Promise.all([
        saveUserData('aiInsights', insights),
        saveUserData('aiRecommendations', recommendations),
        saveUserData('lastAISync', new Date().toISOString()),
      ]);

      // Update sync state
      this.syncState.lastSyncTimestamp = new Date().toISOString();
      this.syncState.pendingUpdates = [];

      console.log('[DataSync] Sync completed successfully');
      console.log(`[DataSync] Generated ${insights.length} insights and ${recommendations.length} recommendations`);
    } catch (error) {
      console.error('[DataSync] Error during sync:', error);
    } finally {
      this.syncState.isSyncing = false;
    }
  }

  /**
   * Force an immediate sync (bypasses debounce)
   */
  async forceSync(): Promise<{
    insights: AIInsight[];
    recommendations: AIRecommendation[];
  }> {
    console.log('[DataSync] Force sync requested');
    
    // Clear any pending debounce
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }

    await this.performSync();

    // Load and return the results
    const [insights, recommendations] = await Promise.all([
      loadUserData<AIInsight[]>('aiInsights'),
      loadUserData<AIRecommendation[]>('aiRecommendations'),
    ]);

    return {
      insights: insights || [],
      recommendations: recommendations || [],
    };
  }

  /**
   * Get cached AI insights
   */
  async getCachedInsights(): Promise<AIInsight[]> {
    const insights = await loadUserData<AIInsight[]>('aiInsights');
    return insights || [];
  }

  /**
   * Get cached AI recommendations
   */
  async getCachedRecommendations(): Promise<AIRecommendation[]> {
    const recommendations = await loadUserData<AIRecommendation[]>('aiRecommendations');
    return recommendations || [];
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTimestamp(): Promise<string | null> {
    const timestamp = await loadUserData<string>('lastAISync');
    return timestamp || this.syncState.lastSyncTimestamp;
  }

  /**
   * Check if sync is needed based on data freshness
   */
  async shouldSync(): Promise<boolean> {
    const lastSync = await this.getLastSyncTimestamp();
    if (!lastSync) return true; // Never synced

    const lastSyncTime = new Date(lastSync).getTime();
    const now = new Date().getTime();
    const timeSinceSync = now - lastSyncTime;
    const oneHour = 60 * 60 * 1000;

    // Sync if it's been more than 1 hour since last sync
    return timeSinceSync > oneHour;
  }

  /**
   * Initialize sync service
   * Call this when the app starts
   */
  async initialize(): Promise<void> {
    console.log('[DataSync] Initializing sync service...');
    
    // Load last sync timestamp
    const lastSync = await this.getLastSyncTimestamp();
    this.syncState.lastSyncTimestamp = lastSync;

    // Perform initial sync if needed
    if (await this.shouldSync()) {
      console.log('[DataSync] Initial sync needed, performing...');
      await this.performSync();
    } else {
      console.log('[DataSync] No initial sync needed');
    }
  }
}

export default new WellnessDataSync();

