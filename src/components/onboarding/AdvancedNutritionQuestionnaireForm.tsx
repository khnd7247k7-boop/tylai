import React from 'react';
import { View, Text, TextInput } from 'react-native';
import {
  type AdvancedNutritionProfile,
  type JobActivityLevel,
  type SnackFrequency,
  type CookingSkill,
  type CookingTimeAvailable,
  type GroceryBudget,
  type AlcoholConsumption,
  type CaffeineIntake,
  type SupplementType,
  type MedicalCondition,
  type NutritionChallenge,
  type TrackingAccuracy,
  JOB_ACTIVITY_LABELS,
  SNACK_FREQUENCY_LABELS,
  COOKING_SKILL_LABELS,
  COOKING_TIME_LABELS,
  GROCERY_BUDGET_LABELS,
  ALCOHOL_LABELS,
  CAFFEINE_LABELS,
  SUPPLEMENT_LABELS,
  MEDICAL_CONDITION_LABELS,
  NUTRITION_CHALLENGE_LABELS,
  TRACKING_ACCURACY_LABELS,
  toggleMultiSelectMax,
} from '../../types/nutritionQuestionnaire';
import { ChipGrid, QuestionBlock, SelectChip, nutritionFormStyles } from './nutritionQuestionnaireUi';

const MEALS_PER_DAY = [2, 3, 4, 5, 6];
const EXERCISE_FREQ = ['0–1 days', '2–3 days', '4–5 days', '6–7 days'];
const STEP_COUNTS = ['Under 5k', '5k–8k', '8k–12k', '12k+'];
const CARDIO_FREQ = ['None', '1–2x/week', '3–4x/week', '5+ times/week'];

interface Props {
  value: AdvancedNutritionProfile;
  onChange: (next: AdvancedNutritionProfile) => void;
  currentWeightHint?: string;
}

export default function AdvancedNutritionQuestionnaireForm({
  value,
  onChange,
  currentWeightHint,
}: Props) {
  const toggleSupplement = (option: SupplementType) => {
    const supplements = value.supplements.includes(option)
      ? value.supplements.filter((s) => s !== option)
      : [...value.supplements, option];
    onChange({ ...value, supplements });
  };

  const toggleMedical = (option: MedicalCondition) => {
    const medicalConditions = value.medicalConditions.includes(option)
      ? value.medicalConditions.filter((m) => m !== option)
      : [...value.medicalConditions, option];
    onChange({ ...value, medicalConditions });
  };

  const toggleChallenge = (option: NutritionChallenge) => {
    onChange({
      ...value,
      biggestChallenges: toggleMultiSelectMax(value.biggestChallenges, option, 3),
    });
  };

  return (
    <View>
      <Text style={nutritionFormStyles.sectionHeading}>Goals</Text>
      {currentWeightHint ? (
        <QuestionBlock title="Current weight" hint={`From your profile: ${currentWeightHint}`} />
      ) : null}
      <QuestionBlock title="Goal weight">
        <TextInput
          style={nutritionFormStyles.input}
          placeholder="e.g. 165 lb or 75 kg"
          placeholderTextColor="#666"
          value={value.goalWeightDisplay ?? ''}
          onChangeText={(goalWeightDisplay) => onChange({ ...value, goalWeightDisplay })}
        />
      </QuestionBlock>
      <QuestionBlock title="Target date">
        <TextInput
          style={nutritionFormStyles.input}
          placeholder="e.g. June 2026 or wedding date"
          placeholderTextColor="#666"
          value={value.targetDate ?? ''}
          onChangeText={(targetDate) => onChange({ ...value, targetDate })}
        />
      </QuestionBlock>
      <QuestionBlock title="Estimated body fat (optional)">
        <TextInput
          style={nutritionFormStyles.input}
          placeholder="e.g. 18%"
          placeholderTextColor="#666"
          value={value.estimatedBodyFat ?? ''}
          onChangeText={(estimatedBodyFat) => onChange({ ...value, estimatedBodyFat })}
        />
      </QuestionBlock>

      <Text style={nutritionFormStyles.sectionHeading}>Activity</Text>
      <QuestionBlock title="Job activity level">
        <ChipGrid>
          {(Object.keys(JOB_ACTIVITY_LABELS) as JobActivityLevel[]).map((option) => (
            <SelectChip
              key={option}
              label={JOB_ACTIVITY_LABELS[option]}
              selected={value.jobActivityLevel === option}
              onPress={() => onChange({ ...value, jobActivityLevel: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>
      <QuestionBlock title="Weekly exercise frequency">
        <ChipGrid>
          {EXERCISE_FREQ.map((label) => (
            <SelectChip
              key={label}
              label={label}
              selected={value.weeklyExerciseFrequency === label}
              onPress={() => onChange({ ...value, weeklyExerciseFrequency: label })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>
      <QuestionBlock title="Daily step count">
        <ChipGrid>
          {STEP_COUNTS.map((label) => (
            <SelectChip
              key={label}
              label={label}
              selected={value.dailyStepCount === label}
              onPress={() => onChange({ ...value, dailyStepCount: label })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>
      <QuestionBlock title="Cardio frequency">
        <ChipGrid>
          {CARDIO_FREQ.map((label) => (
            <SelectChip
              key={label}
              label={label}
              selected={value.cardioFrequency === label}
              onPress={() => onChange({ ...value, cardioFrequency: label })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>

      <Text style={nutritionFormStyles.sectionHeading}>Meal preferences</Text>
      <QuestionBlock title="Favorite foods">
        <TextInput
          style={[nutritionFormStyles.input, nutritionFormStyles.textArea]}
          placeholder="Foods you enjoy and want included"
          placeholderTextColor="#666"
          value={value.favoriteFoods ?? ''}
          onChangeText={(favoriteFoods) => onChange({ ...value, favoriteFoods })}
          multiline
        />
      </QuestionBlock>
      <QuestionBlock title="Foods to avoid">
        <TextInput
          style={[nutritionFormStyles.input, nutritionFormStyles.textArea]}
          placeholder="Besides allergies — foods you dislike or won't eat"
          placeholderTextColor="#666"
          value={value.foodsToAvoid ?? ''}
          onChangeText={(foodsToAvoid) => onChange({ ...value, foodsToAvoid })}
          multiline
        />
      </QuestionBlock>
      <QuestionBlock title="Number of meals per day">
        <ChipGrid>
          {MEALS_PER_DAY.map((n) => (
            <SelectChip
              key={n}
              label={String(n)}
              selected={value.mealsPerDay === n}
              onPress={() => onChange({ ...value, mealsPerDay: n })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>
      <QuestionBlock title="Snack frequency">
        <ChipGrid>
          {(Object.keys(SNACK_FREQUENCY_LABELS) as SnackFrequency[]).map((option) => (
            <SelectChip
              key={option}
              label={SNACK_FREQUENCY_LABELS[option]}
              selected={value.snackFrequency === option}
              onPress={() => onChange({ ...value, snackFrequency: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>
      <QuestionBlock title="Meal timing">
        <TextInput
          style={nutritionFormStyles.input}
          placeholder="e.g. first meal 8am, dinner by 7pm"
          placeholderTextColor="#666"
          value={value.mealTiming ?? ''}
          onChangeText={(mealTiming) => onChange({ ...value, mealTiming })}
        />
      </QuestionBlock>

      <Text style={nutritionFormStyles.sectionHeading}>Cooking</Text>
      <QuestionBlock title="Cooking skill">
        <ChipGrid>
          {(Object.keys(COOKING_SKILL_LABELS) as CookingSkill[]).map((option) => (
            <SelectChip
              key={option}
              label={COOKING_SKILL_LABELS[option]}
              selected={value.cookingSkill === option}
              onPress={() => onChange({ ...value, cookingSkill: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>
      <QuestionBlock title="Time available to cook">
        <ChipGrid>
          {(Object.keys(COOKING_TIME_LABELS) as CookingTimeAvailable[]).map((option) => (
            <SelectChip
              key={option}
              label={COOKING_TIME_LABELS[option]}
              selected={value.cookingTimeAvailable === option}
              onPress={() => onChange({ ...value, cookingTimeAvailable: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>
      <QuestionBlock title="Grocery budget">
        <ChipGrid>
          {(Object.keys(GROCERY_BUDGET_LABELS) as GroceryBudget[]).map((option) => (
            <SelectChip
              key={option}
              label={GROCERY_BUDGET_LABELS[option]}
              selected={value.groceryBudget === option}
              onPress={() => onChange({ ...value, groceryBudget: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>
      <QuestionBlock title="Grocery stores">
        <TextInput
          style={nutritionFormStyles.input}
          placeholder="e.g. Costco, Whole Foods, local market"
          placeholderTextColor="#666"
          value={value.groceryStores ?? ''}
          onChangeText={(groceryStores) => onChange({ ...value, groceryStores })}
        />
      </QuestionBlock>

      <Text style={nutritionFormStyles.sectionHeading}>Lifestyle</Text>
      <QuestionBlock title="Wake time">
        <TextInput
          style={nutritionFormStyles.input}
          placeholder="e.g. 6:30 AM"
          placeholderTextColor="#666"
          value={value.wakeTime ?? ''}
          onChangeText={(wakeTime) => onChange({ ...value, wakeTime })}
        />
      </QuestionBlock>
      <QuestionBlock title="Bed time">
        <TextInput
          style={nutritionFormStyles.input}
          placeholder="e.g. 10:30 PM"
          placeholderTextColor="#666"
          value={value.bedTime ?? ''}
          onChangeText={(bedTime) => onChange({ ...value, bedTime })}
        />
      </QuestionBlock>
      <QuestionBlock title="Water intake">
        <TextInput
          style={nutritionFormStyles.input}
          placeholder="e.g. 80 oz per day"
          placeholderTextColor="#666"
          value={value.waterIntake ?? ''}
          onChangeText={(waterIntake) => onChange({ ...value, waterIntake })}
        />
      </QuestionBlock>
      <QuestionBlock title="Alcohol consumption">
        <ChipGrid>
          {(Object.keys(ALCOHOL_LABELS) as AlcoholConsumption[]).map((option) => (
            <SelectChip
              key={option}
              label={ALCOHOL_LABELS[option]}
              selected={value.alcoholConsumption === option}
              onPress={() => onChange({ ...value, alcoholConsumption: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>
      <QuestionBlock title="Caffeine intake">
        <ChipGrid>
          {(Object.keys(CAFFEINE_LABELS) as CaffeineIntake[]).map((option) => (
            <SelectChip
              key={option}
              label={CAFFEINE_LABELS[option]}
              selected={value.caffeineIntake === option}
              onPress={() => onChange({ ...value, caffeineIntake: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>

      <Text style={nutritionFormStyles.sectionHeading}>Supplements</Text>
      <QuestionBlock title="What supplements do you take?">
        <ChipGrid>
          {(Object.keys(SUPPLEMENT_LABELS) as SupplementType[]).map((option) => (
            <SelectChip
              key={option}
              label={SUPPLEMENT_LABELS[option]}
              selected={value.supplements.includes(option)}
              onPress={() => toggleSupplement(option)}
            />
          ))}
        </ChipGrid>
        {value.supplements.includes('other') ? (
          <TextInput
            style={[nutritionFormStyles.input, { marginTop: 10 }]}
            placeholder="Other supplements"
            placeholderTextColor="#666"
            value={value.supplementsOther ?? ''}
            onChangeText={(supplementsOther) => onChange({ ...value, supplementsOther })}
          />
        ) : null}
      </QuestionBlock>

      <Text style={nutritionFormStyles.sectionHeading}>Medical</Text>
      <QuestionBlock title="Medical conditions">
        <ChipGrid>
          {(Object.keys(MEDICAL_CONDITION_LABELS) as MedicalCondition[]).map((option) => (
            <SelectChip
              key={option}
              label={MEDICAL_CONDITION_LABELS[option]}
              selected={value.medicalConditions.includes(option)}
              onPress={() => toggleMedical(option)}
            />
          ))}
        </ChipGrid>
        {value.medicalConditions.includes('other') ? (
          <TextInput
            style={[nutritionFormStyles.input, { marginTop: 10 }]}
            placeholder="Other conditions"
            placeholderTextColor="#666"
            value={value.medicalConditionsOther ?? ''}
            onChangeText={(medicalConditionsOther) => onChange({ ...value, medicalConditionsOther })}
          />
        ) : null}
      </QuestionBlock>
      <QuestionBlock title="Current medications (optional)">
        <TextInput
          style={[nutritionFormStyles.input, nutritionFormStyles.textArea]}
          placeholder="List any medications"
          placeholderTextColor="#666"
          value={value.currentMedications ?? ''}
          onChangeText={(currentMedications) => onChange({ ...value, currentMedications })}
          multiline
        />
      </QuestionBlock>
      <QuestionBlock title="Digestive issues">
        <TextInput
          style={[nutritionFormStyles.input, nutritionFormStyles.textArea]}
          placeholder="Any GI issues we should know about"
          placeholderTextColor="#666"
          value={value.digestiveIssues ?? ''}
          onChangeText={(digestiveIssues) => onChange({ ...value, digestiveIssues })}
          multiline
        />
      </QuestionBlock>

      <Text style={nutritionFormStyles.sectionHeading}>Biggest challenges</Text>
      <QuestionBlock title="Choose up to 3" hint={`${value.biggestChallenges.length}/3 selected`}>
        <ChipGrid>
          {(Object.keys(NUTRITION_CHALLENGE_LABELS) as NutritionChallenge[]).map((option) => (
            <SelectChip
              key={option}
              label={NUTRITION_CHALLENGE_LABELS[option]}
              selected={value.biggestChallenges.includes(option)}
              disabled={
                !value.biggestChallenges.includes(option) && value.biggestChallenges.length >= 3
              }
              onPress={() => toggleChallenge(option)}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>

      <Text style={nutritionFormStyles.sectionHeading}>AI personalization</Text>
      <QuestionBlock title="How accurately would you like to track nutrition?">
        <ChipGrid>
          {(Object.keys(TRACKING_ACCURACY_LABELS) as TrackingAccuracy[]).map((option) => (
            <SelectChip
              key={option}
              label={TRACKING_ACCURACY_LABELS[option]}
              selected={value.trackingAccuracy === option}
              onPress={() => onChange({ ...value, trackingAccuracy: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>

      <QuestionBlock title="Tell me anything else that would help me coach you better.">
        <TextInput
          style={[nutritionFormStyles.input, nutritionFormStyles.textArea]}
          placeholder="Anything else your coach should know"
          placeholderTextColor="#666"
          value={value.additionalCoachingNotes ?? ''}
          onChangeText={(additionalCoachingNotes) => onChange({ ...value, additionalCoachingNotes })}
          multiline
        />
      </QuestionBlock>
    </View>
  );
}
