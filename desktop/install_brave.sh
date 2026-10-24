#!/bin/bash
# Brave (official apt repo) + a wrapper that adds --no-sandbox on unprivileged containers,
# the same way the image's chromium wrapper does.
set -e
curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] https://brave-browser-apt-release.s3.brave.com/ stable main" > /etc/apt/sources.list.d/brave-browser-release.list
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends brave-browser >/dev/null
cat > /usr/local/bin/brave <<'W'
#!/bin/bash
if ! pgrep -x brave > /dev/null; then rm -f $HOME/.config/BraveSoftware/Brave-Browser/Singleton*; fi
if grep -q 'Seccomp:.0' /proc/1/status; then exec /usr/bin/brave-browser --no-first-run --password-store=basic "$@"
else exec /usr/bin/brave-browser --no-first-run --password-store=basic --no-sandbox --test-type "$@"; fi
W
chmod 755 /usr/local/bin/brave
sed -i 's|^Exec=/usr/bin/brave-browser-stable|Exec=/usr/local/bin/brave|' /usr/share/applications/brave-browser.desktop
echo "[install] $(brave-browser --version)"
