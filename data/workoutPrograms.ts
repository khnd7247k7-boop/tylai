export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  restTime: number; // in seconds
  category: 'strength' | 'cardio' | 'flexibility' | 'balance';
  instructions?: string;
}

export interface WorkoutProgram {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  frequency: number; // sessions per week
  level: 'beginner' | 'intermediate' | 'advanced';
  category: 'strength' | 'muscle_building' | 'cardio' | 'bodyweight';
  exercises: Exercise[];
  focus: string;
  equipment: string[];
}

export interface WorkoutSession {
  id: string;
  programId: string;
  programName: string;
  date: string;
  duration: number;
  exercises: Array<{
    exerciseId: string;
    name: string;
    sets: Array<{
      setNumber: number;
      reps: number;
      weight: number;
      restTime: number;
      completed: boolean;
    }>;
  }>;
  notes: string;
  completed: boolean;
  sorenessLevel?: number; // 1-5 scale
  energyLevel?: number; // 1-5 scale
  motivationLevel?: number; // 1-5 scale
  // Smartwatch/Health data
  healthMetrics?: {
    averageHeartRate?: number;
    maxHeartRate?: number;
    minHeartRate?: number;
    caloriesBurned?: number;
    steps?: number;
    distance?: number; // in meters
    heartRateZones?: {
      fatBurn: number; // minutes
      cardio: number;  // minutes
      peak: number;    // minutes
    };
  };
}

export const workoutPrograms: WorkoutProgram[] = [
  // 5x5 Stronglifts Program
  {
    id: 'stronglifts-5x5',
    name: '5x5 Stronglifts',
    description: 'Proven program for maximum strength gains. Focus on compound movements with progressive overload.',
    duration: 45,
    frequency: 3,
    level: 'beginner',
    category: 'strength',
    focus: 'Squat, Bench, Deadlift',
    equipment: ['Barbell', 'Squat Rack', 'Bench'],
    exercises: [
      {
        id: 'squat',
        name: 'Barbell Squat',
        sets: 5,
        reps: 5,
        restTime: 180,
        category: 'strength',
        instructions: 'Stand with feet shoulder-width apart, lower until thighs are parallel to floor'
      },
      {
        id: 'bench',
        name: 'Barbell Bench Press',
        sets: 5,
        reps: 5,
        restTime: 180,
        category: 'strength',
        instructions: 'Lie on bench, lower bar to chest, press up explosively'
      },
      {
        id: 'deadlift',
        name: 'Barbell Deadlift',
        sets: 1,
        reps: 5,
        restTime: 300,
        category: 'strength',
        instructions: 'Stand with feet hip-width apart, lift bar from floor to hip level'
      }
    ]
  },

  // Starting Strength Program
  {
    id: 'starting-strength',
    name: 'Starting Strength',
    description: 'Linear progression program perfect for beginners. Builds a solid strength foundation.',
    duration: 60,
    frequency: 3,
    level: 'beginner',
    category: 'strength',
    focus: 'Full body compound lifts',
    equipment: ['Barbell', 'Squat Rack', 'Bench', 'Pull-up Bar'],
    exercises: [
      {
        id: 'squat-a',
        name: 'Squat (Workout A)',
        sets: 3,
        reps: 5,
        restTime: 180,
        category: 'strength',
        instructions: 'Full depth squat, focus on form'
      },
      {
        id: 'press-a',
        name: 'Overhead Press (Workout A)',
        sets: 3,
        reps: 5,
        restTime: 180,
        category: 'strength',
        instructions: 'Press bar from shoulders to overhead'
      },
      {
        id: 'deadlift-a',
        name: 'Deadlift (Workout A)',
        sets: 1,
        reps: 5,
        restTime: 300,
        category: 'strength',
        instructions: 'Lift bar from floor to standing position'
      },
      {
        id: 'squat-b',
        name: 'Squat (Workout B)',
        sets: 3,
        reps: 5,
        restTime: 180,
        category: 'strength',
        instructions: 'Full depth squat, focus on form'
      },
      {
        id: 'bench-b',
        name: 'Bench Press (Workout B)',
        sets: 3,
        reps: 5,
        restTime: 180,
        category: 'strength',
        instructions: 'Lower bar to chest, press up'
      },
      {
        id: 'row-b',
        name: 'Barbell Row (Workout B)',
        sets: 3,
        reps: 5,
        restTime: 180,
        category: 'strength',
        instructions: 'Bend over and row bar to chest'
      }
    ]
  },

  // Push/Pull/Legs Program
  {
    id: 'push-pull-legs',
    name: 'Push/Pull/Legs',
    description: 'Advanced split routine for muscle building. Targets specific muscle groups each session.',
    duration: 75,
    frequency: 6,
    level: 'advanced',
    category: 'muscle_building',
    focus: 'Upper/Lower split',
    equipment: ['Barbell', 'Dumbbells', 'Cable Machine', 'Pull-up Bar'],
    exercises: [
      // Push Day
      {
        id: 'bench-press',
        name: 'Barbell Bench Press',
        sets: 4,
        reps: 8,
        restTime: 120,
        category: 'strength',
        instructions: 'Flat bench press for chest development'
      },
      {
        id: 'overhead-press',
        name: 'Overhead Press',
        sets: 4,
        reps: 8,
        restTime: 120,
        category: 'strength',
        instructions: 'Standing overhead press for shoulders'
      },
      {
        id: 'incline-db',
        name: 'Incline Dumbbell Press',
        sets: 3,
        reps: 10,
        restTime: 90,
        category: 'strength',
        instructions: 'Incline bench at 30-45 degrees'
      },
      {
        id: 'lateral-raises',
        name: 'Lateral Raises',
        sets: 3,
        reps: 12,
        restTime: 60,
        category: 'strength',
        instructions: 'Raise dumbbells to shoulder height'
      },
      {
        id: 'tricep-dips',
        name: 'Tricep Dips',
        sets: 3,
        reps: 12,
        restTime: 60,
        category: 'strength',
        instructions: 'Dip body weight for tricep development'
      }
    ]
  },

  // Upper/Lower Split
  {
    id: 'upper-lower',
    name: 'Upper/Lower Split',
    description: 'Balanced approach to muscle development. Alternates between upper and lower body sessions.',
    duration: 60,
    frequency: 4,
    level: 'intermediate',
    category: 'muscle_building',
    focus: 'Hypertrophy focused',
    equipment: ['Barbell', 'Dumbbells', 'Cable Machine'],
    exercises: [
      {
        id: 'squat-ul',
        name: 'Back Squat',
        sets: 4,
        reps: 8,
        restTime: 120,
        category: 'strength',
        instructions: 'Full depth squat with barbell'
      },
      {
        id: 'romanian-deadlift',
        name: 'Romanian Deadlift',
        sets: 4,
        reps: 8,
        restTime: 120,
        category: 'strength',
        instructions: 'Hip hinge movement for hamstrings'
      },
      {
        id: 'bulgarian-split',
        name: 'Bulgarian Split Squats',
        sets: 3,
        reps: 10,
        restTime: 90,
        category: 'strength',
        instructions: 'Single leg squat with rear foot elevated'
      },
      {
        id: 'leg-press',
        name: 'Leg Press',
        sets: 3,
        reps: 12,
        restTime: 90,
        category: 'strength',
        instructions: 'Machine leg press for quad development'
      }
    ]
  },

  // Couch to 5K
  {
    id: 'couch-to-5k',
    name: 'Couch to 5K',
    description: 'Progressive running program to build cardiovascular endurance from zero to 5K.',
    duration: 30,
    frequency: 3,
    level: 'beginner',
    category: 'cardio',
    focus: '9 week program',
    equipment: ['Running Shoes'],
    exercises: [
      {
        id: 'walk-warmup',
        name: '5-minute Walk Warmup',
        sets: 1,
        reps: 1,
        restTime: 0,
        category: 'cardio',
        instructions: 'Easy pace walking to prepare body'
      },
      {
        id: 'run-walk-intervals',
        name: 'Run/Walk Intervals',
        sets: 1,
        reps: 1,
        restTime: 0,
        category: 'cardio',
        instructions: 'Alternate between running and walking as prescribed'
      },
      {
        id: 'walk-cooldown',
        name: '5-minute Walk Cooldown',
        sets: 1,
        reps: 1,
        restTime: 0,
        category: 'cardio',
        instructions: 'Easy pace walking to cool down'
      }
    ]
  },

  // HIIT Conditioning
  {
    id: 'hiit-conditioning',
    name: 'HIIT Conditioning',
    description: 'High-intensity interval training for fat loss and cardiovascular fitness.',
    duration: 25,
    frequency: 4,
    level: 'intermediate',
    category: 'cardio',
    focus: 'High intensity',
    equipment: ['Timer', 'Optional: Kettlebell'],
    exercises: [
      {
        id: 'burpees',
        name: 'Burpees',
        sets: 4,
        reps: 10,
        restTime: 30,
        category: 'cardio',
        instructions: 'Full body explosive movement'
      },
      {
        id: 'mountain-climbers',
        name: 'Mountain Climbers',
        sets: 4,
        reps: 20,
        restTime: 30,
        category: 'cardio',
        instructions: 'Alternating leg movement in plank position'
      },
      {
        id: 'jumping-jacks',
        name: 'Jumping Jacks',
        sets: 4,
        reps: 30,
        restTime: 30,
        category: 'cardio',
        instructions: 'Jump feet apart while raising arms'
      },
      {
        id: 'high-knees',
        name: 'High Knees',
        sets: 4,
        reps: 30,
        restTime: 30,
        category: 'cardio',
        instructions: 'Run in place bringing knees to chest'
      }
    ]
  },

  // Calisthenics Progression
  {
    id: 'calisthenics',
    name: 'Calisthenics Progression',
    description: 'Bodyweight strength training with progressive difficulty levels.',
    duration: 45,
    frequency: 4,
    level: 'beginner',
    category: 'bodyweight',
    focus: 'No equipment needed',
    equipment: ['Pull-up Bar (Optional)'],
    exercises: [
      {
        id: 'push-ups',
        name: 'Push-ups',
        sets: 3,
        reps: 10,
        restTime: 60,
        category: 'strength',
        instructions: 'Standard push-up position, lower chest to ground'
      },
      {
        id: 'squats',
        name: 'Bodyweight Squats',
        sets: 3,
        reps: 15,
        restTime: 60,
        category: 'strength',
        instructions: 'Full depth squat with bodyweight'
      },
      {
        id: 'lunges',
        name: 'Walking Lunges',
        sets: 3,
        reps: 10,
        restTime: 60,
        category: 'strength',
        instructions: 'Alternating leg lunges while walking'
      },
      {
        id: 'plank',
        name: 'Plank Hold',
        sets: 3,
        reps: 30,
        restTime: 60,
        category: 'strength',
        instructions: 'Hold plank position for specified time'
      },
      {
        id: 'pull-ups',
        name: 'Pull-ups',
        sets: 3,
        reps: 5,
        restTime: 90,
        category: 'strength',
        instructions: 'Hang from bar, pull body up until chin over bar'
      }
    ]
  },

  // Yoga Flow
  {
    id: 'yoga-flow',
    name: 'Yoga Flow',
    description: 'Flexibility, balance, and mindfulness through structured yoga practice.',
    duration: 60,
    frequency: 5,
    level: 'beginner',
    category: 'bodyweight',
    focus: 'Mind-body connection',
    equipment: ['Yoga Mat'],
    exercises: [
      {
        id: 'sun-salutation',
        name: 'Sun Salutation A',
        sets: 3,
        reps: 1,
        restTime: 30,
        category: 'flexibility',
        instructions: 'Classic yoga flow sequence'
      },
      {
        id: 'warrior-pose',
        name: 'Warrior I & II',
        sets: 2,
        reps: 1,
        restTime: 30,
        category: 'flexibility',
        instructions: 'Hold each warrior pose for 30 seconds'
      },
      {
        id: 'tree-pose',
        name: 'Tree Pose',
        sets: 2,
        reps: 1,
        restTime: 30,
        category: 'balance',
        instructions: 'Balance on one leg, other foot on inner thigh'
      },
      {
        id: 'downward-dog',
        name: 'Downward Dog',
        sets: 3,
        reps: 1,
        restTime: 30,
        category: 'flexibility',
        instructions: 'Inverted V-shape pose, hold for 30 seconds'
      },
      {
        id: 'child-pose',
        name: 'Child\'s Pose',
        sets: 3,
        reps: 1,
        restTime: 60,
        category: 'flexibility',
        instructions: 'Resting pose, focus on breathing'
      }
    ]
  }
];
