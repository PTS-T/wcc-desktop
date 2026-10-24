#!/bin/bash
# FileBrowser (single Go binary) → /usr/local/bin/filebrowser. Served by the desktop's nginx at <SUBFOLDER>filebrowser/
# (custom-cont-init.d/40-wcc-apps.sh) and run as abc by custom-services.d/filebrowser.
set -e
curl -fsSL -o /tmp/fb.tgz https://github.com/filebrowser/filebrowser/releases/latest/download/linux-amd64-filebrowser.tar.gz
tar xzf /tmp/fb.tgz -C /usr/local/bin filebrowser && chmod 755 /usr/local/bin/filebrowser && rm -f /tmp/fb.tgz
echo "[install] $(/usr/local/bin/filebrowser version)"
