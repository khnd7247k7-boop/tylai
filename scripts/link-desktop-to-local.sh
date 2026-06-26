#!/usr/bin/env bash
# Points Desktop at the canonical local repo without moving the slow iCloud copy.
set -euo pipefail

CANONICAL="$HOME/Code/tyl-ai-app-local"
DESKTOP_LINK="$HOME/Desktop/tyl-ai-app-local"
OLD_ICLOUD="$HOME/Desktop/tyl-ai-app"

if [[ ! -d "$CANONICAL" ]]; then
  echo "Canonical repo not found at $CANONICAL"
  exit 1
fi

if [[ -L "$DESKTOP_LINK" ]]; then
  rm "$DESKTOP_LINK"
elif [[ -e "$DESKTOP_LINK" ]]; then
  echo "Cannot create symlink: $DESKTOP_LINK already exists (not a symlink)."
  exit 1
fi

ln -s "$CANONICAL" "$DESKTOP_LINK"
echo "Created: $DESKTOP_LINK -> $CANONICAL"

if [[ -d "$OLD_ICLOUD" && ! -L "$OLD_ICLOUD" ]]; then
  cat > "$OLD_ICLOUD/OPEN_THIS_FOLDER_INSTEAD.txt" <<'EOF'
This Desktop copy (iCloud) is outdated and slow for Cursor.

Use: ~/Desktop/tyl-ai-app-local  (symlink to the real project)
Or:   ~/Code/tyl-ai-app-local

Cursor workspace: ~/Code/tyl-ai-app-local/tyl-ai-app.code-workspace
API keys:         ~/Code/tyl-ai-app-local/.env.local
EOF
  echo "Left note in old iCloud folder: $OLD_ICLOUD/OPEN_THIS_FOLDER_INSTEAD.txt"
  echo "(You can delete $OLD_ICLOUD later when iCloud finishes syncing.)"
fi

echo ""
echo "Next steps:"
echo "  1. Cursor → Open Workspace → $CANONICAL/tyl-ai-app.code-workspace"
echo "  2. cd $CANONICAL && npm run gemini-proxy:sync && npm run gemini-proxy"
echo "  3. cd $CANONICAL && npx expo start --clear"
