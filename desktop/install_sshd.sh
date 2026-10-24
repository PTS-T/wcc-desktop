#!/bin/bash
# SSH server + GUI automation tools, so users/agents can drive the desktop over SSH (DISPLAY=:1).
# The login itself (password, host keys, sshd config) is set per boot by custom-cont-init.d/30-sshd.sh.
set -e
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends openssh-server xdotool wmctrl scrot x11-utils >/dev/null
rm -f /etc/ssh/ssh_host_*            # per-container host keys live in /config/.ssh-host
echo "[install] $(ssh -V 2>&1)"
