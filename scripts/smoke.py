#!/usr/bin/env python3
"""Exercise a running WCC install without logging its credentials or key files."""
import argparse, http.cookiejar, json, secrets, ssl, urllib.request, urllib.error
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--url',default='https://127.0.0.1');p.add_argument('--insecure',action='store_true');a=p.parse_args()
config=dict(line.split('=',1) for line in (Path(__file__).resolve().parents[1]/'.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
ctx=ssl._create_unverified_context() if a.insecure else ssl.create_default_context()
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kw):return None
def client():
    jar=http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx),urllib.request.HTTPCookieProcessor(jar),NoRedirect()),jar
admin,adminjar=client();guest,_=client();user,userjar=client();checks=[]
def request(c,path,body=None,method=None):
    req=urllib.request.Request(a.url.rstrip('/')+path,data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type':'application/json'},method=method)
    try:r=c.open(req,timeout=45)
    except urllib.error.HTTPError as e:r=e
    b=r.read();
    try:d=json.loads(b)
    except (ValueError,UnicodeDecodeError):d=b
    return r.code,d,r.headers
def check(name,ok):
    if not ok:raise AssertionError(name)
    checks.append(name);print('PASS',name)
username='wcc_smoke_'+secrets.token_hex(4);password='Test1!'+secrets.token_urlsafe(18);pending=username+'_pending';keyid=None
try:
    check('public login',request(guest,'/login.html')[0]==200)
    for path in ['/mawcc/desktop/wcc/','/mawcc/desktop/filebrowser/','/mawcc/desktop/jupyter/lab']:
        code,_,headers=request(guest,path);check('anonymous denied '+path,code==302 and headers['Location']=='/login.html')
    check('anonymous admin API denied',request(guest,'/api/users')[0]==401)
    check('operator injection rejected',request(guest,'/api/login',{'username':{'$ne':None},'password':{'$ne':None}})[0]==400)
    code,d,h=request(admin,'/api/login',{'username':config['WCC_ADMIN_USER'],'password':config['WCC_ADMIN_PASSWORD']})
    check('administrator password login',code==200 and d.get('success'))
    cookies=list(adminjar);check('secure persistent session cookie',len(cookies)==1 and cookies[0].secure and cookies[0].has_nonstandard_attr('HttpOnly'))
    check('identity',request(admin,'/api/whoami')[1].get('role')=='superadmin')
    for path in ['/home.html','/admin-view.html','/config-box.html','/mawcc/desktop/wcc/','/mawcc/desktop/','/mawcc/desktop/filebrowser/','/mawcc/desktop/jupyter/lab']:
        code,body,_=request(admin,path);check('authenticated page '+path,code==200 and isinstance(body,bytes) and len(body)>100)
    d=request(admin,'/api/users')[1];check('user list excludes password and key material',all('password' not in u and 'keys' not in u for u in d))
    check('create normal user',request(admin,'/api/create-user',{'username':username,'password':password})[1].get('success'))
    check('normal user login',request(user,'/api/login',{'username':username,'password':password})[1].get('success'))
    check('normal user cannot administer',request(user,'/api/users')[0]==403 and request(user,'/config-box.html')[0]==403)
    check('normal user Desktop access',request(user,'/api/desktop-access')[0]==200)
    d=request(user,'/api/keys/create',{'username':username,'label':'Smoke test'})[1];keyid=d.get('id')
    check('per-user key creation',d.get('success') and json.loads(d['file'])['type']=='wcc-login-key')
    check('admin list still excludes private keys',all('keys' not in u for u in request(admin,'/api/users')[1]))
    check('per-user key deletion',request(user,'/api/keys/delete',{'username':username,'id':keyid})[1].get('success'));keyid=None
    new_password='Updated1!'+secrets.token_urlsafe(18)
    check('password change',request(user,'/api/change-password',{'username':username,'oldPassword':password,'newPassword':new_password})[1].get('success'))
    check('password change revokes old session',request(user,'/api/whoami')[0]==401)
    check('new password login',request(user,'/api/login',{'username':username,'password':new_password})[1].get('success'))
    request(admin,'/api/update-user',{'username':username,'status':'blocked'})
    check('blocked account session revoked',request(user,'/api/desktop-access')[0]==401)
    check('registration requires approval',request(guest,'/api/register',{'username':pending,'password':password,'email':'smoke@example.invalid'})[1].get('autoApproved') is False)
    check('pending cannot login',not request(guest,'/api/login',{'username':pending,'password':password})[1].get('success'))
    check('live nginx writes disabled',request(admin,'/api/save-nginx-config',{'code':'invalid'})[0]==405)
    request(admin,'/api/delete-user',{'username':username});request(admin,'/api/delete-user',{'username':pending})
    check('logout',request(admin,'/api/logout',{})[1].get('success'))
    check('logged-out session denied',request(admin,'/api/whoami')[0]==401)
finally:
    # Reauthenticate only for cleanup; temporary test accounts are never retained intentionally.
    try:
        request(admin,'/api/login',{'username':config['WCC_ADMIN_USER'],'password':config['WCC_ADMIN_PASSWORD']})
        for name in [username,pending]:request(admin,'/api/delete-user',{'username':name})
        request(admin,'/api/logout',{})
    except Exception:print('Cleanup could not finish; check temporary account prefix',username)
print('PASS',len(checks),'integration checks')
