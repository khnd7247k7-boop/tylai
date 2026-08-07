import React, { useCallback } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Unmodified FatSecret Platform API attribution snippet (text form).
 * @see https://platform.fatsecret.com/attribution
 * Do not change the link text.
 */
const ATTRIBUTION_LABEL = 'Powered by fatsecret Platform API';
const ATTRIBUTION_URL = 'https://platform.fatsecret.com';

export interface FatSecretAttributionProps {
  style?: StyleProp<ViewStyle>;
}

export const FatSecretAttribution: React.FC<FatSecretAttributionProps> = ({ style }) => {
  const open = useCallback(() => {
    void Linking.openURL(ATTRIBUTION_URL);
  }, []);

  return (
    <View style={[styles.wrap, style]} accessibilityRole="link">
      <TouchableOpacity onPress={open} activeOpacity={0.7} hitSlop={8}>
        <Text style={styles.link}>{ATTRIBUTION_LABEL}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  link: {
    fontSize: 12,
    lineHeight: 16,
    color: '#8B9A8E',
    textDecorationLine: 'underline',
  },
});
