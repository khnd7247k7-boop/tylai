/**
 * React Hook for Wellness Data Management
 * 
 * This hook provides easy access to wellness data operations and AI insights
 * from any component in the app.
 */

import { useState, useEffect, useCallback } from 'react';
import WellnessDataManager from '../services/WellnessDataManager';
import { ExtendedUserWellnessData } from '../services/WellnessDataAggregator';
import { AIInsight, AIRecommendation } from '../../AIService';

interface UseWellnessDataReturn {
  // Data
  wellnessData: ExtendedUserWellnessData | null;
  insights: AIInsight[];
  recommendations: AIRecommendation[];
  
  // Loading states
  isLoading: boolean;
  isSyncing: boolean;
  
  // Scores
  freshnessScore: number;
  completenessScore: number;
  
  // Actions
  refreshData: () => Promise<void>;
  syncAI: () => Promise<void>;
  saveFitnessData: (key: string, data: any) => Promise<void>;
  saveMentalData: (key: string, data: any) => Promise<void>;
  saveEmotionalData: (key: string, data: any) => Promise<void>;
  saveSpiritualData: (key: string, data: any) => Promise<void>;
}

export function useWellnessData(): UseWellnessDataReturn {
  const [wellnessData, setWellnessData] = useState<ExtendedUserWellnessData | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [freshnessScore, setFreshnessScore] = useState(0);
  const [completenessScore, setCompletenessScore] = useState(0);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [data, aiInsights, aiRecommendations, freshness, completeness] = await Promise.all([
        WellnessDataManager.getAggregatedData(),
        WellnessDataManager.getAIInsights(),
        WellnessDataManager.getAIRecommendations(),
        WellnessDataManager.getDataFreshnessScore(),
        WellnessDataManager.getDataCompletenessScore(),
      ]);

      setWellnessData(data);
      setInsights(aiInsights);
      setRecommendations(aiRecommendations);
      setFreshnessScore(freshness);
      setCompletenessScore(completeness);
    } catch (error) {
      console.error('Error loading wellness data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const syncAI = useCallback(async () => {
    try {
      setIsSyncing(true);
      const result = await WellnessDataManager.syncAI();
      setInsights(result.insights);
      setRecommendations(result.recommendations);
      await refreshData();
    } catch (error) {
      console.error('Error syncing AI:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [refreshData]);

  const saveFitnessData = useCallback(async (key: string, data: any) => {
    await WellnessDataManager.saveFitnessData(key, data);
    // Refresh data after save
    setTimeout(() => refreshData(), 1000);
  }, [refreshData]);

  const saveMentalData = useCallback(async (key: string, data: any) => {
    await WellnessDataManager.saveMentalData(key, data);
    setTimeout(() => refreshData(), 1000);
  }, [refreshData]);

  const saveEmotionalData = useCallback(async (key: string, data: any) => {
    await WellnessDataManager.saveEmotionalData(key, data);
    setTimeout(() => refreshData(), 1000);
  }, [refreshData]);

  const saveSpiritualData = useCallback(async (key: string, data: any) => {
    await WellnessDataManager.saveSpiritualData(key, data);
    setTimeout(() => refreshData(), 1000);
  }, [refreshData]);

  return {
    wellnessData,
    insights,
    recommendations,
    isLoading,
    isSyncing,
    freshnessScore,
    completenessScore,
    refreshData,
    syncAI,
    saveFitnessData,
    saveMentalData,
    saveEmotionalData,
    saveSpiritualData,
  };
}







