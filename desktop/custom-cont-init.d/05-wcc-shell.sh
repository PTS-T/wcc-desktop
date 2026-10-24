#!/bin/bash
# wcc-desktop: publish the WCC Desktop shell (web_proxy_nginx, mounted ro at /usr/share/selkies/wcc-shell) as
# <SUBFOLDER>wcc/ — a symlink inside the Selkies web root, which init-nginx wipes and re-copies on every boot
# (so the shell can't be bind-mounted there directly).
ln -sfn /usr/share/selkies/wcc-shell /usr/share/selkies/web/wcc
