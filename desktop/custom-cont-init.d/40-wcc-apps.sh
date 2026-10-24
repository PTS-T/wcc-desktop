#!/bin/bash
# wcc-desktop: FileBrowser + Jupyter inside the desktop, proxied by the desktop's own nginx (runs after init-nginx
# regenerates the site, so patch it every boot):
#   <SUBFOLDER>filebrowser/ → 127.0.0.1:8085     <SUBFOLDER>jupyter/ → 127.0.0.1:8888
# Both apps run with the public base path (WCC gateway prefix + SUBFOLDER, e.g. /mawcc/desktop/) because their pages
# use absolute links; nothing listens outside the container (auth = the WCC login in front of /mawcc/).
SUB=${SUBFOLDER:-/desktop/}
PUB=${WCC_PUBLIC_PREFIX:-/mawcc}${SUB}
SITE=/etc/nginx/sites-available/default
printf '%s\n' "$PUB" > /run/wcc-public-base
if [ -f "$SITE" ] && ! grep -q 'wcc-apps' "$SITE"; then
  BLOCK=$(cat <<B
  # wcc-apps (custom-cont-init.d/40-wcc-apps.sh)
  location ${SUB}filebrowser/ {
    proxy_pass http://127.0.0.1:8085${PUB}filebrowser/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_buffering off;
    proxy_request_buffering off;
    client_max_body_size 0;
    proxy_read_timeout 3600s;
  }
  location ${SUB}jupyter/ {
    proxy_pass http://127.0.0.1:8888${PUB}jupyter/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_buffering off;
    proxy_request_buffering off;
    client_max_body_size 0;
    proxy_read_timeout 86400s;
  }
B
)
  B="$BLOCK" awk '/^  error_page 500/ { print ENVIRON["B"] } { print }' "$SITE" > "$SITE.wcc" && mv "$SITE.wcc" "$SITE"
fi
# Both start in the desktop's own Desktop folder (/config/Desktop = ~/Desktop of abc, what the Selkies desktop shows)
install -d -o abc -g abc /config/Desktop
# FileBrowser db (no own login: noauth behind the WCC login) — created once, owned by abc; dark theme every boot
D=/config/.filebrowser; mkdir -p "$D"; chown abc:abc "$D"
if [ -x /usr/local/bin/filebrowser ]; then
  if [ ! -f "$D/filebrowser.db" ]; then
    s6-setuidgid abc filebrowser -d "$D/filebrowser.db" config init --auth.method=noauth >/dev/null
    s6-setuidgid abc filebrowser -d "$D/filebrowser.db" users add admin "$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24)" --perm.admin >/dev/null
  fi
  s6-setuidgid abc filebrowser -d "$D/filebrowser.db" config set --branding.theme dark --branding.files /opt/wcc-apps/filebrowser >/dev/null
fi
# JupyterLab custom css (Agent Chat dark palette; the dark theme itself is the image default — apps/jupyter/overrides.json)
[ -f /opt/wcc-apps/jupyter/custom.css ] && install -D -o abc -g abc -m 644 /opt/wcc-apps/jupyter/custom.css /config/.jupyter/custom/custom.css && chown abc:abc /config/.jupyter
echo "[wcc-apps] filebrowser + jupyter at ${PUB}{filebrowser,jupyter}/ (root /config/Desktop)"
