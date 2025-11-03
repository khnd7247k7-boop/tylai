import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import AIService, { AIInsight, AIRecommendation, UserWellnessData } from './AIService';

interface AIComponentProps {
  userData: UserWellnessData;
  onRecommendationAction?: (recommendation: AIRecommendation) => void;
}

export default function AIComponent({ userData, onRecommendationAction }: AIComponentProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [activeTab, setActiveTab] = useState<'insights' | 'recommendations'>('insights');
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    analyzeData();
  }, [userData]);

  const analyzeData = async () => {
    setIsAnalyzing(true);
    try {
      const newInsights = AIService.analyzeUserData(userData);
      const newRecommendations = AIService.generateRecommendations(userData);
      
      setInsights(newInsights);
      setRecommendations(newRecommendations);
    } catch (error) {
      console.error('Error analyzing data:', error);
      Alert.alert('Error', 'Failed to analyze your data. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRecommendationAction = (recommendation: AIRecommendation) => {
    if (onRecommendationAction) {
      onRecommendationAction(recommendation);
    }
    Alert.alert('Action Taken', `You've started working on: ${recommendation.title}`);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#FF6B6B';
      case 'medium': return '#FFA726';
      case 'low': return '#66BB6A';
      default: return '#4ECDC4';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mood': return 'MOOD';
      case 'fitness': return 'FIT';
      case 'mental': return 'MIND';
      case 'nutrition': return 'NUTR';
      case 'overall': return 'ALL';
      case 'exercise': return 'EXER';
      case 'lifestyle': return 'LIFE';
      default: return 'INFO';
    }
  };

  const renderInsightCard = (insight: AIInsight) => (
    <TouchableOpacity
      key={insight.id}
      style={[styles.insightCard, { borderLeftColor: getPriorityColor(insight.priority) }]}
      onPress={() => setSelectedInsight(insight)}
    >
      <View style={styles.insightHeader}>
        <Text style={styles.insightIcon}>{getTypeIcon(insight.type)}</Text>
        <View style={styles.insightTitleContainer}>
          <Text style={styles.insightTitle}>{insight.title}</Text>
          <Text style={styles.insightCategory}>{insight.category.toUpperCase()}</Text>
        </View>
        <View style={styles.insightPriority}>
          <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(insight.priority) }]} />
        </View>
      </View>
      <Text style={styles.insightMessage} numberOfLines={2}>
        {insight.message}
      </Text>
      <View style={styles.insightFooter}>
        <Text style={styles.insightConfidence}>
          {insight.confidence}% confidence
        </Text>
        <Text style={styles.insightTime}>
          {new Date(insight.timestamp).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderRecommendationCard = (recommendation: AIRecommendation) => (
    <TouchableOpacity
      key={recommendation.id}
      style={[styles.recommendationCard, { borderLeftColor: getPriorityColor(recommendation.priority) }]}
      onPress={() => handleRecommendationAction(recommendation)}
    >
      <View style={styles.recommendationHeader}>
        <Text style={styles.recommendationIcon}>{getTypeIcon(recommendation.type)}</Text>
        <View style={styles.recommendationTitleContainer}>
          <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
          <Text style={styles.recommendationCategory}>{recommendation.category.toUpperCase()}</Text>
        </View>
        <View style={styles.recommendationPriority}>
          <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(recommendation.priority) }]} />
        </View>
      </View>
      <Text style={styles.recommendationDescription}>
        {recommendation.description}
      </Text>
      <Text style={styles.recommendationReason}>
        {recommendation.reason}
      </Text>
      <View style={styles.recommendationFooter}>
        <Text style={styles.recommendationTime}>
          {recommendation.estimatedTime} min
        </Text>
        <Text style={styles.recommendationAction}>
          Tap to start
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderInsights = () => (
    <View style={styles.tabContent}>
      <View style={styles.headerSection}>
        <Text style={styles.sectionTitle}>AI Insights</Text>
        <Text style={styles.sectionSubtitle}>
          Personalized analysis of your wellness data
        </Text>
      </View>

      {isAnalyzing ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Analyzing your data...</Text>
        </View>
      ) : insights.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No insights yet</Text>
          <Text style={styles.emptyMessage}>
            Complete more activities to get personalized insights
          </Text>
        </View>
      ) : (
        <View style={styles.insightsContainer}>
          {insights.map(renderInsightCard)}
        </View>
      )}
    </View>
  );

  const renderRecommendations = () => (
    <View style={styles.tabContent}>
      <View style={styles.headerSection}>
        <Text style={styles.sectionTitle}>AI Recommendations</Text>
        <Text style={styles.sectionSubtitle}>
          Personalized suggestions based on your data
        </Text>
      </View>

      {isAnalyzing ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Generating recommendations...</Text>
        </View>
      ) : recommendations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No recommendations yet</Text>
          <Text style={styles.emptyMessage}>
            Complete more activities to get personalized recommendations
          </Text>
        </View>
      ) : (
        <View style={styles.recommendationsContainer}>
          {recommendations.map(renderRecommendationCard)}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'insights' && styles.tabButtonActive]}
          onPress={() => setActiveTab('insights')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'insights' && styles.tabButtonTextActive]}>
            Insights
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'recommendations' && styles.tabButtonActive]}
          onPress={() => setActiveTab('recommendations')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'recommendations' && styles.tabButtonTextActive]}>
            Recommendations
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === 'insights' && renderInsights()}
        {activeTab === 'recommendations' && renderRecommendations()}
      </ScrollView>

      {/* Insight Detail Modal */}
      <Modal
        visible={selectedInsight !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedInsight(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedInsight(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContainer}>
            {selectedInsight && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalIcon}>{getTypeIcon(selectedInsight.type)}</Text>
                  <View style={styles.modalTitleContainer}>
                    <Text style={styles.modalTitle}>{selectedInsight.title}</Text>
                    <Text style={styles.modalCategory}>{selectedInsight.category.toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setSelectedInsight(null)}
                  >
                    <Text style={styles.closeButtonText}>X</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalContent}>
                  <Text style={styles.modalMessage}>{selectedInsight.message}</Text>
                  
                  <View style={styles.modalDetails}>
                    <View style={styles.modalDetailItem}>
                      <Text style={styles.modalDetailLabel}>Confidence:</Text>
                      <Text style={styles.modalDetailValue}>{selectedInsight.confidence}%</Text>
                    </View>
                    <View style={styles.modalDetailItem}>
                      <Text style={styles.modalDetailLabel}>Priority:</Text>
                      <Text style={[styles.modalDetailValue, { color: getPriorityColor(selectedInsight.priority) }]}>
                        {selectedInsight.priority.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.modalDetailItem}>
                      <Text style={styles.modalDetailLabel}>Actionable:</Text>
                      <Text style={styles.modalDetailValue}>
                        {selectedInsight.actionable ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    marginHorizontal: 15,
    marginVertical: 10,
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#4ECDC4',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  tabButtonTextActive: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    padding: 15,
  },
  tabContent: {
    flex: 1,
  },
  headerSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 20,
  },
  insightsContainer: {
    gap: 15,
  },
  recommendationsContainer: {
    gap: 15,
  },
  insightCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  insightIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  insightTitleContainer: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  insightCategory: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  insightPriority: {
    alignItems: 'center',
  },
  priorityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  insightMessage: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 10,
  },
  insightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightConfidence: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  insightTime: {
    fontSize: 12,
    color: '#888',
  },
  recommendationCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recommendationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  recommendationTitleContainer: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  recommendationCategory: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  recommendationPriority: {
    alignItems: 'center',
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 8,
  },
  recommendationReason: {
    fontSize: 13,
    color: '#4ECDC4',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  recommendationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recommendationTime: {
    fontSize: 12,
    color: '#888',
  },
  recommendationAction: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  modalCategory: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#888',
  },
  modalContent: {
    marginBottom: 20,
  },
  modalMessage: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalDetails: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
  },
  modalDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalDetailLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  modalDetailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
