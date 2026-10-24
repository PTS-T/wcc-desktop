#!/usr/bin/env node
// Keep plaintext input and passphrase outside the repository. Only ciphertext is written.
const fs=require('node:fs');
const {encryptKey}=require('../wcc/web/key-envelope');
(async()=>{
    const [input,output]=process.argv.slice(2),passFile=process.env.WCC_KEY_PASSPHRASE_FILE;
    if(!input||!output||!passFile)throw Error('Usage: WCC_KEY_PASSPHRASE_FILE=/private/passphrase.txt node scripts/encrypt-key.cjs /private/user.key keys/user.wcc-key.json');
    const envelope=await encryptKey(JSON.parse(fs.readFileSync(input,'utf8')),fs.readFileSync(passFile,'utf8').trim());
    fs.writeFileSync(output,JSON.stringify(envelope,null,2)+'\n',{flag:'wx',mode:0o644});
    console.log('Encrypted key exported. Keep its passphrase outside Git.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
