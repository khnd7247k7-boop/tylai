# Blueprint vs codebase audit (2026 behavior layer & compliance)

This document maps the requested blueprint to **current** `tyl-ai-app` implementation, flags gaps, and lists refactors. **Canonical product UI is React Native (Expo)**; native Swift under `ios/TYLAI/` is supplementary (HealthKit dashboard, legal view).

## 1. Small Wins / milestone engine

| Blueprint | Status | Location / notes |
|-----------|--------|------------------|
| Triggers: streaks, 1RM-style progress, weekly set volume | **Implemented** | `src/services/SmallWinsEngine.ts` — logger open streak (Show Up), per-exercise weight/reps improvement vs previous session (Level Up), weekly muscle set goals (Volume King), sleep/mobility (Recovery Pro). |
| 3-day **workout completion** streak | **Partial** | Streak in engine is tied to **opening workout logger** (`onWorkoutLoggerOpened`), not strictly 3 completed workouts in a row. **Refactor:** add `workout_session_streak` from `workoutHistory` calendar days if product wants “3 workouts in a row.” |
| UI celebration | **Implemented** | `SmallWinCelebrationModal` + `SmallWinsProvider` in `App.tsx`. Alias: `src/components/MilestoneModal.tsx` → same component (competence/autonomy copy). |

## 2. Dashboard: Bento + health + weekly volume

| Blueprint | Status | Notes |
|-----------|--------|-------|
| Bento-style home | **Partial** | `Dashboard.tsx` already uses a tile grid; extended with **weekly training set count** and Apple Health pointer. |
| HealthKit metrics on Dashboard | **Gap** | RN bundle does not read HealthKit directly; `HealthScreen` / `FitnessScreen` use `expo-health` + trends. **Refactor:** native module or unified `HealthFacade` if Dashboard must show live HK cards. |

## 3. Workout logger + RIR

| Blueprint | Status | Notes |
|-----------|--------|-------|
| High-performance set logging | **Implemented** | `ProgramExecutionScreen.tsx` (`SetTracker`). |
| RIR (Reps in Reserve) | **Added** | Optional `rir` on each set in `WorkoutSession` sets; UI in `SetTracker`. Trends still primarily use **RPE** where present; mapping RIR→e1RM can be a follow-up. |

## 4. Health tab trends (HR, Sleep, VO₂ Max)

| Blueprint | Status | Notes |
|-----------|--------|-------|
| Trends | **Partial** | `FitnessScreen` health trends (expo-health); `HealthScreen` strength analytics; Swift `HealthDashboardView` for native HK **if embedded**. |
| **Refactor:** single “Health” surface in RN with sections for HR / sleep / VO₂ when data exists. |

## 5. Legal, privacy, delete data

| Blueprint | Status | Notes |
|-----------|--------|-------|
| Medical disclaimer, privacy, delete | **Implemented** | `SettingsScreen` Legal tab + `complianceDisclosures.ts`; delete local data wired to `clearAllUserData`. |
| Swift `LegalComplianceView.swift` | **Present** | For native stacks; RN remains primary. |

## 6. Compliance audit

### 6.1 Health data → analytics / ads

- **Finding:** No `firebase/analytics`, Segment, Amplitude, AdMob, or similar imports in app source. Firebase **Auth** + **Firestore** (if used) are separate from analytics SDKs.
- **Recommendation:** Add an explicit `PRIVACY.md` in repo and App Store privacy labels stating health metrics are not sold or used for ads (already reflected in in-app copy).

### 6.2 Video: AVPlayer / streaming vs bundle

- **Finding:** `ExerciseVideoPlayer` uses **`expo-av` `Video`** with `uri` for remote URLs — streams over network; **does not** bundle workout videos in the app binary. YouTube/Vimeo open externally.
- **Note:** Expo uses native AVPlayer on iOS under the hood; not raw Swift `AVPlayer` in-repo.

### 6.3 Medical disclaimer in onboarding

- **Implemented:** First-time gate after login until user accepts (`onboardingMedicalDisclaimerAccepted` in user storage). See `App.tsx`.

## 7. Conflicting patterns & refactors

1. **Dual health stacks:** Swift HealthKit vs RN `expo-health` — align with one **facade** or document which screen owns which.
2. **“Streak” definition** — align Small Wins streak with product (logger opens vs sessions completed).
3. **Dashboard density** — consider extracting `DashboardTiles` + `WeeklyVolumeCard` for testability.
4. **RIR vs RPE** — `realizedE1RM` in `strengthMetrics.ts` uses **RPE**; optional next step: `rpeApproxFromRir(rir)` for trends when only RIR is logged.

## 8. Swift boilerplate

- Existing: `HealthKitManager.swift`, `HealthDashboardView.swift`, `LegalComplianceView.swift`.
- New RN features should stay in TS/TSX unless a native bridge is required; prebuild keeps `ios/` in sync with Expo.
