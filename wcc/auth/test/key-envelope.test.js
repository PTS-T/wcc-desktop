const {test}=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const {encryptKey,decryptKey}=require('../../web/key-envelope');
test('encrypted login keys roundtrip, randomize, and reject wrong passphrase/tampering',async()=>{
    const {privateKey}=crypto.generateKeyPairSync('ec',{namedCurve:'P-256'});
    const value={v:1,type:'wcc-login-key',username:'test',keyId:'test',privateKey:privateKey.export({format:'jwk'})};
    const phrase='test-only-unlock-phrase-0123456789';
    const one=await encryptKey(value,phrase),two=await encryptKey(value,phrase);
    assert.notEqual(one.ciphertext,two.ciphertext);assert.deepEqual(await decryptKey(one,phrase),value);
    assert.equal(JSON.stringify(one).includes(value.privateKey.d),false);
    await assert.rejects(decryptKey(one,'incorrect'),/Cannot unlock/);
    const bytes=Buffer.from(one.ciphertext,'base64');bytes[0]^=1;
    await assert.rejects(decryptKey({...one,ciphertext:bytes.toString('base64')},phrase),/Cannot unlock/);
    await assert.rejects(decryptKey({...one,kdf:{...one.kdf,iterations:999999999}},phrase),/parameters/);
});
