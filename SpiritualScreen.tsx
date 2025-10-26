import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TabSwipeNavigation from './TabSwipeNavigation';

interface GratitudeEntry {
  id: string;
  date: string;
  entries: string[];
  reflection: string;
}

interface AffirmationEntry {
  id: string;
  date: string;
  affirmation: string;
  category: 'self-love' | 'purpose' | 'peace' | 'growth' | 'connection';
  completed: boolean;
  completedAt?: string;
}

interface ReflectionEntry {
  id: string;
  date: string;
  prompt: string;
  response: string;
  category: 'nature' | 'connection' | 'purpose' | 'growth' | 'peace';
}

interface SpiritualScreenProps {
  onBack: () => void;
  onCompleteTask: (taskTitle: string) => void;
}

export default function SpiritualScreen({ onBack, onCompleteTask }: SpiritualScreenProps) {
  const [activeTab, setActiveTab] = useState<'gratitude' | 'affirmations' | 'reflection' | 'practices'>('gratitude');
  const [gratitudeEntries, setGratitudeEntries] = useState<GratitudeEntry[]>([]);
  const [affirmationEntries, setAffirmationEntries] = useState<AffirmationEntry[]>([]);
  const [reflectionEntries, setReflectionEntries] = useState<ReflectionEntry[]>([]);
  
  // Current session states
  const [currentGratitude, setCurrentGratitude] = useState<string[]>(['', '', '']);
  const [currentReflection, setCurrentReflection] = useState('');
  const [selectedAffirmation, setSelectedAffirmation] = useState<string>('');
  const [selectedReflectionPrompt, setSelectedReflectionPrompt] = useState<string>('');

  // Daily affirmations collection
  const dailyAffirmations = {
    'self-love': [
      "I am worthy of love and respect exactly as I am.",
      "I accept myself completely, including my imperfections.",
      "I am enough, and I have everything I need within me.",
      "I treat myself with kindness and compassion.",
      "I am deserving of happiness and fulfillment.",
      "I honor my needs and boundaries with love.",
      "I am proud of who I am becoming.",
    ],
    'purpose': [
      "I am aligned with my highest purpose and calling.",
      "My life has meaning and contributes to something greater.",
      "I trust the journey and embrace the lessons it brings.",
      "I am exactly where I need to be right now.",
      "My unique gifts are valuable and needed in the world.",
      "I am guided by wisdom and intuition.",
      "I create positive impact through my actions.",
    ],
    'peace': [
      "I am at peace with myself and the world around me.",
      "I release what I cannot control and focus on what I can.",
      "I find calm in the present moment.",
      "I trust that everything is unfolding as it should.",
      "I am centered and grounded in my inner strength.",
      "I let go of worry and embrace serenity.",
      "I am one with the flow of life.",
    ],
    'growth': [
      "I am constantly growing and evolving into my best self.",
      "Every challenge is an opportunity for growth.",
      "I embrace change as a natural part of life.",
      "I am open to learning and expanding my perspective.",
      "I trust in my ability to adapt and thrive.",
      "I am becoming more of who I truly am.",
      "My potential is limitless and ever-expanding.",
    ],
    'connection': [
      "I am deeply connected to all living beings.",
      "I feel the love and support of the universe.",
      "I am part of something greater than myself.",
      "I honor the sacred in everyday moments.",
      "I am connected to the wisdom of nature.",
      "I feel the presence of love in my life.",
      "I am one with the infinite web of life.",
    ],
  };

  // Spiritual reflection prompts
  const reflectionPrompts = {
    'nature': [
      "What does nature teach you about resilience and adaptation?",
      "How do you feel most connected to the natural world?",
      "What natural element (earth, water, air, fire) resonates with you today?",
      "How can you bring more of nature's wisdom into your daily life?",
      "What does the changing of seasons teach you about life's cycles?",
    ],
    'connection': [
      "What relationships in your life feel most spiritually meaningful?",
      "How do you experience connection with others beyond words?",
      "What does it mean to you to be truly present with another person?",
      "How do you cultivate deeper connections in your daily life?",
      "What role does community play in your spiritual journey?",
    ],
    'purpose': [
      "What activities make you feel most aligned with your true self?",
      "How do you know when you're living in accordance with your values?",
      "What legacy do you hope to leave through your actions?",
      "How do you balance personal fulfillment with service to others?",
      "What does 'living with purpose' mean to you?",
    ],
    'growth': [
      "What patterns in your life are ready to be released?",
      "How do you honor both your progress and your areas for growth?",
      "What does spiritual growth look like in your daily life?",
      "How do you stay open to new perspectives and experiences?",
      "What practices help you feel most spiritually nourished?",
    ],
    'peace': [
      "What does inner peace feel like in your body and mind?",
      "How do you find stillness in the midst of life's busyness?",
      "What helps you feel most centered and grounded?",
      "How do you practice acceptance of what you cannot change?",
      "What does it mean to you to live in harmony with life?",
    ],
  };

  useEffect(() => {
    loadSpiritualData();
  }, []);

  const loadSpiritualData = async () => {
    try {
      const savedGratitude = await AsyncStorage.getItem('gratitudeEntries');
      const savedAffirmations = await AsyncStorage.getItem('affirmationEntries');
      const savedReflections = await AsyncStorage.getItem('reflectionEntries');
      
      if (savedGratitude) setGratitudeEntries(JSON.parse(savedGratitude));
      if (savedAffirmations) setAffirmationEntries(JSON.parse(savedAffirmations));
      if (savedReflections) setReflectionEntries(JSON.parse(savedReflections));
    } catch (error) {
      console.error('Error loading spiritual data:', error);
    }
  };

  const saveGratitudeEntry = async () => {
    const validEntries = currentGratitude.filter(entry => entry.trim() !== '');
    if (validEntries.length === 0) {
      Alert.alert('Please add at least one gratitude entry');
      return;
    }

    const newEntry: GratitudeEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      entries: validEntries,
      reflection: currentReflection,
    };

    const updatedEntries = [newEntry, ...gratitudeEntries];
    setGratitudeEntries(updatedEntries);
    await AsyncStorage.setItem('gratitudeEntries', JSON.stringify(updatedEntries));
    
    setCurrentGratitude(['', '', '']);
    setCurrentReflection('');
    Alert.alert('Gratitude logged successfully!');
    onCompleteTask('Daily Gratitude Practice');
  };

  const saveAffirmationEntry = async () => {
    if (!selectedAffirmation) {
      Alert.alert('Please select an affirmation');
      return;
    }

    const newEntry: AffirmationEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      affirmation: selectedAffirmation,
      category: 'self-love', // Default category
      completed: true,
      completedAt: new Date().toISOString(),
    };

    const updatedEntries = [newEntry, ...affirmationEntries];
    setAffirmationEntries(updatedEntries);
    await AsyncStorage.setItem('affirmationEntries', JSON.stringify(updatedEntries));
    
    setSelectedAffirmation('');
    Alert.alert('Affirmation completed!');
    onCompleteTask('Daily Affirmation Practice');
  };

  const saveReflectionEntry = async () => {
    if (!selectedReflectionPrompt || !currentReflection.trim()) {
      Alert.alert('Please select a prompt and write your reflection');
      return;
    }

    const newEntry: ReflectionEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      prompt: selectedReflectionPrompt,
      response: currentReflection,
      category: 'nature', // Default category
    };

    const updatedEntries = [newEntry, ...reflectionEntries];
    setReflectionEntries(updatedEntries);
    await AsyncStorage.setItem('reflectionEntries', JSON.stringify(updatedEntries));
    
    setSelectedReflectionPrompt('');
    setCurrentReflection('');
    Alert.alert('Reflection saved successfully!');
    onCompleteTask('Spiritual Reflection Practice');
  };

  const renderGratitudeTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Gratitude Practice</Text>
        <Text style={styles.sectionDescription}>
          Take a moment to reflect on what you're grateful for today. Gratitude helps us connect with the abundance in our lives and cultivates a positive spiritual outlook.
        </Text>
        
        <View style={styles.gratitudeContainer}>
          <Text style={styles.gratitudeLabel}>What are you grateful for today?</Text>
          {currentGratitude.map((entry, index) => (
            <TextInput
              key={index}
              style={styles.gratitudeInput}
              value={entry}
              onChangeText={(text) => {
                const newEntries = [...currentGratitude];
                newEntries[index] = text;
                setCurrentGratitude(newEntries);
              }}
              placeholder={`Gratitude ${index + 1}...`}
              multiline
            />
          ))}
          
          <TouchableOpacity
            style={styles.addGratitudeButton}
            onPress={() => setCurrentGratitude([...currentGratitude, ''])}
          >
            <Text style={styles.addButtonText}>+ Add Another</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reflectionContainer}>
          <Text style={styles.reflectionLabel}>Reflection (Optional)</Text>
          <TextInput
            style={styles.reflectionInput}
            value={currentReflection}
            onChangeText={setCurrentReflection}
            placeholder="How do these gratitudes make you feel? What do they teach you about your life?"
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={saveGratitudeEntry}>
          <Text style={styles.saveButtonText}>Save Gratitude Entry</Text>
        </TouchableOpacity>
      </View>

      {gratitudeEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Gratitude Entries</Text>
          {gratitudeEntries.slice(0, 5).map((entry) => (
            <View key={entry.id} style={styles.entryCard}>
              <Text style={styles.entryDate}>{new Date(entry.date).toLocaleDateString()}</Text>
              {entry.entries.map((gratitude, index) => (
                <Text key={index} style={styles.gratitudeItem}>• {gratitude}</Text>
              ))}
              {entry.reflection && (
                <Text style={styles.reflectionText}>"{entry.reflection}"</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderAffirmationsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Affirmations</Text>
        <Text style={styles.sectionDescription}>
          Choose an affirmation that resonates with you today. Repeat it to yourself and let it sink into your consciousness.
        </Text>

        {Object.entries(dailyAffirmations).map(([category, affirmations]) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.replace('-', ' ').toUpperCase()}</Text>
            {affirmations.map((affirmation, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.affirmationCard,
                  selectedAffirmation === affirmation && styles.selectedAffirmation
                ]}
                onPress={() => setSelectedAffirmation(affirmation)}
              >
                <Text style={styles.affirmationText}>"{affirmation}"</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {selectedAffirmation && (
          <View style={styles.selectedContainer}>
            <Text style={styles.selectedLabel}>Selected Affirmation:</Text>
            <Text style={styles.selectedAffirmationText}>"{selectedAffirmation}"</Text>
            <TouchableOpacity style={styles.completeButton} onPress={saveAffirmationEntry}>
              <Text style={styles.completeButtonText}>Complete Affirmation</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {affirmationEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Affirmations</Text>
          {affirmationEntries.slice(0, 5).map((entry) => (
            <View key={entry.id} style={styles.entryCard}>
              <Text style={styles.entryDate}>{new Date(entry.date).toLocaleDateString()}</Text>
              <Text style={styles.affirmationItem}>"{entry.affirmation}"</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderReflectionTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spiritual Reflection</Text>
        <Text style={styles.sectionDescription}>
          Choose a prompt that speaks to you and take time to reflect deeply. These prompts are designed to help you connect with your inner wisdom and spiritual nature.
        </Text>

        {Object.entries(reflectionPrompts).map(([category, prompts]) => (
          <View key={category} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.toUpperCase()}</Text>
            {prompts.map((prompt, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.promptCard,
                  selectedReflectionPrompt === prompt && styles.selectedPrompt
                ]}
                onPress={() => setSelectedReflectionPrompt(prompt)}
              >
                <Text style={styles.promptText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {selectedReflectionPrompt && (
          <View style={styles.reflectionContainer}>
            <Text style={styles.reflectionLabel}>Your Reflection:</Text>
            <Text style={styles.selectedPromptText}>"{selectedReflectionPrompt}"</Text>
            <TextInput
              style={styles.reflectionInput}
              value={currentReflection}
              onChangeText={setCurrentReflection}
              placeholder="Take your time to reflect deeply on this prompt..."
              multiline
              numberOfLines={6}
            />
            <TouchableOpacity style={styles.saveButton} onPress={saveReflectionEntry}>
              <Text style={styles.saveButtonText}>Save Reflection</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {reflectionEntries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Reflections</Text>
          {reflectionEntries.slice(0, 3).map((entry) => (
            <View key={entry.id} style={styles.entryCard}>
              <Text style={styles.entryDate}>{new Date(entry.date).toLocaleDateString()}</Text>
              <Text style={styles.promptItem}>Prompt: {entry.prompt}</Text>
              <Text style={styles.responseText}>"{entry.response}"</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderPracticesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spiritual Practices</Text>
        <Text style={styles.sectionDescription}>
          Explore different ways to connect with your spiritual nature. These practices are universal and can be adapted to any belief system or spiritual path.
        </Text>

        <View style={styles.practicesGrid}>
          <View style={styles.practiceCard}>
            <Text style={styles.practiceTitle}>Nature Connection</Text>
            <Text style={styles.practiceDescription}>
              Spend time in nature, observe its rhythms, and feel your connection to the natural world.
            </Text>
            <Text style={styles.practiceTip}>Try: 10 minutes of mindful walking outdoors</Text>
          </View>

          <View style={styles.practiceCard}>
            <Text style={styles.practiceTitle}>Mindful Breathing</Text>
            <Text style={styles.practiceDescription}>
              Use breath as an anchor to the present moment and cultivate inner stillness.
            </Text>
            <Text style={styles.practiceTip}>Try: 5 minutes of conscious breathing</Text>
          </View>

          <View style={styles.practiceCard}>
            <Text style={styles.practiceTitle}>Loving-Kindness</Text>
            <Text style={styles.practiceDescription}>
              Send loving thoughts to yourself and others, cultivating compassion and connection.
            </Text>
            <Text style={styles.practiceTip}>Try: Repeat "May I be happy, may you be happy"</Text>
          </View>

          <View style={styles.practiceCard}>
            <Text style={styles.practiceTitle}>Sacred Moments</Text>
            <Text style={styles.practiceDescription}>
              Find the sacred in everyday activities by bringing full presence and intention.
            </Text>
            <Text style={styles.practiceTip}>Try: Mindful eating or washing dishes</Text>
          </View>

          <View style={styles.practiceCard}>
            <Text style={styles.practiceTitle}>Service & Giving</Text>
            <Text style={styles.practiceDescription}>
              Connect with others through acts of service and generosity.
            </Text>
            <Text style={styles.practiceTip}>Try: One small act of kindness daily</Text>
          </View>

          <View style={styles.practiceCard}>
            <Text style={styles.practiceTitle}>Creative Expression</Text>
            <Text style={styles.practiceDescription}>
              Express your inner world through art, music, writing, or movement.
            </Text>
            <Text style={styles.practiceTip}>Try: 15 minutes of free-form creative expression</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Spiritual Check-in</Text>
        <Text style={styles.sectionDescription}>
          Reflect on your spiritual journey this week and set intentions for the coming days.
        </Text>
        
        <TouchableOpacity style={styles.checkInButton}>
          <Text style={styles.checkInButtonText}>Complete Weekly Check-in</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Spiritual Wellness</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'gratitude' && styles.tabButtonActive]}
          onPress={() => setActiveTab('gratitude')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'gratitude' && styles.tabButtonTextActive]}>Gratitude</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'affirmations' && styles.tabButtonActive]}
          onPress={() => setActiveTab('affirmations')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'affirmations' && styles.tabButtonTextActive]}>Affirmations</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'reflection' && styles.tabButtonActive]}
          onPress={() => setActiveTab('reflection')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'reflection' && styles.tabButtonTextActive]}>Reflection</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'practices' && styles.tabButtonActive]}
          onPress={() => setActiveTab('practices')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'practices' && styles.tabButtonTextActive]}>Practices</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <TabSwipeNavigation
        tabs={['gratitude', 'affirmations', 'reflection', 'practices']}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
      >
        {activeTab === 'gratitude' && renderGratitudeTab()}
        {activeTab === 'affirmations' && renderAffirmationsTab()}
        {activeTab === 'reflection' && renderReflectionTab()}
        {activeTab === 'practices' && renderPracticesTab()}
      </TabSwipeNavigation>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 50,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    marginHorizontal: 20,
    marginVertical: 15,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
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
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 20,
    lineHeight: 22,
  },
  gratitudeContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  gratitudeLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 15,
  },
  gratitudeInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#555',
  },
  addGratitudeButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  reflectionContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  reflectionLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 15,
  },
  reflectionInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#555',
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#00ff88',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  categorySection: {
    marginBottom: 25,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 15,
    textTransform: 'capitalize',
  },
  affirmationCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedAffirmation: {
    borderColor: '#4ECDC4',
    backgroundColor: '#2a3a3a',
  },
  affirmationText: {
    fontSize: 16,
    color: '#fff',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  selectedContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginTop: 20,
  },
  selectedLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 10,
  },
  selectedAffirmationText: {
    fontSize: 18,
    color: '#fff',
    fontStyle: 'italic',
    marginBottom: 20,
    lineHeight: 24,
  },
  completeButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  promptCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedPrompt: {
    borderColor: '#4ECDC4',
    backgroundColor: '#2a3a3a',
  },
  promptText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
  selectedPromptText: {
    fontSize: 16,
    color: '#4ECDC4',
    fontStyle: 'italic',
    marginBottom: 15,
    lineHeight: 22,
  },
  practicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  practiceCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    width: '48%',
    borderWidth: 1,
    borderColor: '#333',
  },
  practiceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 10,
  },
  practiceDescription: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 10,
    lineHeight: 20,
  },
  practiceTip: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  checkInButton: {
    backgroundColor: '#4ECDC4',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  checkInButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  entryCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  entryDate: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  gratitudeItem: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 5,
  },
  reflectionText: {
    fontSize: 14,
    color: '#ccc',
    fontStyle: 'italic',
    marginTop: 10,
  },
  affirmationItem: {
    fontSize: 16,
    color: '#fff',
    fontStyle: 'italic',
  },
  promptItem: {
    fontSize: 14,
    color: '#4ECDC4',
    marginBottom: 10,
  },
  responseText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
});
