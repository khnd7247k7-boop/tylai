import type { PhotoSession } from '../types/progressPhotos';
import type { SessionProgressMetrics } from '../types/sessionProgressMetrics';

export type JourneyMilestoneKind = 'weight_loss' | 'strength' | 'consistency' | 'custom';

export interface JourneyMilestone {
  id: string;
  kind: JourneyMilestoneKind;
  emoji: string;
  title: string;
  /** Insert after this session id in the timeline. */
  afterSessionId: string;
}

/**
 * Derive milestone callouts between photo sessions from metric deltas.
 * Pure / deterministic so the timeline feels like a story.
 */
export function buildJourneyMilestones(
  sessions: PhotoSession[],
  metricsById: Map<string, SessionProgressMetrics>
): JourneyMilestone[] {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return [];

  const out: JourneyMilestone[] = [];
  const first = sorted[0];
  const firstMetrics = metricsById.get(first.id);

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const currM = metricsById.get(curr.id);
    if (!currM) continue;

    if (
      firstMetrics?.weight.status === 'available' &&
      currM.weight.status === 'available' &&
      firstMetrics.weight.value != null &&
      currM.weight.value != null
    ) {
      const lost = firstMetrics.weight.value - currM.weight.value;
      if (lost >= 10 && !out.some((m) => m.kind === 'weight_loss')) {
        out.push({
          id: `ms-weight-${curr.id}`,
          kind: 'weight_loss',
          emoji: '🏆',
          title: 'First 10 pounds of change',
          afterSessionId: sorted[i - 1].id,
        });
      }
    }

    if (
      currM.strength.status === 'available' &&
      currM.strength.value != null &&
      currM.strength.value >= 225 &&
      !out.some((m) => m.kind === 'strength')
    ) {
      out.push({
        id: `ms-strength-${curr.id}`,
        kind: 'strength',
        emoji: '💪',
        title: 'Strength breakthrough (225+)',
        afterSessionId: sorted[i - 1].id,
      });
    }

    if (i === 3) {
      out.push({
        id: `ms-consist-${curr.id}`,
        kind: 'consistency',
        emoji: '📸',
        title: 'Four weeks of photo consistency',
        afterSessionId: sorted[i - 1].id,
      });
    }
  }

  return out;
}
