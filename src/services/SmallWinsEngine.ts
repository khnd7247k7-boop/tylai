import { loadUserData, saveUserData } from '../utils/userStorage';
import type { WorkoutSession } from '../../data/workoutPrograms';
import {
  DEFAULT_USER_MILESTONES,
  type SmallWinPayload,
  type UserMilestones,
} from '../types/userMilestones';

const STORAGE_KEY = 'userMilestones';

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function previousCalendarDayKey(dayKey: string): string {
  const d = parseDayKey(dayKey);
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

function daysBetweenKeys(a: string, b: string): number {
  const da = parseDayKey(a).getTime();
  const db = parseDayKey(b).getTime();
  return Math.round((db - da) / (86400 * 1000));
}

function startOfWeekMonday(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function sameTrainingWeek(a: string, b: string): boolean {
  return startOfWeekMonday(new Date(a)) === startOfWeekMonday(new Date(b));
}

const TRACKED_MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'legs',
  'arms',
] as const;

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function loadMilestones(): Promise<UserMilestones> {
  const raw = await loadUserData<UserMilestones>(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_USER_MILESTONES, weekly_set_goals: { ...DEFAULT_USER_MILESTONES.weekly_set_goals } };
  return {
    ...DEFAULT_USER_MILESTONES,
    ...raw,
    weekly_set_goals: { ...DEFAULT_USER_MILESTONES.weekly_set_goals, ...(raw.weekly_set_goals || {}) },
    earned_badges: Array.isArray(raw.earned_badges) ? [...raw.earned_badges] : [],
    volume_king_muscles: Array.isArray(raw.volume_king_muscles) ? [...raw.volume_king_muscles] : [],
    recovery_pro_awarded_at: Array.isArray(raw.recovery_pro_awarded_at) ? [...raw.recovery_pro_awarded_at] : [],
  };
}

async function saveMilestones(m: UserMilestones): Promise<void> {
  await saveUserData(STORAGE_KEY, m);
}

function sessionTonnage(session: WorkoutSession): number {
  let volume = 0;
  if (!session.completed) return 0;
  for (const ex of session.exercises || []) {
    for (const st of ex.sets || []) {
      if (!st.completed || st.weight <= 0 || st.reps <= 0) continue;
      volume += st.weight * st.reps;
    }
  }
  return volume;
}

/** Map exercise name to muscle keys using simple keyword rules (best-effort without DB join). */
function inferMusclesFromExerciseName(name: string): string[] {
  const n = name.toLowerCase();
  const out = new Set<string>();
  if (/(bench|push-up|pushup|fly|pec|chest|dip)/i.test(n)) out.add('chest');
  if (/(row|pull|lat|pulldown|deadlift|back)/i.test(n)) out.add('back');
  if (/(shoulder|press|lateral raise|rear delt|deltoid|ohp|overhead)/i.test(n)) out.add('shoulders');
  if (/(curl|bicep)/i.test(n)) out.add('biceps');
  if (/(tricep|extension|skull|pushdown)/i.test(n)) out.add('triceps');
  if (/(squat|leg press|lunge|quad|extension)/i.test(n)) out.add('quadriceps');
  if (/(rdl|romanian|hamstring|curl leg)/i.test(n)) out.add('hamstrings');
  if (/(hip thrust|glute|bridge)/i.test(n)) out.add('glutes');
  if (/(calf|calves)/i.test(n)) out.add('calves');
  if (/(leg|lower body)/i.test(n) && out.size === 0) out.add('legs');
  if (/(arm)/i.test(n) && out.size === 0) out.add('arms');
  return [...out];
}

function accumulateSessionIntoMuscleSets(session: WorkoutSession, target: Map<string, number>): number {
  let volume = 0;
  if (!session.completed) return 0;
  for (const ex of session.exercises || []) {
    const muscles = inferMusclesFromExerciseName(ex.name);
    for (const st of ex.sets || []) {
      if (!st.completed || st.weight <= 0 || st.reps <= 0) continue;
      volume += st.weight * st.reps;
      const setCount = 1;
      for (const m of muscles.length ? muscles : []) {
        target.set(m, (target.get(m) || 0) + setCount);
      }
    }
  }
  return volume;
}

function bestWeightRepsPerExercise(session: WorkoutSession): Map<string, { weight: number; reps: number }> {
  const map = new Map<string, { weight: number; reps: number }>();
  for (const ex of session.exercises || []) {
    const key = normalizeExerciseName(ex.name);
    let bestW = 0;
    let bestR = 0;
    for (const st of ex.sets || []) {
      if (!st.completed) continue;
      if (st.weight > bestW || (st.weight === bestW && st.reps > bestR)) {
        bestW = st.weight;
        bestR = st.reps;
      }
    }
    if (bestW > 0) map.set(key, { weight: bestW, reps: bestR });
  }
  return map;
}

function computeConsistencyScore(m: UserMilestones, history: WorkoutSession[]): number {
  const last30 = new Date();
  last30.setDate(last30.getDate() - 30);
  const recent = history.filter((s) => s.completed && new Date(s.date) >= last30);
  const freq = Math.min(1, recent.length / 12);
  const logger = Math.min(1, m.workout_logger_open_streak / 14);
  return Math.round(Math.min(100, freq * 55 + logger * 45));
}

function hasBadge(m: UserMilestones, id: string): boolean {
  return m.earned_badges.includes(id);
}

function markBadge(m: UserMilestones, id: string, wins: SmallWinPayload[], payload: SmallWinPayload) {
  if (m.earned_badges.includes(id)) return;
  m.earned_badges.push(id);
  m.last_small_win_at = new Date().toISOString();
  wins.push(payload);
}

export async function onWorkoutLoggerOpened(userName: string, userGoal: string): Promise<SmallWinPayload[]> {
  const m = await loadMilestones();
  const wins: SmallWinPayload[] = [];
  const today = localDateKey(new Date());
  const last = m.last_workout_logger_open_day;

  if (last === today) {
    await saveMilestones(m);
    return wins;
  }

  if (!last) {
    m.workout_logger_open_streak = 1;
  } else {
    const gap = daysBetweenKeys(last, today);
    if (gap === 1) m.workout_logger_open_streak += 1;
    else if (gap === 0) {
      /* same day handled above */
    } else m.workout_logger_open_streak = 1;
  }
  m.last_workout_logger_open_day = today;

  const showUpId = 'show_up';
  if (m.workout_logger_open_streak >= 3 && !hasBadge(m, showUpId)) {
    markBadge(m, showUpId, wins, {
      badgeId: 'show_up',
      emoji: '📅',
      headline: 'Small Win Detected!',
      actionLine: `${userName || 'You'}, you just opened the workout logger 3 days in a row.`,
      whyItMatters:
        'Consistency beats intensity for habit formation: showing up rewires your brain to expect training, which predicts long-term adherence.',
    });
  }

  const hist = (await loadUserData<WorkoutSession[]>('workoutHistory')) || [];
  m.consistency_score = computeConsistencyScore(m, hist);
  await saveMilestones(m);
  return wins;
}

export async function onWorkoutSessionSaved(
  session: WorkoutSession,
  userName: string,
  userGoal: string
): Promise<SmallWinPayload[]> {
  const m = await loadMilestones();
  const wins: SmallWinPayload[] = [];
  if (m.last_processed_session_id === session.id) {
    return wins;
  }
  m.last_processed_session_id = session.id;

  const rawHistory = (await loadUserData<WorkoutSession[]>('workoutHistory')) || [];
  const seenIds = new Set<string>();
  const history: WorkoutSession[] = [];
  for (const s of rawHistory) {
    if (seenIds.has(s.id)) continue;
    seenIds.add(s.id);
    history.push(s);
  }
  const completedHistory = history.filter((s) => s.completed && s.id !== session.id);

  const addVol = sessionTonnage(session);
  m.total_weight_lifted += addVol;
  m.sessions_completed += 1;

  const dayKey = localDateKey(new Date(session.date));
  if (m.last_session_day === dayKey) {
    /* second+ session same calendar day: keep streak */
  } else if (!m.last_session_day) {
    m.streak_count = 1;
  } else if (daysBetweenKeys(m.last_session_day, dayKey) === 1) {
    m.streak_count += 1;
  } else {
    m.streak_count = 1;
  }
  m.last_session_day = dayKey;

  const prevSession = completedHistory
    .filter((s) => new Date(s.date) < new Date(session.date))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  if (prevSession) {
    const prevBest = bestWeightRepsPerExercise(prevSession);
    const curBest = bestWeightRepsPerExercise(session);
    let improved = false;
    for (const [exName, cur] of curBest) {
      const p = prevBest.get(exName);
      if (!p) continue;
      if (cur.weight > p.weight || (cur.weight === p.weight && cur.reps > p.reps)) {
        improved = true;
        break;
      }
    }
    if (improved) {
      m.last_small_win_at = new Date().toISOString();
      wins.push({
        badgeId: 'level_up',
        emoji: '📈',
        headline: 'Small Win Detected!',
        actionLine: `${userName || 'You'}, you just beat your last session on weight or reps for at least one lift.`,
        whyItMatters:
          'Progressive overload is the main driver of strength and muscle gain: even small increases signal your body to adapt.',
      });
    }
  }

  const weeklyMuscle = new Map<string, number>();
  for (const s of history) {
    if (!s.completed) continue;
    if (!sameTrainingWeek(s.date, session.date)) continue;
    accumulateSessionIntoMuscleSets(s, weeklyMuscle);
  }

  for (const muscle of TRACKED_MUSCLES) {
    const goal = m.weekly_set_goals[muscle] ?? 10;
    const total = weeklyMuscle.get(muscle) || 0;
    if (total < goal) continue;
    if (m.volume_king_muscles.includes(muscle)) continue;
    m.volume_king_muscles.push(muscle);
    const vkId = `volume_king:${muscle}`;
    m.earned_badges.push(vkId);
    m.last_small_win_at = new Date().toISOString();
    wins.push({
      badgeId: 'volume_king',
      detail: muscle,
      emoji: '👑',
      headline: 'Small Win Detected!',
      actionLine: `${userName || 'You'}, you just hit your weekly set goal for ${muscle} (${goal}+ sets this week).`,
      whyItMatters:
        'Hitting a volume target for a muscle group means you have likely crossed the minimum stimulus threshold for growth this week.',
    });
  }

  m.consistency_score = computeConsistencyScore(m, [...history, session]);
  await saveMilestones(m);
  return wins;
}

export async function onSleepHoursLogged(
  hours: number,
  userName: string,
  userGoal: string
): Promise<SmallWinPayload[]> {
  if (hours < 7) return [];
  const m = await loadMilestones();
  const wins: SmallWinPayload[] = [];
  const today = localDateKey(new Date());
  const recent = m.recovery_pro_awarded_at.filter((iso) => localDateKey(new Date(iso)) === today);
  if (recent.length > 0) {
    return wins;
  }

  const id = 'recovery_pro';
  m.recovery_pro_awarded_at.push(new Date().toISOString());
  m.last_small_win_at = new Date().toISOString();
  if (!m.earned_badges.includes(id)) m.earned_badges.push(id);
  wins.push({
    badgeId: 'recovery_pro',
    emoji: '😴',
    headline: 'Small Win Detected!',
    actionLine: `${userName || 'You'}, you just logged 7+ hours of sleep — prime recovery time.`,
    whyItMatters:
      'Deep sleep is when growth hormone peaks and muscle repair accelerates; skimping here blunts training gains.',
  });
  await saveMilestones(m);
  return wins;
}

export async function onMobilityOnRestDay(
  userName: string,
  userGoal: string,
  exerciseTitle: string
): Promise<SmallWinPayload[]> {
  const history = (await loadUserData<WorkoutSession[]>('workoutHistory')) || [];
  const today = localDateKey(new Date());
  const trainedToday = history.some(
    (s) => s.completed && localDateKey(new Date(s.date)) === today
  );
  if (trainedToday) return [];

  const m = await loadMilestones();
  const wins: SmallWinPayload[] = [];
  if (m.recovery_pro_awarded_at.some((iso) => localDateKey(new Date(iso)) === today)) return wins;

  m.recovery_pro_awarded_at.push(new Date().toISOString());
  m.last_small_win_at = new Date().toISOString();
  if (!m.earned_badges.includes('recovery_pro')) m.earned_badges.push('recovery_pro');
  wins.push({
    badgeId: 'recovery_pro',
    emoji: '🧘',
    headline: 'Small Win Detected!',
    actionLine: `${userName || 'You'}, you completed "${exerciseTitle}" on a rest day — smart recovery.`,
    whyItMatters:
      'Active recovery and mobility improve blood flow and joint range of motion, which supports your next hard session.',
  });
  await saveMilestones(m);
  return wins;
}

export async function getLastSmallWinAgeDays(): Promise<number | null> {
  const m = await loadMilestones();
  if (!m.last_small_win_at) return null;
  const ms = Date.now() - new Date(m.last_small_win_at).getTime();
  return ms / 86400000;
}
