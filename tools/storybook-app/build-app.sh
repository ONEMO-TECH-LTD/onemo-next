#!/bin/zsh
# Rebuild the clickable "ONEMO Storybook.app" (runs launch-storybook.sh → opens Storybook in Chrome).
HERE="${0:A:h}"
DEST="/Applications/ONEMO Storybook.app"
[ -w /Applications ] || DEST="$HOME/Applications/ONEMO Storybook.app"
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
osacompile -o "$DEST" -e "do shell script \"nohup '$HERE/launch-storybook.sh' >/tmp/onemo-storybook-launch.log 2>&1 &\""
echo "built → $DEST"
