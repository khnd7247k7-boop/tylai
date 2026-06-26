#!/usr/bin/env bash
# Sync app source from ~/Code/tyl-ai-app-local → ~/Desktop/tyl-ai-app (no .env / node_modules).
set -euo pipefail
SRC="${1:-$HOME/Code/tyl-ai-app-local}"
DST="${2:-$HOME/Desktop/tyl-ai-app}"

if [[ ! -d "$SRC" || ! -d "$DST" ]]; then
  echo "Usage: sync-to-desktop.sh [src] [dst]" >&2
  exit 1
fi

copy_file() {
  local rel="$1"
  mkdir -p "$DST/$(dirname "$rel")"
  cp "$SRC/$rel" "/tmp/tyl-sync-${rel//\//-}" 
  mv "/tmp/tyl-sync-${rel//\//-}" "$DST/$rel"
  echo "  $rel"
}

echo "Syncing from $SRC → $DST"

for rel in \
  App.tsx WorkoutScreen.tsx SettingsScreen.tsx Dashboard.tsx AIService.ts \
  src/components/onboarding/OnboardingWizard.tsx \
  src/components/AppTextInput.tsx \
  src/types/coachingProfile.ts \
  src/services/CoachingProfileService.ts \
  src/services/CoachingEngine.ts \
  src/services/geminiService.ts \
  src/utils/workoutQuestionnaireParse.ts \
  src/utils/userStorage.ts \
  src/utils/healthContextPrivacy.ts \
  src/utils/geminiErrors.ts; do
  copy_file "$rel"
done

echo "Done. Run Metro from $SRC (Desktop iCloud folder can timeout)."
