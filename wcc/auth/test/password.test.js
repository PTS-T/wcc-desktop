const {test}=require('node:test');const assert=require('node:assert/strict');
const {hashPassword,verifyPassword}=require('../password');
test('salted passwords verify and reject wrong, plaintext and malformed values',()=>{
    const a=hashPassword('TestSecret1!'),b=hashPassword('TestSecret1!');
    assert.notEqual(a,b);assert.ok(verifyPassword('TestSecret1!',a));
    assert.equal(verifyPassword('wrong',a),false);assert.equal(verifyPassword('TestSecret1!','TestSecret1!'),false);
    assert.equal(verifyPassword({},a),false);assert.equal(verifyPassword('test','scrypt$bad$invalid'),false);
});
