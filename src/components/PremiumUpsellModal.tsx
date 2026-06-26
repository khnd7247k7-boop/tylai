import React from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppTheme } from '../theme/appVisualTheme';
import type { FeatureTierEntry } from '../constants/featureTiers';
import { useSubscription } from '../context/SubscriptionContext';
import { getBetaPaymentUrl } from '../services/betaAccessService';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Optional headline when opened from a specific feature. */
  highlightFeature?: string;
};

function FeatureList({ title, items, accent }: { title: string; items: FeatureTierEntry[]; accent: string }) {
  return (
    <View style={styles.listBlock}>
      <Text style={[styles.listTitle, { color: accent }]}>{title}</Text>
      {items.map((f) => (
        <View key={f.id} style={styles.featureRow}>
          <Text style={styles.featureBullet}>•</Text>
          <View style={styles.featureTextCol}>
            <Text style={styles.featureLabel}>{f.label}</Text>
            <Text style={styles.featureDesc}>{f.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PremiumUpsellModal({ visible, onClose, highlightFeature }: Props) {
  const { basicFeatures, premiumFeatures, isPremium, setDevPremiumOverride } = useSubscription();

  const handleUpgrade = async () => {
    if (__DEV__) {
      await setDevPremiumOverride(true);
      onClose();
      return;
    }

    const paymentUrl = getBetaPaymentUrl();
    if (paymentUrl) {
      try {
        await Linking.openURL(paymentUrl);
      } catch {
        Alert.alert(
          'Open payment page',
          'Visit our website to complete beta payment, then sign in here with the same email.'
        );
      }
      onClose();
      return;
    }

    Alert.alert(
      'Premium unavailable',
      'Beta payment is not configured yet. Contact support if you already paid.'
    );
    onClose();
  };

  if (isPremium) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.heading}>TYL Premium</Text>
          {highlightFeature ? (
            <Text style={styles.highlight}>
              <Text style={styles.highlightFeature}>{highlightFeature}</Text> is part of Premium — powered by Gemini AI.
            </Text>
          ) : (
            <Text style={styles.subheading}>
              Unlock AI coaching and smart restaurant search. Everything else stays on Basic.
            </Text>
          )}

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <FeatureList title="Included with Basic" items={basicFeatures} accent={AppTheme.textMuted} />
            <FeatureList title="Premium (Gemini AI)" items={premiumFeatures} accent={AppTheme.accent} />
          </ScrollView>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleUpgrade} activeOpacity={0.88}>
            <Text style={styles.primaryBtnText}>
              {__DEV__ ? 'Enable Premium (dev)' : 'Get Premium on the web'}
            </Text>
          </TouchableOpacity>
          {!__DEV__ ? (
            <Text style={styles.betaNote}>
              Pay on our website with the same email you use in the app. Premium unlocks automatically on TestFlight after payment.
            </Text>
          ) : null}
          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.secondaryBtnText}>Not now</Text>
          </TouchableOpacity>
          {__DEV__ ? (
            <Text style={styles.devNote}>
              Dev builds can toggle Premium in Settings → Subscription. Set EXPO_PUBLIC_GRANT_PREMIUM=true to auto-grant.
            </Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: '#333',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    marginTop: 10,
    marginBottom: 14,
  },
  heading: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subheading: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  highlight: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  highlightFeature: {
    color: AppTheme.accent,
    fontWeight: '800',
  },
  scroll: {
    maxHeight: 340,
    marginBottom: 16,
  },
  listBlock: {
    marginBottom: 18,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  featureRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  featureBullet: {
    color: '#666',
    marginRight: 8,
    marginTop: 1,
  },
  featureTextCol: {
    flex: 1,
  },
  featureLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  featureDesc: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: AppTheme.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: AppTheme.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  devNote: {
    color: '#666',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 12,
    textAlign: 'center',
  },
  betaNote: {
    color: '#888',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
    textAlign: 'center',
  },
});
