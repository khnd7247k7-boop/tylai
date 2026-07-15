import React from 'react';
import { View, TextInput } from 'react-native';
import {
  type NutritionPreferencesProfile,
  type FoodAllergy,
  type FoodIntolerance,
  type NutritionPrimaryGoal,
  type EatingStyle,
  type NutritionHelpMode,
  type ProactiveCoachingLevel,
  FOOD_ALLERGY_LABELS,
  FOOD_INTOLERANCE_LABELS,
  NUTRITION_PRIMARY_GOAL_LABELS,
  EATING_STYLE_LABELS,
  NUTRITION_HELP_MODE_LABELS,
  PROACTIVE_COACHING_LABELS,
  toggleMultiSelectWithNone,
} from '../../types/nutritionQuestionnaire';
import { ChipGrid, QuestionBlock, SelectChip, nutritionFormStyles } from './nutritionQuestionnaireUi';

const ALLERGIES = Object.keys(FOOD_ALLERGY_LABELS) as FoodAllergy[];
const INTOLERANCES = Object.keys(FOOD_INTOLERANCE_LABELS) as FoodIntolerance[];
const PRIMARY_GOALS = Object.keys(NUTRITION_PRIMARY_GOAL_LABELS) as NutritionPrimaryGoal[];
const EATING_STYLES = Object.keys(EATING_STYLE_LABELS) as EatingStyle[];
const HELP_MODES = Object.keys(NUTRITION_HELP_MODE_LABELS) as NutritionHelpMode[];
const PROACTIVE_LEVELS = Object.keys(PROACTIVE_COACHING_LABELS) as ProactiveCoachingLevel[];

interface Props {
  value: NutritionPreferencesProfile;
  onChange: (next: NutritionPreferencesProfile) => void;
}

export default function InitialNutritionSetupForm({ value, onChange }: Props) {
  const toggleAllergy = (option: FoodAllergy) => {
    onChange({ ...value, allergies: toggleMultiSelectWithNone(value.allergies, option, 'none') });
  };

  const toggleIntolerance = (option: FoodIntolerance) => {
    onChange({
      ...value,
      intolerances: toggleMultiSelectWithNone(value.intolerances, option, 'none'),
    });
  };

  return (
    <View>
      <QuestionBlock title="1. Do you have any food allergies?">
        <ChipGrid>
          {ALLERGIES.map((option) => (
            <SelectChip
              key={option}
              label={FOOD_ALLERGY_LABELS[option]}
              selected={value.allergies.includes(option)}
              onPress={() => toggleAllergy(option)}
            />
          ))}
        </ChipGrid>
        {value.allergies.includes('other') ? (
          <TextInput
            style={[nutritionFormStyles.input, { marginTop: 10 }]}
            placeholder="Describe other allergies"
            placeholderTextColor="#666"
            value={value.allergyOther ?? ''}
            onChangeText={(allergyOther) => onChange({ ...value, allergyOther })}
            multiline
          />
        ) : null}
      </QuestionBlock>

      <QuestionBlock title="2. Do you have any food intolerances or sensitivities?">
        <ChipGrid>
          {INTOLERANCES.map((option) => (
            <SelectChip
              key={option}
              label={FOOD_INTOLERANCE_LABELS[option]}
              selected={value.intolerances.includes(option)}
              onPress={() => toggleIntolerance(option)}
            />
          ))}
        </ChipGrid>
        {value.intolerances.includes('other') ? (
          <TextInput
            style={[nutritionFormStyles.input, { marginTop: 10 }]}
            placeholder="Describe other intolerances"
            placeholderTextColor="#666"
            value={value.intoleranceOther ?? ''}
            onChangeText={(intoleranceOther) => onChange({ ...value, intoleranceOther })}
            multiline
          />
        ) : null}
      </QuestionBlock>

      <QuestionBlock title="3. What is your primary nutrition goal?">
        <ChipGrid>
          {PRIMARY_GOALS.map((option) => (
            <SelectChip
              key={option}
              label={NUTRITION_PRIMARY_GOAL_LABELS[option]}
              selected={value.primaryGoal === option}
              onPress={() => onChange({ ...value, primaryGoal: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>

      <QuestionBlock title="4. Which best describes how you like to eat?">
        <ChipGrid>
          {EATING_STYLES.map((option) => (
            <SelectChip
              key={option}
              label={EATING_STYLE_LABELS[option]}
              selected={value.eatingStyle === option}
              onPress={() => onChange({ ...value, eatingStyle: option })}
            />
          ))}
        </ChipGrid>
        {value.eatingStyle === 'other' ? (
          <TextInput
            style={[nutritionFormStyles.input, { marginTop: 10 }]}
            placeholder="Describe your eating style"
            placeholderTextColor="#666"
            value={value.eatingStyleOther ?? ''}
            onChangeText={(eatingStyleOther) => onChange({ ...value, eatingStyleOther })}
          />
        ) : null}
      </QuestionBlock>

      <QuestionBlock title="5. How would you like me to help with your nutrition?">
        <ChipGrid>
          {HELP_MODES.map((option) => (
            <SelectChip
              key={option}
              label={NUTRITION_HELP_MODE_LABELS[option]}
              selected={value.helpMode === option}
              onPress={() => onChange({ ...value, helpMode: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>

      <QuestionBlock
        title="6. Is there anything you absolutely don't want me to recommend?"
        hint="Optional — e.g. I hate mushrooms."
      >
        <TextInput
          style={[nutritionFormStyles.input, nutritionFormStyles.textArea]}
          placeholder="I hate mushrooms."
          placeholderTextColor="#666"
          value={value.avoidRecommendations ?? ''}
          onChangeText={(avoidRecommendations) => onChange({ ...value, avoidRecommendations })}
          multiline
        />
      </QuestionBlock>

      <QuestionBlock title="7. Would you like me to proactively coach you if I notice ways to improve your nutrition?">
        <ChipGrid>
          {PROACTIVE_LEVELS.map((option) => (
            <SelectChip
              key={option}
              label={PROACTIVE_COACHING_LABELS[option]}
              selected={value.proactiveCoaching === option}
              onPress={() => onChange({ ...value, proactiveCoaching: option })}
            />
          ))}
        </ChipGrid>
      </QuestionBlock>
    </View>
  );
}
