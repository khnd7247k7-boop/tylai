import { Platform } from 'react-native';
import { notifyTourTargetActivated } from './tourActivation';

/** Notify the spotlight tour that a highlighted control was pressed (web + native). */
export function fireTourTargetIfNeeded(targetId: string | undefined): void {
  if (targetId) {
    notifyTourTargetActivated(targetId);
  }
}
