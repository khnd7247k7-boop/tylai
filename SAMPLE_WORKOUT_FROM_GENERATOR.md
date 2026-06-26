# Sample workout built from generator logic

This is **Day 1 (Monday)** of a **5-day Push/Pull/Legs** plan, built with the same rules as `generateWorkoutPlan` in `WorkoutScreen.tsx`:

- **Goal:** strength  
- **Level:** intermediate  
- **Days per week:** 5 → focus **Push** on day 1  
- **Optimal Peak:** on (strength goal)  
- **Variation index:** 0 (Option 1)  
- **Equipment:** full gym (full plyometric pool)  
- **No workout history** → progression step leaves prescriptions unchanged  

---

## Push Workout — exercise order (as generated)

### Phase 1 — Dynamic warm-up (~10 min)

| # | Exercise | Prescription |
|---|----------|----------------|
| 1 | Leg Swings | 1 × 90 sec (time-based) |
| 2 | Cat-Cow | 1 × 90 sec |
| 3 | Bird Dog | 1 × 90 sec |
| 4 | World's Greatest Stretch | 1 × 90 sec |
| 5 | Inchworms | 1 × 90 sec |
| 6 | Scapular Push-ups | 1 × 75 sec |
| 7 | Band Pull-Aparts | 1 × 75 sec |

*(First two Push focus moves from `FOCUS_SPECIFIC_WARMUPS['Push']`.)*

---

### Phase 2 — CNS activation (~2.5 min)

| # | Exercise | Prescription |
|---|----------|----------------|
| 8 | High Knees | 1 × 80 sec |
| 9 | Lateral Pogos | 1 × 80 sec |

---

### Phase 3 — Plyometrics / power (~10–15 min)

Shuffled pool with **variationIndex = 0**, **day index = Monday (0)**, **loop i = 0** → first **3** moves from filtered plyometric pool:

| # | Exercise | Sets × Reps | Rest |
|---|----------|-------------|------|
| 10 | 90/180-Degree Jumps | 4 × 4 | 150 sec |
| 11 | Frog Jumps | 4 × 4 | 150 sec |
| 12 | Plyo Push-ups | 4 × 4 | 150 sec |

*(Intermediate: 4 reps, 4 sets, 150 s rest — from `getPlyometricPhaseDetails`.)*

---

### Phase 4 — Primary strength (~65% of main lifts, compounds first)

Sorted by compound (≥2 muscle groups in `muscleGroups` / secondaries). Example main list for Push (5 slots): Bench Press, Overhead Press, Incline Dumbbell Press, Tricep Extensions, Lateral Raises.

| # | Exercise | Sets × Reps | Rest |
|---|----------|-------------|------|
| 13 | Bench Press | 4 × 6 | 120 sec |
| 14 | Overhead Press | 4 × 6 | 120 sec |
| 15 | Incline Dumbbell Press | 4 × 6 | 120 sec |

*(**Reps / sets / rest** from `getExerciseDetails` for **strength** + **intermediate**: 4 sets, 6 reps, 120 s; compound rep cap applied.)*

---

### Phase 5 — Accessory / stability

Remaining slots from main selection + optional balance/isolation top-ups from pool:

| # | Exercise | Sets × Reps | Rest |
|---|----------|-------------|------|
| 16 | Tricep Extensions | 4 × 8 | 120 sec |
| 17 | Lateral Raises | 4 × 10 | 120 sec |

*(Isolation caps: reps ≤ 20.)*

---

### Phase 6 — Cool-down (~5 min)

| # | Exercise | Prescription |
|---|----------|----------------|
| 18 | Hamstring Stretch | 1 × 75 sec |
| 19 | Child's Pose | 1 × 75 sec |
| 20 | Shoulder Stretch | 1 × 75 sec |
| 21 | Hip Flexor Stretch | 1 × 75 sec |

---

## Day duration (estimate)

- Base **`duration`:** `workoutLength` (e.g. **45 min**) or `exercisesPerDay × 6` if unset.  
- **+ `OPTIMAL_PEAK_PHASE_MINUTES`** (~**30 min**) for phases 1, 2, 3, and 6 overhead.  
- **Example total line item:** **45 + 30 = 75 min** (your UI may round).

---

## Notes

- **Another “Option 2”** plan uses **`variationIndex = 1`** → different shuffle for plyometrics and main exercise picks.  
- With **workout history**, **Step 7** (`applyProgressionLogic`) adjusts weight / sets / reps on **strength & cardio** work; it **does not** change time-based phases or the plyometric block prescriptions.  
- **Flexibility** or **endurance** goals **do not** use this 6-phase block; they use the legacy warm-up + main list only.
