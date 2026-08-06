import type {
  RecurringMealRule,
  RecurringMealTemplate,
  Weekday,
} from '../types/recurringMeals';
import { EVERY_DAY } from '../types/recurringMeals';
import type { LoggedMeal, LoggedMealSlot } from './loggedMeals';
import {
  localDateKeyFromIso,
  normalizeLoggedMealSlot,
  resolveLoggedMealSlot,
} from './loggedMeals';
import { loadUserData, saveUserData } from './userStorage';
import { cloneSavedMealItems } from './savedMealsStorage';

const RULES_KEY = 'recurringMealRules';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

function addDaysKey(key: string, days: number): string {
  const dt = parseDateKey(key);
  if (!dt) return key;
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function weekdayOfKey(key: string): Weekday | null {
  const dt = parseDateKey(key);
  if (!dt) return null;
  return dt.getDay() as Weekday;
}

function dateKeyToNoonIso(key: string): string {
  const dt = parseDateKey(key);
  if (!dt) return new Date().toISOString();
  return dt.toISOString();
}

function normalizeWeekdays(raw: unknown): Weekday[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...EVERY_DAY];
  const out: Weekday[] = [];
  for (const v of raw) {
    const n = Number(v);
    if (n >= 0 && n <= 6 && !out.includes(n as Weekday)) out.push(n as Weekday);
  }
  return out.length ? out.sort((a, b) => a - b) : [...EVERY_DAY];
}

function normalizeRule(raw: Partial<RecurringMealRule> | null | undefined): RecurringMealRule | null {
  if (!raw?.template?.name?.trim()) return null;
  const slot =
    normalizeLoggedMealSlot(raw.template.mealSlot) ??
    resolveLoggedMealSlot({
      mealSlot: raw.template.mealSlot,
      name: raw.template.name,
      date: new Date().toISOString(),
    });
  const startDate = String(raw.startDate ?? todayKey()).slice(0, 10);
  if (!parseDateKey(startDate)) return null;
  const endRaw = raw.endDate == null || raw.endDate === '' ? null : String(raw.endDate).slice(0, 10);
  if (endRaw && !parseDateKey(endRaw)) return null;

  return {
    id: String(raw.id ?? `recur-${Date.now()}`),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    active: raw.active !== false,
    template: {
      name: String(raw.template.name).trim(),
      calories: Number(raw.template.calories) || 0,
      protein: Number(raw.template.protein) || 0,
      carbs: Number(raw.template.carbs) || 0,
      fat: Number(raw.template.fat) || 0,
      mealSlot: slot,
      time: raw.template.time,
      servings: raw.template.servings,
      baseProtein: raw.template.baseProtein,
      baseCarbs: raw.template.baseCarbs,
      baseFat: raw.template.baseFat,
      servingAmount: raw.template.servingAmount,
      servingUnit: raw.template.servingUnit,
      items: cloneSavedMealItems(raw.template.items),
    },
    weekdays: normalizeWeekdays(raw.weekdays),
    startDate,
    endDate: endRaw,
  };
}

export async function loadRecurringMealRules(): Promise<RecurringMealRule[]> {
  const raw = (await loadUserData<RecurringMealRule[]>(RULES_KEY)) ?? [];
  return raw.map(normalizeRule).filter((r): r is RecurringMealRule => !!r);
}

export async function saveRecurringMealRules(rules: RecurringMealRule[]): Promise<void> {
  await saveUserData(RULES_KEY, rules);
}

export function templateFromLoggedMeal(
  meal: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    time?: string;
    date: string;
    mealSlot?: string;
    servings?: number;
    baseProtein?: number;
    baseCarbs?: number;
    baseFat?: number;
    servingAmount?: string;
    servingUnit?: string;
    items?: RecurringMealTemplate['items'];
  },
  preferredSlot?: LoggedMealSlot
): RecurringMealTemplate {
  const mealSlot =
    preferredSlot ??
    normalizeLoggedMealSlot(meal.mealSlot) ??
    resolveLoggedMealSlot(meal);
  return {
    name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    mealSlot,
    time: meal.time,
    servings: meal.servings,
    baseProtein: meal.baseProtein,
    baseCarbs: meal.baseCarbs,
    baseFat: meal.baseFat,
    servingAmount: meal.servingAmount,
    servingUnit: meal.servingUnit,
    items: cloneSavedMealItems(meal.items),
  };
}

export async function addRecurringMealRule(
  input: Omit<RecurringMealRule, 'id' | 'createdAt' | 'active'> & { active?: boolean }
): Promise<RecurringMealRule> {
  const rule = normalizeRule({
    ...input,
    id: `recur-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    active: input.active !== false,
  });
  if (!rule) throw new Error('Invalid recurring meal rule');
  const existing = await loadRecurringMealRules();
  await saveRecurringMealRules([rule, ...existing]);
  return rule;
}

export async function deactivateRecurringMealRule(ruleId: string): Promise<void> {
  const rules = await loadRecurringMealRules();
  const next = rules.map((r) => (r.id === ruleId ? { ...r, active: false } : r));
  await saveRecurringMealRules(next);
}

function ruleMatchesDate(rule: RecurringMealRule, dateKey: string): boolean {
  if (!rule.active) return false;
  if (dateKey < rule.startDate) return false;
  if (rule.endDate && dateKey > rule.endDate) return false;
  const wd = weekdayOfKey(dateKey);
  if (wd == null) return false;
  const days = rule.weekdays.length ? rule.weekdays : EVERY_DAY;
  return days.includes(wd);
}

function alreadyMaterialized(
  meals: Array<LoggedMeal & { recurringRuleId?: string }>,
  ruleId: string,
  dateKey: string
): boolean {
  return meals.some(
    (m) =>
      m.recurringRuleId === ruleId && localDateKeyFromIso(m.date) === dateKey
  );
}

function buildMealFromRule(
  rule: RecurringMealRule,
  dateKey: string
): LoggedMeal & { recurringRuleId: string } {
  const t = rule.template;
  const now = new Date();
  const time =
    t.time ||
    now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return {
    id: `meal-recur-${rule.id}-${dateKey}`,
    name: t.name,
    calories: t.calories,
    protein: t.protein,
    carbs: t.carbs,
    fat: t.fat,
    time,
    date: dateKeyToNoonIso(dateKey),
    mealSlot: t.mealSlot,
    servings: t.servings,
    baseProtein: t.baseProtein,
    baseCarbs: t.baseCarbs,
    baseFat: t.baseFat,
    servingAmount: t.servingAmount,
    servingUnit: t.servingUnit,
    items: cloneSavedMealItems(t.items),
    recurringRuleId: rule.id,
  };
}

/**
 * Materialize recurring meals from each rule's start (capped lookback) through `throughDateKey`.
 * Idempotent via stable ids / recurringRuleId + date.
 */
export async function materializeRecurringMeals(opts?: {
  throughDateKey?: string;
  /** How far back from throughDate to fill (default 45). */
  lookbackDays?: number;
}): Promise<LoggedMeal[]> {
  const through = opts?.throughDateKey ?? todayKey();
  const lookback = opts?.lookbackDays ?? 45;
  const rules = (await loadRecurringMealRules()).filter((r) => r.active);
  const meals = ((await loadUserData<LoggedMeal[]>('meals')) ?? []) as Array<
    LoggedMeal & { recurringRuleId?: string }
  >;

  if (!rules.length) return meals;

  const windowStart = addDaysKey(through, -lookback);
  const additions: LoggedMeal[] = [];

  for (const rule of rules) {
    let cursor = rule.startDate > windowStart ? rule.startDate : windowStart;
    const end = rule.endDate && rule.endDate < through ? rule.endDate : through;
    while (cursor <= end) {
      if (ruleMatchesDate(rule, cursor) && !alreadyMaterialized(meals, rule.id, cursor)) {
        // Also skip if stable id already present
        const id = `meal-recur-${rule.id}-${cursor}`;
        if (!meals.some((m) => m.id === id) && !additions.some((m) => m.id === id)) {
          additions.push(buildMealFromRule(rule, cursor));
        }
      }
      cursor = addDaysKey(cursor, 1);
    }
  }

  if (!additions.length) return meals;

  const next = [...meals, ...additions];
  await saveUserData('meals', next);
  return next;
}

export function describeRecurrence(weekdays: Weekday[], endDate: string | null): string {
  const days = weekdays.length ? [...weekdays].sort((a, b) => a - b) : [...EVERY_DAY];
  let when: string;
  if (days.length === 7) when = 'Every day';
  else if (days.length === 5 && days.every((d) => d >= 1 && d <= 5)) when = 'Weekdays';
  else if (days.length === 2 && days.includes(0) && days.includes(6)) when = 'Weekends';
  else {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    when = days.map((d) => labels[d]).join(', ');
  }
  if (!endDate) return `${when} · ongoing`;
  return `${when} · until ${endDate}`;
}
