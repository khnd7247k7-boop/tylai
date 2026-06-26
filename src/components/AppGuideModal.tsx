import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { APP_GUIDE_STEPS } from '../constants/appGuideSteps';
import { markAppGuideCompleted, markAppGuideDismissed } from '../utils/appGuide';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Native app guide — same five-step flow as the web spotlight tour.
 * Full-screen overlay (not RN Modal) for reliable taps with the tab bar.
 */
export default function AppGuideModal({ visible, onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  const step = APP_GUIDE_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === APP_GUIDE_STEPS.length - 1;

  const finish = useCallback(async () => {
    try {
      await markAppGuideCompleted();
    } catch (e) {
      console.warn('[AppGuide] Could not persist completion', e);
    }
    onClose();
  }, [onClose]);

  const skip = useCallback(async () => {
    try {
      await markAppGuideDismissed();
    } catch (e) {
      console.warn('[AppGuide] Could not persist dismiss', e);
    }
    onClose();
  }, [onClose]);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, APP_GUIDE_STEPS.length - 1));
  }, [finish, isLast]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  if (!visible || !step) return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityRole="alert">
      <View style={styles.card}>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.content}>{step.content}</Text>

        <View style={styles.buttonChip}>
          <Text style={styles.buttonChipText}>{step.button}</Text>
        </View>

        <Text style={styles.tapPrompt}>{step.tapPrompt}</Text>

        <View style={styles.actions}>
          <View style={styles.navRow}>
            {!isFirst ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous step"
                onPress={goBack}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
              >
                <Text style={styles.secondaryBtnText}>Back</Text>
              </Pressable>
            ) : (
              <View style={styles.navSpacer} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Finish app guide' : 'Next step'}
              onPress={goNext}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.primaryBtnText}>{isLast ? 'Done' : 'Next'}</Text>
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.stepLabel}>
              STEP {stepIndex + 1} OF {APP_GUIDE_STEPS.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip app guide for now"
              onPress={skip}
              style={({ pressed }) => [pressed && styles.btnPressed]}
            >
              <Text style={styles.skipBtnText}>Skip tour</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200001,
    elevation: 200001,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
    maxHeight: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  title: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  content: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  buttonChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  buttonChipText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '800',
  },
  tapPrompt: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 16,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  actions: {
    marginTop: 4,
    gap: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navSpacer: {
    flex: 1,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  stepLabel: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skipBtnText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  btnPressed: {
    opacity: 0.85,
  },
});
