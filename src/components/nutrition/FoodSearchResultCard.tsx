import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppTheme } from '../../theme/appVisualTheme';
import type { FoodSearchHit } from '../../types/fdcApi';
import { getFoodIcon } from '../../utils/getFoodIcon';

export interface FoodSearchResultCardProps {
  item: FoodSearchHit;
  onPress: () => void;
}

export const FoodSearchResultCard: React.FC<FoodSearchResultCardProps> = ({ item, onPress }) => {
  const cat = item.foodCategory ?? item.dataType ?? '';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.iconWrap}>{getFoodIcon(cat, { size: 24, color: AppTheme.accent })}</View>
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.dataType ?? 'Food'}
          {item.brandOwner ? ` · ${item.brandOwner}` : ''}
          {item.foodCategory ? ` · ${item.foodCategory}` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.card,
    borderRadius: AppTheme.radiusCard,
    borderWidth: 1,
    borderColor: AppTheme.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: AppTheme.textPrimary,
    lineHeight: 21,
  },
  meta: {
    fontSize: 12,
    lineHeight: 17,
    color: AppTheme.textMuted,
    marginTop: 4,
  },
  chevron: {
    fontSize: 22,
    color: AppTheme.textMuted,
    marginLeft: 8,
  },
});
