import React from 'react';
import { Platform } from 'react-native';
import NativeSpotlightTour from './NativeSpotlightTour';
import SpotlightTour from './SpotlightTour';
import type { TourNavHandlers } from './types';

type Props = {
  visible: boolean;
  onClose: () => void;
  nav: TourNavHandlers;
};

/** Immersive spotlight tour on web and native; navigates across Dashboard → Workouts → Nutrition → More. */
export default function PlatformAppGuide({ visible, onClose, nav }: Props) {
  if (Platform.OS === 'web') {
    return <SpotlightTour visible={visible} onClose={onClose} nav={nav} />;
  }
  return <NativeSpotlightTour visible={visible} onClose={onClose} nav={nav} />;
}
