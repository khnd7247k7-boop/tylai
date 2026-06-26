import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppTheme } from '../../theme/appVisualTheme';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches render errors in the USDA nutrition subtree so API/timeout issues surfaced in UI do not white-screen the app.
 */
export class FdcNutritionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || 'Something went wrong' };
  }

  componentDidCatch(err: Error, info: ErrorInfo): void {
    if (__DEV__) {
      console.warn('[FdcNutritionErrorBoundary]', err, info.componentStack);
    }
  }

  private reset = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, message: '' });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Nutrition search unavailable</Text>
          <Text style={styles.body}>{this.state.message}</Text>
          <TouchableOpacity style={styles.btn} onPress={this.reset} activeOpacity={0.88}>
            <Text style={styles.btnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: AppTheme.bgScreen,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: AppTheme.textPrimary,
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    marginBottom: 20,
  },
  btn: {
    alignSelf: 'stretch',
    backgroundColor: AppTheme.accent,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: AppTheme.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '900',
    color: AppTheme.accentDark,
    letterSpacing: 0.5,
  },
});
