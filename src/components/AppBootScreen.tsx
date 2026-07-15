import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

/** Branded launch view — black background, centered TYL monogram (matches app icon). */
export default function AppBootScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image
        source={require('../../assets/icon.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="TYL"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 168,
    height: 168,
  },
});
