#!/bin/bash
# Internal-only SSH for the shared Desktop; per-install secret is stored in a private volume.
if ! command -v sshd >/dev/null; then   # normally baked in by install_sshd.sh (fallback for a plain webtop image)
  echo "[sshd] not in the image — installing"
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends \
    openssh-server xdotool wmctrl scrot x11-utils >/dev/null || echo "[sshd] install failed (offline?)"
fi
command -v sshd >/dev/null || exit 0
F=/wcc-secret/desktop_ssh.json
mkdir -p "$(dirname "$F")"
PW=$(sed -n 's/.*"password": *"\([A-Za-z0-9]*\)".*/\1/p' "$F" 2>/dev/null)
if [ -z "$PW" ]; then
  PW=$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24)
  ( umask 077; printf '{"host": "wcc-desktop", "port": 22, "user": "abc", "password": "%s"}\n' "$PW" > "$F" )
fi
chown root:root "$F"; chmod 600 "$F"
echo "abc:$PW" | chpasswd
usermod -s /bin/bash abc 2>/dev/null
# SSH users get a desktop, not root: drop abc from sudo (the image adds it) + any NOPASSWD drop-in
gpasswd -d abc sudo >/dev/null 2>&1; grep -rl '^abc' /etc/sudoers.d 2>/dev/null | xargs -r rm -f
# persistent host keys (no "host key changed" after a recreate)
K=/config/.ssh-host; mkdir -p "$K"; chmod 700 "$K"
[ -f "$K/ssh_host_ed25519_key" ] || ssh-keygen -q -t ed25519 -N '' -f "$K/ssh_host_ed25519_key"
[ -f "$K/ssh_host_rsa_key" ] || ssh-keygen -q -t rsa -b 3072 -N '' -f "$K/ssh_host_rsa_key"
chown -R root:root "$K"
mkdir -p /etc/ssh/sshd_config.d /run/sshd
cat > /etc/ssh/sshd_config.d/wcc-desktop.conf <<C
HostKey $K/ssh_host_ed25519_key
HostKey $K/ssh_host_rsa_key
PasswordAuthentication yes
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers abc
X11Forwarding no
SetEnv DISPLAY=:1
C
echo "[sshd] ready (abc@wcc-desktop:22)"
