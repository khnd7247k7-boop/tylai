import React from 'react';
import { Apple, Database, Leaf } from 'lucide-react-native';

export interface FoodIconProps {
  size?: number;
  color?: string;
}

/**
 * Category-aware icon: vegetables → Leaf, fruits → Apple, else Database.
 * Pass `foodCategory` from FDC search or detail (`foodCategory.description`).
 */
export function getFoodIcon(category: string, props: FoodIconProps = {}): React.ReactElement {
  const { size = 22, color = '#9ca3af' } = props;
  const c = category.toLowerCase();
  if (/\bfruit|berries|juice|citrus|melon|apple|banana|grape|pear|plum|cherry|berry\b/.test(c)) {
    return <Apple size={size} color={color} strokeWidth={2} accessibilityLabel="Fruit" />;
  }
  if (/\bvegetable|greens|legume|bean|salad|potato|tomato|pepper|onion|carrot|broccoli|kale|lettuce\b/.test(c)) {
    return <Leaf size={size} color={color} strokeWidth={2} accessibilityLabel="Vegetable" />;
  }
  return <Database size={size} color={color} strokeWidth={2} accessibilityLabel="Food database" />;
}
