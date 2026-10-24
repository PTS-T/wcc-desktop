// Optional live browser regression: install Playwright/Chromium and provide private inputs via paths.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {decryptKey}=require('../wcc/web/key-envelope');
const root=path.resolve(__dirname,'..');
const url=(process.env.WCC_TEST_URL||'https://127.0.0.1').replace(/\/$/,'');
const keyPath=process.env.WCC_TEST_KEY_FILE||path.join(root,'keys/initial-admin.wcc-key.json');
if(!process.env.WCC_TEST_KEY_PASSPHRASE_FILE)throw Error('Set WCC_TEST_KEY_PASSPHRASE_FILE to a private file outside Git');
const secret=fs.readFileSync(process.env.WCC_TEST_KEY_PASSPHRASE_FILE,'utf8');
const phrase=(secret.match(/^Key passphrase: (.+)$/m)||[])[1]||secret.trim();
const envelope=JSON.parse(fs.readFileSync(keyPath,'utf8'));
const output=process.env.WCC_TEST_ARTIFACT_DIR;if(output)fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}});
  const page=await context.newPage();let leaked=false,challenges=0;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if((r.postData()||'').includes(phrase)||r.url().includes(phrase))leaked=true;if(r.url().endsWith('/api/key-challenge'))challenges++;});
  async function upload(name,data){await page.locator('#keyFileInput').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(name=>document.querySelector('#keyFileName').textContent.includes(name),name);}
  async function logout(){await page.evaluate(async()=>{await fetch('/api/logout',{method:'POST'});sessionStorage.clear();});}
  await page.goto(url+'/login.html');
  await page.locator('#loginPass').fill('old-password-field-test');
  await upload('initial-admin.wcc-key.json',envelope);
  assert.equal(await page.locator('#loginPass').isVisible(),false);
  assert.equal(await page.locator('#loginUser').isVisible(),false);
  assert.equal(await page.locator('#keyPassphrase').isVisible(),true);
  assert.equal(await page.locator('#keyPassphrase').evaluate(e=>e===document.activeElement),true);
  await page.locator('#connectButton').click();
  await page.waitForFunction(()=>document.querySelector('#keyError').textContent.includes('KEY PASSPHRASE'));
  assert.equal(challenges,0);assert.equal(await page.locator('#keyPassphrase').evaluate(e=>e===document.activeElement),true);
  console.log('PASS key mode hides password fields and empty phrase focuses the correct input');
  if(output)await page.screenshot({path:path.join(output,'key-login-fixed.png')});
  await page.locator('#keyPassphrase').fill(phrase);
  await upload('initial-reselected.wcc-key.json',envelope);
  assert.ok((await page.locator('#keyPassphrase').inputValue())===phrase,'Unlock phrase was cleared during file reselection');
  assert.equal(await page.locator('#connectButton').textContent(),'Unlock & Connect');
  await page.locator('#connectButton').click();await page.waitForURL('**/home.html');
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('currentUser')).role),'superadmin');
  console.log('PASS phrase survives file reselection and real encrypted admin login succeeds');
  await logout();await page.goto(url+'/login.html');
  await upload('initial-admin.wcc-key.json',envelope);await page.locator('#keyPassphrase').fill(phrase);
  await page.locator('#clearKeyFile').click();
  assert.ok((await page.locator('#keyPassphrase').inputValue()).length===0,'Switching modes did not clear the unlock phrase');
  assert.equal(await page.locator('#loginPass').isVisible(),true);
  assert.equal(await page.locator('#keyFileInput').evaluate(e=>e.files.length),0);
  assert.equal(await page.locator('#connectButton').textContent(),'Connect');
  console.log('PASS switching to password login clears the selected key and unlock phrase');
  const raw=await decryptKey(envelope,phrase);await upload('legacy.key',raw);
  assert.equal(await page.locator('#loginPass').isVisible(),false);
  assert.equal(await page.locator('#keyPassphraseGroup').isVisible(),false);
  await page.locator('#connectButton').click();await page.waitForURL('**/home.html');
  console.log('PASS legacy plaintext key login still succeeds');
  assert.equal(leaked,false);assert.deepEqual(errors,[]);await logout();
  const report={passwordFieldsHidden:true,emptyPhraseFocus:true,phraseSurvivesReselection:true,encryptedLogin:true,passwordModeRestore:true,legacyLogin:true,passphraseTransmitted:false,errors};
  if(output)fs.writeFileSync(path.join(output,'browser-checks.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
