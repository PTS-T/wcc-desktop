#!/usr/bin/env python3
"""Create private installation settings, never overwrite an existing .env."""
from pathlib import Path
import argparse, secrets, os
p=argparse.ArgumentParser();p.add_argument('--admin-user',default='admin');p.add_argument('--http-port',type=int,default=80);p.add_argument('--https-port',type=int,default=443);a=p.parse_args()
if not all(0<x<65536 for x in [a.http_port,a.https_port]):p.error('Invalid port')
import re
if not re.fullmatch(r'[A-Za-z0-9_.@-]{1,80}',a.admin_user):p.error('Invalid username')
root=Path(__file__).resolve().parents[1];env=root/'.env'
password=secrets.token_urlsafe(24)+'aA1!'
content=f'''# PRIVATE: generated for this installation; do not commit or share.
MONGO_USER=wcc
MONGO_PASSWORD={secrets.token_hex(32)}
WCC_SESSION_SECRET={secrets.token_hex(48)}
WCC_ADMIN_USER={a.admin_user}
WCC_ADMIN_PASSWORD={password}
BIND_ADDRESS=0.0.0.0
HTTP_PORT={a.http_port}
HTTPS_PORT={a.https_port}
PUID=1000
PGID=1000
TZ=Asia/Bangkok
'''
try:
    fd=os.open(env,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
except FileExistsError:
    raise SystemExit('.env already exists; left unchanged.')
with os.fdopen(fd,'w') as f:f.write(content)
print('Created private .env (0600). Read WCC_ADMIN_USER and WCC_ADMIN_PASSWORD locally for first login.')
