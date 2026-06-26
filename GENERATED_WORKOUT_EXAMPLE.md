# Generated Workout Example

Example of a **5-day plan** (Push / Pull / Legs / Push / Pull), **intermediate** level, **strength** goal.

For **strength**, **muscle gain**, and **weight loss**, each day follows the **Optimal Peak** structure (ordered phases). **Rep ranges, sets, and rest** for primary strength and accessory work still come from the app’s existing goal/level rules (not forced 8–12 on compounds).

**Flexibility** and **endurance** plans keep the previous style (shorter warm-up block + main work only).

---

## Plan overview

| Field | Value |
|-------|--------|
| **Name** | Intermediate Strength Program |
| **Level** | intermediate |
| **Goal** | strength |
| **Days per week** | 5 |
| **Estimated duration (per day)** | Main work estimate + ~30 min for phases 1–3 & 6 |

---

## Optimal Peak — daily order (strength / muscle gain / weight loss)

| Phase | Purpose | Content (example) |
|-------|---------|-------------------|
| **1. Dynamic warm-up** | Raise temp, prep joints; movement over static stretch | Leg swings, Cat-Cow, Bird Dog, World’s Greatest Stretch, Inchworms + 2 focus-specific moves (time-based) |
| **2. CNS activation** | Wake up nervous system; fast, low impact | High knees, Lateral pogos (time-based) |
| **3. Plyometrics / power** | While fresh; low reps, long rest | 2–3 plyometric moves from the DB (or Jumping Jacks fallback): **4 sets × 3–5 reps**, rest **120–180 s** (by level) |
| **4. Primary strength** | Compounds first | ~65% of main lifts, sorted compound-first — **reps/rest from existing `getExerciseDetails` logic** |
| **5. Accessory / stability** | Imbalances, single-leg, core | Remaining main picks + up to **2** from balance / isolation pool |
| **6. Cool-down** | Downregulate | Static holds (e.g. hamstring, child’s pose, shoulder, hip flexor) — time-based |

---

## Day 1 — Push Workout (illustrative)

**Focus:** Push  
**Duration:** main estimate + phase overhead (~30 min)

### Phase 1 — Dynamic warm-up (~10 min)

Leg swings, Cat-Cow, Bird Dog, World’s Greatest Stretch, Inchworms (e.g. ~90 sec each) + two push-prep moves (e.g. scapular work, band pull-aparts).

### Phase 2 — CNS (~2–3 min)

High knees, lateral pogos (~80 sec each).

### Phase 3 — Plyometrics (~10–15 min)

Example: **Snap downs**, **Skater jumps**, **Plyo push-ups** — 4 × 4 reps, 150 s rest (intermediate).

### Phases 4 & 5 — Strength + accessory

| Block | Example | Sets / reps / rest |
|-------|---------|-------------------|
| Primary | Bench, OHP, incline press | From generator (e.g. strength goal: fewer reps, longer rest) |
| Accessory | Lateral raises, plank | Same rules |

### Phase 6 — Cool-down (~5 min)

Hamstring stretch, child’s pose, shoulder stretch, hip flexor stretch (~75 sec each).

---

## Day 2 — Pull / Day 3 — Legs

Same **phase order**; phase 1 adds **pull-** or **leg-** specific dynamic moves; phases 4–5 use pull/leg exercise selection from the generator.

---

## Sets logic

- For `muscle_gain`, generator now targets roughly **10–20 working sets per muscle group per week** for primary strength/accessory lifts.
- This assumes the user performs sets **close to failure** with good technique.
- Warm-up, CNS, plyometric, and cooldown timed phases are excluded from this weekly hypertrophy set target.

---

## In the app

- **Execution screen:** Time-based segments show **duration** hints; plyo block shows **low reps + long rest**; main lifts use your normal set/rep targets.
- **Progression:** History-based progression **does not** rewrite time-based warm-up/cool-down or the dedicated plyometric block (and Jumping Jacks when used as plyo fallback).

---

# Generated Workout Example 2 (different questionnaire answers)

Example of a **3-day plan**, **advanced** level, **muscle gain** goal with different answers than the first example.

## Questionnaire answers used

| Question | Answer |
|----------|--------|
| **Primary goal** | muscle_gain |
| **Experience level** | advanced |
| **Days per week** | 3 |
| **Preferred workout length** | 55 minutes |
| **Equipment availability** | full gym |
| **Secondary goals** | athleticism, power |
| **Excluded exercises** | Barbell Back Squat, Pull-ups |

## Program structure selected (Option 3 style split)

Because this example uses a different variation template, the weekly focus becomes:

1. **Chest & Back**
2. **Quads & Calves**
3. **Glutes & Hamstrings**

## Day 1 sample output — Chest & Back

**Goal:** muscle gain (Optimal Peak structure)  
**Level:** advanced  
**Duration target:** ~55 min main work + phase overhead

### Phase 1 — Dynamic Warm-Up
- Leg Swings (90s)
- Cat-Cow (90s)
- Bird Dog (90s)
- World's Greatest Stretch (90s)
- Inchworms (90s)
- Scapular Push-ups (75s)
- Thoracic Rotations (75s)

### Phase 2 — CNS Activation
- High Knees (80s)
- Lateral Pogos (80s)

### Phase 3 — Plyometrics / Power (advanced settings)
- 90/180-Degree Jumps — 4 sets x 5 reps, 180s rest
- Tuck Jumps — 4 sets x 5 reps, 180s rest
- Plyo Push-ups — 4 sets x 5 reps, 180s rest

### Phase 4 — Primary Strength (compound emphasis)
- Barbell Bench Press
- Bent-Over Row
- Incline Dumbbell Press

### Phase 5 — Accessory / Stability
- Cable Fly
- Chest-Supported Row

### Phase 6 — Cool-Down
- Hamstring Stretch (75s)
- Child's Pose (75s)
- Shoulder Stretch (75s)
- Hip Flexor Stretch (75s)

## Why this is different from Example 1

- Different **goal** (`muscle_gain` instead of `strength`)
- Different **level** (`advanced` instead of `intermediate`)
- Different **days** (`3` instead of `5`)
- Different **split template** (`Chest & Back`, `Quads & Calves`, `Glutes & Hamstrings`)
- Different **equipment + excluded movements**

---

# Generated Workout Example 3 (new questionnaire profile)

Example of a **6-day plan**, **intermediate** level, **strength** goal with a new answer set.

## Questionnaire answers used

| Question | Answer |
|----------|--------|
| **Primary goal** | strength |
| **Experience level** | intermediate |
| **Days per week** | 6 |
| **Preferred workout length** | 50 minutes |
| **Equipment availability** | barbell + dumbbells + cable machine |
| **Secondary goals** | stability, mobility |
| **Excluded exercises** | Deadlifts, Dips |

## Program structure selected (Option 1 style split)

1. **Push**
2. **Pull**
3. **Legs**
4. **Push**
5. **Pull**
6. **Legs**

## Day 1 sample output — Push

**Goal:** strength  
**Level:** intermediate  
**Duration target:** ~50 min main work + warm-up/cooldown blocks

### 1) Warm-Up (5-10 min)
- Leg Swings (90s)
- Cat-Cow (90s)
- Bird Dog (90s)
- World's Greatest Stretch (90s)
- Inchworms (90s)
- Scapular Push-ups (75s)
- Band Pull-Aparts (75s)

### 2) Main Lift (3-5 sets)
- **Barbell Bench Press** — 4 sets x 6 reps, 120s rest

### 3) Secondary Lifts (3-4 sets each)
- **Overhead Press** — 4 sets x 6 reps, 120s rest
- **Incline Dumbbell Press** — 4 sets x 6 reps, 120s rest

### 4) Accessory Lifts (3-5 exercises, 2-4 sets each)
- Lateral Raises — 3 sets x 12 reps
- Tricep Pushdowns — 3 sets x 12 reps
- Cable Fly — 3 sets x 10 reps
- Face Pulls — 3 sets x 12 reps

### 5) Finisher
- Battle Ropes Intervals — 1 set x 30 reps/time target, short rest

### 6) Cooldown
- Hamstring Stretch (75s)
- Child's Pose (75s)
- Shoulder Stretch (75s)
- Hip Flexor Stretch (75s)

## Day 2 — Arms & Shoulders

### 1) Warm-Up (5-10 min)
- Leg Swings (90s), Cat-Cow (90s), Bird Dog (90s), World's Greatest Stretch (90s), Inchworms (90s)
- Scapular Push-ups (75s), Band Pull-Aparts (75s)

### 2) Main Lift (3-5 sets)
- **Standing Resistance Band Overhead Press** — 3 sets x 10 reps, 60s rest

### 3) Secondary Lifts (3-4 sets each)
- **Pike Push-up (or incline variation)** — 3 sets x 8-10 reps, 60s rest
- **Resistance Band Upright Row** — 3 sets x 10 reps, 60s rest

### 4) Accessory Lifts (3-5 exercises, 2-4 sets each)
- Banded Lateral Raise — 2 sets x 12 reps
- Banded Triceps Extension — 2 sets x 12 reps
- Banded Biceps Curl — 2 sets x 12 reps

### 5) Finisher
- Shoulder Burnout Circuit (band front raise + lateral raise) — 1 round near failure

### 6) Cooldown
- Hamstring Stretch (75s), Child's Pose (75s), Shoulder Stretch (75s), Hip Flexor Stretch (75s)

## Day 3 — Quads & Calves

### 1) Warm-Up (5-10 min)
- Leg Swings (90s), Cat-Cow (90s), Bird Dog (90s), World's Greatest Stretch (90s), Inchworms (90s)
- Walking Lunges with a Twist (75s), Ankle Rolls / Bottom Squat Transfer (75s)

### 2) Main Lift (3-5 sets)
- **Banded Front Squat (or Goblet Squat pattern)** — 3 sets x 10 reps, 60-75s rest

### 3) Secondary Lifts (3-4 sets each)
- **Split Squat** — 3 sets x 10 reps/side, 60s rest
- **Reverse Lunge** — 3 sets x 10 reps/side, 60s rest

### 4) Accessory Lifts (3-5 exercises, 2-4 sets each)
- Standing Calf Raises — 2 sets x 15 reps
- Wall Sit — 2 sets x 30-45 sec
- Terminal Knee Extension (band) — 2 sets x 12 reps

### 5) Finisher
- Bodyweight Squat Burnout — 1 round near failure

### 6) Cooldown
- Hamstring Stretch (75s), Child's Pose (75s), Shoulder Stretch (75s), Hip Flexor Stretch (75s)

## Day 4 — Glutes & Hamstrings

### 1) Warm-Up (5-10 min)
- Leg Swings (90s), Cat-Cow (90s), Bird Dog (90s), World's Greatest Stretch (90s), Inchworms (90s)
- Glute Bridge (Bodyweight) (75s), Good Mornings (Bodyweight) (75s)

### 2) Main Lift (3-5 sets)
- **Banded Romanian Deadlift** — 3 sets x 10 reps, 60-75s rest

### 3) Secondary Lifts (3-4 sets each)
- **Hip Thrust (bodyweight/band)** — 3 sets x 10-12 reps, 60s rest
- **Single-Leg RDL (bodyweight or light band)** — 3 sets x 8-10 reps/side, 60s rest

### 4) Accessory Lifts (3-5 exercises, 2-4 sets each)
- Hamstring Walkouts — 2 sets x 8-10 reps
- Banded Glute Kickback — 2 sets x 12 reps/side
- Side-Lying Clamshell — 2 sets x 12 reps/side

### 5) Finisher
- Glute Bridge Iso Hold — 1 round near failure

### 6) Cooldown
- Hamstring Stretch (75s), Child's Pose (75s), Shoulder Stretch (75s), Hip Flexor Stretch (75s)

## Day 5 — Full Body

### 1) Warm-Up (5-10 min)
- Leg Swings (90s), Cat-Cow (90s), Bird Dog (90s), World's Greatest Stretch (90s), Inchworms (90s)
- Thoracic Rotations (75s), Glute Bridge (Bodyweight) (75s)

### 2) Main Lift (3-5 sets)
- **Banded Thruster (squat to press)** — 3 sets x 8-10 reps, 60-75s rest

### 3) Secondary Lifts (3-4 sets each)
- **Resistance Band Row** — 3 sets x 10 reps, 60s rest
- **Split Squat** — 3 sets x 10 reps/side, 60s rest

### 4) Accessory Lifts (3-5 exercises, 2-4 sets each)
- Dead Bug — 2 sets x 10 reps/side
- Banded Chest Fly — 2 sets x 12 reps
- Standing Calf Raise — 2 sets x 15 reps

### 5) Finisher
- Full-Body Band Complex (row + press + squat) — 1 round near failure

### 6) Cooldown
- Hamstring Stretch (75s), Child's Pose (75s), Shoulder Stretch (75s), Hip Flexor Stretch (75s)

---

# Generated Workout Example 4 (all-new answer set)

Example of a **5-day plan**, **beginner** level, **muscle_gain** goal with a unique questionnaire profile.

## Questionnaire answers used

| Question | Answer |
|----------|--------|
| **Primary goal** | muscle_gain |
| **Experience level** | beginner |
| **Days per week** | 5 |
| **Preferred workout length** | 35 minutes |
| **Equipment availability** | bodyweight + resistance bands |
| **Secondary goals** | balance, stability |
| **Excluded exercises** | Push-ups, Jumping Jacks |

## Program structure selected (Option 2 style split)

1. **Chest & Back**
2. **Arms & Shoulders**
3. **Quads & Calves**
4. **Glutes & Hamstrings**
5. **Full Body**

## Day 1 sample output — Chest & Back

**Goal:** muscle gain  
**Level:** beginner  
**Duration target:** ~35 min main work + warm-up/cooldown blocks

### 1) Warm-Up (5-10 min)
- Leg Swings (90s)
- Cat-Cow (90s)
- Bird Dog (90s)
- World's Greatest Stretch (90s)
- Inchworms (90s)
- Thoracic Rotations (75s)
- Scapular Pull-ups (75s)

### 2) Main Lift (3-5 sets)
- **Resistance Band Chest Press** — 3 sets x 10 reps, 60s rest

### 3) Secondary Lifts (3-4 sets each)
- **Resistance Band Row** — 3 sets x 10 reps, 60s rest
- **Incline Bench (or elevated) Chest Press variation** — 3 sets x 10 reps, 60s rest

### 4) Accessory Lifts (3-5 exercises, 2-4 sets each)
- Band Face Pull — 2 sets x 12 reps
- Band Rear Delt Fly — 2 sets x 12 reps
- Banded Biceps Curl — 2 sets x 12 reps

### 5) Finisher
- Plank Hold Burnout — 1 round t near-failure time

### 6) Cooldown
- Hamstring Stretch (75s)
- Child's Pose (75s)
- Shoulder Stretch (75s)
- Hip Flexor Stretch (75s)

---

# Generated Workout Example 5 (new questionnaire — not used before)

Example of a **4-day plan**, **intermediate** level, **weight_loss** goal with a fresh answer set (different goals, days, equipment, and exclusions than Examples 1–4).

## Questionnaire answers used

| Question | Answer |
|----------|--------|
| **Primary goal** | weight_loss |
| **Experience level** | intermediate |
| **Days per week** | 4 |
| **Preferred workout length** | 40 minutes |
| **Equipment availability** | kettlebells + dumbbells + bench |
| **Secondary goals** | mobility, endurance |
| **Excluded exercises** | Barbell Bench Press, Leg Press |

## Program structure selected (variation template for 4 days)

1. **Chest & Back**
2. **Arms & Shoulders**
3. **Quads & Calves**
4. **Glutes & Hamstrings**

## Day 1 — Chest & Back (sample day)

**Goal:** weight_loss (strength-structured session)  
**Level:** intermediate  
**Duration target:** ~40 min main work + warm-up / finisher / cooldown blocks

### 1) Warm-Up (5–10 min)
- Leg Swings (90s), Cat-Cow (90s), Bird Dog (90s), World's Greatest Stretch (90s), Inchworms (90s)
- Scapular Push-ups (75s), Thoracic Rotations (75s)

### 2) Main Lift (3–5 sets)
- **Dumbbell Bench Press** — 3 sets x 12–15 reps, 45s rest *(barbell bench excluded)*

### 3) Secondary Lifts (3–4 sets each)
- **Single-Arm Dumbbell Row** — 3 sets x 12 reps/side, 45s rest
- **Incline Dumbbell Press** — 3 sets x 12 reps, 45s rest

### 4) Accessory Lifts (3–5 exercises, 2–4 sets each)
- Face Pulls — 3 sets x 12 reps
- Straight-Arm Pulldown — 3 sets x 12 reps
- Biceps Curl — 3 sets x 12 reps

### 5) Finisher
- **Kettlebell Swings** — 3 rounds x 15 reps, 60s rest between rounds

### 6) Cooldown
- Hamstring Stretch (75s), Child's Pose (75s), Shoulder Stretch (75s), Hip Flexor Stretch (75s)

## Day 2 — Arms & Shoulders (outline)

- Main: **Dumbbell Overhead Press** or **Arnold Press**
- Secondary: lateral raises, triceps-focused pressdown or skull crusher variant
- Accessory: rear delts, curls, optional forearm work
- Finisher: light battle rope or high-rep band work (time cap)

## Day 3 — Quads & Calves (outline)

- Main: **Goblet Squat** or **Front Squat** with kettlebell *(leg press excluded)*
- Secondary: split squat, step-up
- Accessory: calf raises, leg extension or sissy squat alternative if available
- Finisher: bodyweight squat or jump squat volume *(only if joints feel good)*

## Day 4 — Glutes & Hamstrings (outline)

- Main: **Romanian Deadlift** (dumbbells or kettlebell)
- Secondary: hip thrust, single-leg RDL
- Accessory: hamstring curl variation, glute kickback or cable pull-through
- Finisher: glute bridge or KB swing emom (short)

## Why this differs from prior examples

- **Goal:** `weight_loss` (not strength-only or muscle_gain-only in the same way as Examples 1–2 / 4)
- **Frequency:** **4 days** (distinct from 3-, 5-, and 6-day samples)
- **Equipment:** **kettlebells + dumbbells** (not full gym-only, not bands-only)
- **Exclusions:** bench and leg press (different from prior exclusion lists)
