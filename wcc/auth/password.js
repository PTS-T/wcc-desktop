const crypto=require('node:crypto');
function hashPassword(password){
    if(typeof password!=='string'||password.length<8||password.length>1024)throw new Error('Invalid password length');
    const salt=crypto.randomBytes(16).toString('hex');
    return 'scrypt$'+salt+'$'+crypto.scryptSync(password,salt,64).toString('hex');
}
function verifyPassword(password,stored){
    if(typeof password!=='string'||password.length>1024||typeof stored!=='string')return false;
    const [alg,salt,hash]=stored.split('$');if(alg!=='scrypt'||!salt||!hash)return false;
    const expected=Buffer.from(hash,'hex');const actual=crypto.scryptSync(password,salt,64);
    return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
}
module.exports={hashPassword,verifyPassword};
