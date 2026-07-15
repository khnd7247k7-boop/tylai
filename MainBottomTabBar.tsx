import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme } from './src/theme/appVisualTheme';
import { TOUR_TARGET_IDS } from './src/tour/tourTargets';
import { fireTourTargetIfNeeded } from './src/tour/fireTourTarget';
import { useTourTargetRef } from './src/tour/useTourTargetRef';

/** Vertical space for tab chrome only (paddingTop + bar row); safe-area inset is added separately by callers. */
export const MAIN_TAB_BAR_CHROME_HEIGHT = 78;

export type MainBottomTabId = 'dashboard' | 'workouts' | 'nutrition' | 'progress' | 'more';

interface MainBottomTabBarProps {
  activeTab: MainBottomTabId;
  onTabPress: (tab: MainBottomTabId) => void;
}

const inactiveColor = '#9ca3af';
const activeColor = '#00ff88';

function DashboardIcon({ active }: { active: boolean }) {
  const c = active ? activeColor : inactiveColor;
  return (
    <View style={styles.iconGrid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={[styles.gridCell, { borderColor: c }]} />
      ))}
    </View>
  );
}

function WorkoutsIcon({ active }: { active: boolean }) {
  const c = active ? activeColor : inactiveColor;
  return (
    <View style={styles.dumbbellRow}>
      <View style={[styles.dumbbellPlate, { borderColor: c, backgroundColor: active ? `${activeColor}22` : 'transparent' }]} />
      <View style={[styles.dumbbellBar, { backgroundColor: c }]} />
      <View style={[styles.dumbbellPlate, { borderColor: c, backgroundColor: active ? `${activeColor}22` : 'transparent' }]} />
    </View>
  );
}

function NutritionIcon({ active }: { active: boolean }) {
  return (
    <Text style={[styles.emojiIcon, { opacity: active ? 1 : 0.55 }]} allowFontScaling={false}>
      🍎
    </Text>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  const c = active ? activeColor : inactiveColor;
  return (
    <View style={styles.progressIcon}>
      <View style={[styles.progressBar, styles.progressBarShort, { backgroundColor: c }]} />
      <View style={[styles.progressBar, styles.progressBarMid, { backgroundColor: c }]} />
      <View style={[styles.progressBar, styles.progressBarTall, { backgroundColor: c }]} />
    </View>
  );
}

function MoreIcon({ active }: { active: boolean }) {
  const c = active ? activeColor : inactiveColor;
  return (
    <View style={styles.moreRow}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.moreDot, { backgroundColor: c }]} />
      ))}
    </View>
  );
}

export default function MainBottomTabBar({ activeTab, onTabPress }: MainBottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  const tabWorkoutsRef = useTourTargetRef(TOUR_TARGET_IDS.tabWorkouts);
  const tabNutritionRef = useTourTargetRef(TOUR_TARGET_IDS.tabNutrition);
  const tabMoreRef = useTourTargetRef(TOUR_TARGET_IDS.tabMore);

  const tabs: { id: MainBottomTabId; label: string; Icon: React.FC<{ active: boolean }> }[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: DashboardIcon },
    { id: 'workouts', label: 'Workouts', Icon: WorkoutsIcon },
    { id: 'nutrition', label: 'Nutrition', Icon: NutritionIcon },
    { id: 'progress', label: 'Progress', Icon: ProgressIcon },
    { id: 'more', label: 'More', Icon: MoreIcon },
  ];

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      <View style={styles.bar}>
        {tabs.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          const tourId =
            id === 'workouts'
              ? TOUR_TARGET_IDS.tabWorkouts
              : id === 'nutrition'
                ? TOUR_TARGET_IDS.tabNutrition
                : id === 'more'
                  ? TOUR_TARGET_IDS.tabMore
                  : undefined;
          const tourRef =
            id === 'workouts'
              ? tabWorkoutsRef
              : id === 'nutrition'
                ? tabNutritionRef
                : id === 'more'
                  ? tabMoreRef
                  : undefined;
          return (
            <TouchableOpacity
              key={id}
              style={styles.tab}
              ref={tourRef}
              onPress={() => {
                onTabPress(id);
                fireTourTargetIfNeeded(tourId);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
              nativeID={tourId}
            >
              <View
                style={[
                  styles.iconGlowWrap,
                  active && styles.iconGlowWrapActive,
                ]}
              >
                <Icon active={active} />
              </View>
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: AppTheme.bgScreen,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161616',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 10,
    paddingHorizontal: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 12 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 2,
  },
  iconGlowWrap: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconGlowWrapActive: {
    ...Platform.select({
      ios: {
        shadowColor: '#00ff88',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: inactiveColor,
    textAlign: 'center',
  },
  labelActive: {
    color: activeColor,
    fontWeight: '700',
  },
  iconGrid: {
    width: 22,
    height: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  gridCell: {
    width: 9,
    height: 9,
    borderWidth: 1.5,
    borderRadius: 2,
    marginBottom: 2,
  },
  dumbbellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
  },
  dumbbellPlate: {
    width: 7,
    height: 16,
    borderRadius: 2,
    borderWidth: 1.5,
  },
  dumbbellBar: {
    width: 12,
    height: 3,
    borderRadius: 1,
    marginHorizontal: 1,
  },
  emojiIcon: {
    fontSize: 22,
    lineHeight: 26,
    textAlign: 'center',
  },
  progressIcon: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 22,
    gap: 3,
  },
  progressBar: {
    width: 5,
    borderRadius: 2,
  },
  progressBarShort: {
    height: 8,
    opacity: 0.55,
  },
  progressBarMid: {
    height: 14,
    opacity: 0.8,
  },
  progressBarTall: {
    height: 20,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
  },
  moreDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
});
