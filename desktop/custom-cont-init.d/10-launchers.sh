#!/bin/bash
# wcc-desktop: desktop icon for the baked-in browser (Brave). Obsidian was removed (2026-10-21): drop its old icon and
# the old unused app copy in /config/apps/obsidian; the vault folder (/config/Obsidian Vault) is user data and is kept.
mkdir -p /config/Desktop
rm -f /config/Desktop/obsidian.desktop; rm -rf /config/apps/obsidian; rmdir /config/apps 2>/dev/null
for app in brave-browser; do
  src=/usr/share/applications/$app.desktop dst=/config/Desktop/$app.desktop
  [ -f "$src" ] || continue
  if [ ! -f "$dst" ] || grep -q '/config/apps/' "$dst"; then cp "$src" "$dst"; chmod +x "$dst"; fi
done
chown -R abc:abc /config/Desktop
