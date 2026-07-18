import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';

type Props = { children: ReactNode };
type State = { error: Error | null; clearing: boolean };

/**
 * Catches render errors so the app shows a message instead of flashing closed.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, clearing: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  handleTryAgain = () => {
    this.setState({ error: null, clearing: false });
  };

  handleResetSession = async () => {
    this.setState({ clearing: true });
    try {
      const { auth } = await import('../../firebaseConfig');
      if (auth && !auth._isMock && typeof auth.signOut === 'function') {
        await auth.signOut();
      }
    } catch (error) {
      console.warn('[AppErrorBoundary] signOut during reset failed', error);
    } finally {
      this.setState({ error: null, clearing: false });
    }
  };

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
            Something went wrong while loading the app. Try again. If it keeps happening, reset your
            session and sign in again.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={this.handleTryAgain}
            disabled={this.state.clearing}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Try again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => void this.handleResetSession()}
            disabled={this.state.clearing}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>
              {this.state.clearing ? 'Resetting…' : 'Reset session & continue'}
            </Text>
          </TouchableOpacity>

          {__DEV__ ? (
            <>
              <Text style={styles.body}>
                Dev tip: if you launched from Xcode, start Metro first (`npx expo start`), then rebuild.
              </Text>
            </>
          ) : (
            <Text style={styles.body}>
              If this continues after resetting, delete and reinstall TYLAI from TestFlight, then try
              signing in again.
            </Text>
          )}

          <Text style={styles.label}>Error details (for support)</Text>
          <Text style={styles.errorText} selectable>
            {message}
          </Text>
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
    paddingBottom: 40,
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
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: AppTheme.accentDark,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  secondaryBtnText: {
    color: AppTheme.textPrimary,
    fontSize: 15,
    fontWeight: '700',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
