import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Catches render errors so the app shows a message instead of flashing closed.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = this.state.error.message || String(this.state.error);

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>TYLAI could not start</Text>
          <Text style={styles.body}>
            Something crashed while loading the app. If you launched from Xcode, start Metro first:
          </Text>
          <Text style={styles.code}>npx expo start</Text>
          <Text style={styles.body}>Then run:</Text>
          <Text style={styles.code}>npx expo run:ios</Text>
          <Text style={styles.label}>Error</Text>
          <Text style={styles.errorText}>{message}</Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppTheme.bgScreen,
  },
  content: {
    padding: 24,
    paddingTop: 56,
  },
  title: {
    color: AppTheme.accent,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  body: {
    color: AppTheme.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  code: {
    color: '#9ae6b4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    marginBottom: 16,
  },
  label: {
    color: AppTheme.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    lineHeight: 20,
  },
});
