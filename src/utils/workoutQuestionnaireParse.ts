/** Parse free-text workout questionnaire answers (mirrors WorkoutScreen.parseUserResponses). */

export type ParsedGoal = 'strength' | 'weight_loss' | 'muscle_gain' | 'endurance' | 'flexibility';
export type ParsedLevel = 'beginner' | 'intermediate' | 'advanced';

export function parseGoalFromText(goalText: string): ParsedGoal {
  const t = goalText.toLowerCase();
  if (/\b5k\b|\b10k\b|marathon|\brun(?:ning)?\b|\bjog(?:ging)?\b/.test(t)) {
    return 'endurance';
  }
  if (t.includes('lose') || t.includes('weight') || t.includes('fat') || t.includes('slim')) {
    return 'weight_loss';
  }
  if (t.includes('muscle') || t.includes('gain') || t.includes('bulk') || t.includes('size')) {
    return 'muscle_gain';
  }
  if (t.includes('endurance') || t.includes('cardio') || t.includes('running') || t.includes('stamina')) {
    return 'endurance';
  }
  if (t.includes('flexible') || t.includes('mobility') || t.includes('stretch')) {
    return 'flexibility';
  }
  if (t.includes('strength') || t.includes('strong') || t.includes('lift')) {
    return 'strength';
  }
  return 'strength';
}

export function parseLevelFromText(levelText: string): ParsedLevel {
  const t = levelText.toLowerCase();
  if (t.includes('beginner') || t.includes('new') || t.includes('never') || t.includes('start')) {
    return 'beginner';
  }
  if (t.includes('advanced') || t.includes('expert') || t.includes('experienced') || t.includes('many')) {
    return 'advanced';
  }
  if (t.includes('intermediate') || t.includes('some') || t.includes('few') || t.includes('year')) {
    return 'intermediate';
  }
  return 'beginner';
}

/** Extract training days per week from free text. Defaults to 3 when unclear. */
export function parseDaysPerWeekFromText(frequencyText: string): number {
  const t = frequencyText.toLowerCase().trim();
  if (!t) return 3;

  const dayMatch = t.match(/(\d+)\s*(?:day|time|session|x)/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    if (days >= 1 && days <= 7) return days;
  }

  if (/\bweekends?\s+only\b/.test(t) || /\bsat(?:urday)?\s+and\s+sun(?:day)?\b/.test(t)) return 2;
  if (/\btwice\b|\b2x\b|\btwo times\b/.test(t)) return 2;
  if (/\bonce\b|\b1x\b|\bone time\b/.test(t)) return 1;

  // 9–5 / weekday schedules (e.g. "every morning before work")
  if (
    /\bbefore work\b/.test(t) ||
    /\bevery morning\b/.test(t) ||
    /\bweekdays?\b/.test(t) ||
    /\b(?:monday|mon)(?:day)?\s*(?:through|to|thru|–|-)\s*(?:friday|fri)(?:day)?\b/.test(t) ||
    /\bmon\s*[-–]\s*fri\b/.test(t) ||
    /\b9\s*[-–]\s*5\b/.test(t) ||
    /\bduring the week\b/.test(t)
  ) {
    return 5;
  }

  if (t.includes('three') || /\b3\b/.test(t)) return 3;
  if (t.includes('four') || /\b4\b/.test(t)) return 4;
  if (t.includes('five') || /\b5\b/.test(t)) return 5;
  if (t.includes('six') || /\b6\b/.test(t)) return 6;
  if (t.includes('seven') || t.includes('daily') || t.includes('every day') || /\b7\b/.test(t)) return 7;

  return 3;
}

export function parseWorkoutLengthMinutes(text: string): number | undefined {
  if (!text.trim()) return undefined;
  const match = text.match(/(\d+)/);
  if (!match) return undefined;
  const length = parseInt(match[1], 10);
  if (length >= 15 && length <= 180) return length;
  return undefined;
}

/** True when injuries text likely refers to the back (not phrases like "getting back into it"). */
export function injuriesMentionBack(injuriesText: string): boolean {
  return /\b(lower back|upper back|back pain|back injury|back issues|spine|herniated|disc)\b/i.test(
    injuriesText
  );
}
