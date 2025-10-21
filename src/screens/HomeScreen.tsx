import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to TYLAI</Text>
      <Text style={styles.subtitle}>Your AI Fitness Coach</Text>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Start Workout" 
          onPress={() => navigation.navigate('Workout')} 
        />
        <Button 
          title="View Progress" 
          onPress={() => navigation.navigate('Progress')} 
        />
        <Button 
          title="Profile" 
          onPress={() => navigation.navigate('Profile')} 
        />
        <Button 
          title="Sign Out" 
          onPress={handleSignOut}
          color="red" 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
}); 