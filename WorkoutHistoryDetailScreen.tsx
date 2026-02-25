import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WorkoutSession } from './data/workoutPrograms';

interface WorkoutHistoryDetailScreenProps {
  session: WorkoutSession;
  onBack: () => void;
}

export default function WorkoutHistoryDetailScreen({ session, onBack }: WorkoutHistoryDetailScreenProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Workout Info */}
        <View style={styles.section}>
          <Text style={styles.workoutName}>{session.programName}</Text>
          <Text style={styles.workoutDate}>{formatDate(session.date)}</Text>
          <Text style={styles.workoutTime}>{formatTime(session.date)}</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{session.duration}</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{session.exercises.length}</Text>
              <Text style={styles.statLabel}>Exercises</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {session.exercises.reduce((total, ex) => 
                  total + ex.sets.filter(s => s.completed).length, 0
                )}
              </Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
          </View>
        </View>

        {/* Health Metrics */}
        {session.healthMetrics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Health Metrics</Text>
            <View style={styles.healthMetricsContainer}>
              {session.healthMetrics.averageHeartRate && (
                <View style={styles.healthMetricItem}>
                  <Text style={styles.healthMetricLabel}>Avg Heart Rate</Text>
                  <Text style={styles.healthMetricValue}>
                    {session.healthMetrics.averageHeartRate} bpm
                  </Text>
                </View>
              )}
              {session.healthMetrics.maxHeartRate && (
                <View style={styles.healthMetricItem}>
                  <Text style={styles.healthMetricLabel}>Max Heart Rate</Text>
                  <Text style={styles.healthMetricValue}>
                    {session.healthMetrics.maxHeartRate} bpm
                  </Text>
                </View>
              )}
              {session.healthMetrics.caloriesBurned && (
                <View style={styles.healthMetricItem}>
                  <Text style={styles.healthMetricLabel}>Calories Burned</Text>
                  <Text style={styles.healthMetricValue}>
                    {session.healthMetrics.caloriesBurned} kcal
                  </Text>
                </View>
              )}
              {session.healthMetrics.steps && (
                <View style={styles.healthMetricItem}>
                  <Text style={styles.healthMetricLabel}>Steps</Text>
                  <Text style={styles.healthMetricValue}>
                    {session.healthMetrics.steps.toLocaleString()}
                  </Text>
                </View>
              )}
              {session.healthMetrics.distance && (
                <View style={styles.healthMetricItem}>
                  <Text style={styles.healthMetricLabel}>Distance</Text>
                  <Text style={styles.healthMetricValue}>
                    {(session.healthMetrics.distance / 1000).toFixed(2)} km
                  </Text>
                </View>
              )}
              {session.healthMetrics.heartRateZones && (
                <View style={styles.heartRateZonesContainer}>
                  <Text style={styles.heartRateZonesTitle}>Heart Rate Zones</Text>
                  <View style={styles.zoneRow}>
                    <Text style={styles.zoneLabel}>Fat Burn:</Text>
                    <Text style={styles.zoneValue}>
                      {session.healthMetrics.heartRateZones.fatBurn} min
                    </Text>
                  </View>
                  <View style={styles.zoneRow}>
                    <Text style={styles.zoneLabel}>Cardio:</Text>
                    <Text style={styles.zoneValue}>
                      {session.healthMetrics.heartRateZones.cardio} min
                    </Text>
                  </View>
                  <View style={styles.zoneRow}>
                    <Text style={styles.zoneLabel}>Peak:</Text>
                    <Text style={styles.zoneValue}>
                      {session.healthMetrics.heartRateZones.peak} min
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Exercises */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          {session.exercises.map((exercise, index) => {
            const completedSets = exercise.sets.filter(s => s.completed);
            const totalVolume = completedSets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
            
            // Group sets by weight and reps combination
            const groupedSets = completedSets.reduce((groups, set) => {
              const key = `${set.weight}-${set.reps}`;
              if (!groups[key]) {
                groups[key] = [];
              }
              groups[key].push(set);
              return groups;
            }, {} as Record<string, typeof completedSets>);
            
            return (
              <View key={exercise.exerciseId || index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseNumber}>{index + 1}</Text>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseStats}>
                      {completedSets.length} sets completed
                      {totalVolume > 0 && ` • ${totalVolume} lbs total volume`}
                    </Text>
                  </View>
                </View>

                {/* Sets */}
                <View style={styles.setsContainer}>
                  {Object.entries(groupedSets).map(([key, sets], groupIndex) => {
                    const weight = sets[0].weight;
                    const reps = sets[0].reps;
                    const setCount = sets.length;
                    const groupVolume = weight * reps * setCount;
                    
                    return (
                      <View key={`ex-${index}-group-${groupIndex}-${key}`} style={styles.setItem}>
                        {setCount > 1 ? (
                          // Display summary when multiple sets have same weight/reps
                          <>
                            <View style={styles.setSummaryBadge}>
                              <Text style={styles.setSummaryText}>
                                {setCount} sets
                              </Text>
                            </View>
                            <View style={styles.setDetails}>
                              <Text style={styles.setWeight}>{weight} lbs</Text>
                              <Text style={styles.setReps}>× {reps} reps</Text>
                            </View>
                            <View style={styles.setVolume}>
                              <Text style={styles.setVolumeText}>
                                {groupVolume} lbs
                              </Text>
                            </View>
                          </>
                        ) : (
                          // Display individual set when only one set has this weight/reps
                          <>
                            <View style={styles.setNumberBadge}>
                              <Text style={styles.setNumberText}>Set {sets[0].setNumber}</Text>
                            </View>
                            <View style={styles.setDetails}>
                              <Text style={styles.setWeight}>{weight} lbs</Text>
                              <Text style={styles.setReps}>{reps} reps</Text>
                              {sets[0].restTime > 0 && (
                                <Text style={styles.setRest}>{sets[0].restTime}s rest</Text>
                              )}
                            </View>
                            <View style={styles.setVolume}>
                              <Text style={styles.setVolumeText}>
                                {weight * reps} lbs
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        {/* Notes */}
        {session.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesContainer}>
              <Text style={styles.notesText}>{session.notes}</Text>
            </View>
          </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  workoutName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  workoutDate: {
    fontSize: 18,
    color: '#00ff88',
    marginBottom: 5,
  },
  workoutTime: {
    fontSize: 16,
    color: '#888',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginTop: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#888',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  exerciseCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  exerciseNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ff88',
    width: 30,
    marginRight: 10,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 5,
  },
  exerciseStats: {
    fontSize: 14,
    color: '#888',
  },
  setsContainer: {
    marginTop: 10,
  },
  setItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  setNumberBadge: {
    backgroundColor: '#00ff88',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 12,
  },
  setNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  setSummaryBadge: {
    backgroundColor: '#4a90e2',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 12,
  },
  setSummaryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  setDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  setWeight: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  setReps: {
    fontSize: 16,
    color: '#888',
  },
  setRest: {
    fontSize: 14,
    color: '#666',
  },
  setVolume: {
    alignItems: 'flex-end',
  },
  setVolumeText: {
    fontSize: 14,
    color: '#00ff88',
    fontWeight: '600',
  },
  notesContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 15,
  },
  notesText: {
    fontSize: 16,
    color: '#ccc',
    lineHeight: 24,
  },
  healthMetricsContainer: {
    gap: 12,
  },
  healthMetricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00ff88',
  },
  healthMetricLabel: {
    fontSize: 14,
    color: '#888',
  },
  healthMetricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00ff88',
  },
  heartRateZonesContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  heartRateZonesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  zoneLabel: {
    fontSize: 14,
    color: '#888',
  },
  zoneValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ff88',
  },
});

