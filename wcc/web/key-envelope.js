// Portable encrypted WCC login keys. Decryption and signing stay in the browser.
(function(root,factory){
    if(typeof module==='object' && module.exports) module.exports=factory(require('node:crypto').webcrypto);
    else root.WccKeyEnvelope=factory(root.crypto);
})(globalThis,function(crypto){
    'use strict';
    const encoder=new TextEncoder(),decoder=new TextDecoder();
    function to64(bytes){let s='';for(const x of bytes)s+=String.fromCharCode(x);return btoa(s);}
    function from64(text){
        if(typeof text!=='string'||text.length>65536)throw new Error('Invalid encrypted key');
        return Uint8Array.from(atob(text),c=>c.charCodeAt(0));
    }
    function rawKey(value){
        if(!value||value.type!=='wcc-login-key'||typeof value.username!=='string'||!value.privateKey||value.privateKey.kty!=='EC'||value.privateKey.crv!=='P-256'||!value.privateKey.d)
            throw new Error('Invalid WCC login key');
        return value;
    }
    async function derive(passphrase,salt,iterations,usage){
        if(typeof passphrase!=='string'||!passphrase||passphrase.length>1024)throw new Error('Enter the key passphrase');
        const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
        return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,usage);
    }
    async function encryptKey(value,passphrase){
        rawKey(value);
        if(typeof passphrase!=='string'||passphrase.length<16)throw new Error('Use a passphrase of at least 16 characters');
        const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iterations=600000;
        const key=await derive(passphrase,salt,iterations,['encrypt']);
        const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(value)));
        return {v:1,type:'wcc-encrypted-login-key',cipher:'AES-256-GCM',kdf:{name:'PBKDF2',hash:'SHA-256',iterations,salt:to64(salt)},iv:to64(iv),ciphertext:to64(new Uint8Array(ciphertext))};
    }
    async function decryptKey(value,passphrase){
        if(!value||value.type!=='wcc-encrypted-login-key'||value.v!==1||value.cipher!=='AES-256-GCM'||value.kdf?.name!=='PBKDF2'||value.kdf?.hash!=='SHA-256')throw new Error('Unsupported encrypted key format');
        const iterations=value.kdf.iterations;
        if(!Number.isInteger(iterations)||iterations<100000||iterations>1000000)throw new Error('Invalid key derivation parameters');
        const salt=from64(value.kdf.salt),iv=from64(value.iv),data=from64(value.ciphertext);
        if(salt.length!==16||iv.length!==12||data.length<17)throw new Error('Invalid encrypted key');
        const key=await derive(passphrase,salt,iterations,['decrypt']);
        try{return rawKey(JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,data))));}
        catch(e){throw new Error('Cannot unlock key: incorrect passphrase or damaged file');}
    }
    return {encryptKey,decryptKey};
});
