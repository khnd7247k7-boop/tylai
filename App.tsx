import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Dashboard from './Dashboard';
import WorkoutScreen from './WorkoutScreen';
import FitnessScreen from './FitnessScreen';
import MentalScreen from './MentalScreen';
import EmotionalScreen from './EmotionalScreen';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'dashboard' | 'workout' | 'fitness' | 'mental' | 'emotional'>('login');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!isLogin && !name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    // Here you would typically integrate with Firebase Auth
    if (isLogin) {
      Alert.alert('Success', 'Login successful!');
      setIsLoggedIn(true);
      setCurrentScreen('dashboard');
    } else {
      Alert.alert('Success', 'Account created successfully!');
      setIsLoggedIn(true);
      setCurrentScreen('dashboard');
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentScreen('login');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  const handleNavigateToWorkout = () => {
    setCurrentScreen('workout');
  };

  const handleNavigateToFitness = () => {
    setCurrentScreen('fitness');
  };

  const handleNavigateToMental = () => {
    setCurrentScreen('mental');
  };

  const handleNavigateToEmotional = () => {
    setCurrentScreen('emotional');
  };

  const handleBackToDashboard = () => {
    setCurrentScreen('dashboard');
  };

  // Show Workout Screen
  if (isLoggedIn && currentScreen === 'workout') {
    return <WorkoutScreen onBack={handleBackToDashboard} />;
  }

  // Show Fitness Screen
  if (isLoggedIn && currentScreen === 'fitness') {
    return <FitnessScreen onBack={handleBackToDashboard} onCompleteTask={(taskTitle: string) => {
      // This will be handled by the Dashboard component
      console.log('Task completed:', taskTitle);
    }} />;
  }

  // Show Mental Screen
  if (isLoggedIn && currentScreen === 'mental') {
    return <MentalScreen onBack={handleBackToDashboard} onCompleteTask={(taskTitle: string) => {
      // This will be handled by the Dashboard component
      console.log('Task completed:', taskTitle);
    }} />;
  }

  // Show Emotional Screen
  if (isLoggedIn && currentScreen === 'emotional') {
    return <EmotionalScreen onBack={handleBackToDashboard} onCompleteTask={(taskTitle: string) => {
      // This will be handled by the Dashboard component
      console.log('Task completed:', taskTitle);
    }} />;
  }

  // Show Dashboard if logged in
  if (isLoggedIn && currentScreen === 'dashboard') {
    return <Dashboard onLogout={handleLogout} onNavigateToFitness={handleNavigateToFitness} onNavigateToMental={handleNavigateToMental} onNavigateToEmotional={handleNavigateToEmotional} />;
  }

  // Show Login Screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Text style={styles.logo}>TYLAI</Text>
            <Text style={styles.tagline}>Your AI Fitness Coach</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? 'Sign in to continue your fitness journey'
                : 'Join us and start your fitness transformation'}
            </Text>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
              <Text style={styles.buttonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleButton} onPress={toggleMode}>
              <Text style={styles.toggleText}>
                {isLogin
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#3a3a3a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#4a4a4a',
  },
  button: {
    backgroundColor: '#00ff88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  toggleButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  toggleText: {
    fontSize: 16,
    color: '#00ff88',
    textDecorationLine: 'underline',
  },
  forgotPassword: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#888',
    textDecorationLine: 'underline',
  },
}); 