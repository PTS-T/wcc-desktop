#!/bin/sh
set -eu
mkdir -p /etc/wcc/tls
if [ ! -s /etc/wcc/tls/server.key ] || [ ! -s /etc/wcc/tls/server.crt ]; then
  umask 077
  openssl req -x509 -newkey rsa:3072 -nodes -days 365 -subj '/CN=WCC local installation' \
    -keyout /etc/wcc/tls/server.key -out /etc/wcc/tls/server.crt 2>/dev/null
  echo 'Generated installation-specific TLS certificate; see README for trusted HTTPS.'
fi
