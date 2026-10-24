// WCC account, session and login-key service. Core extracted from WCC Platform.
'use strict';
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const fs = require('fs');
const crypto = require('crypto');
const {hashPassword, verifyPassword} = require('./password');
const app = express();
app.set('trust proxy', 1);
const required = name => { if (!process.env[name]) throw new Error(name + ' is required'); return process.env[name]; };
const sessionSecret = required('WCC_SESSION_SECRET');
if (sessionSecret.length < 32) throw new Error('WCC_SESSION_SECRET must be at least 32 characters');
const mongoUrl = `mongodb://${encodeURIComponent(required('MONGO_USER'))}:${encodeURIComponent(required('MONGO_PASSWORD'))}@mongo:27017/wcc?authSource=admin`;
app.use(express.json({limit:'1mb'}));
app.use(session({
    name:'wcc_sid', secret:sessionSecret, resave:false, saveUninitialized:false,
    store:MongoStore.create({mongoUrl,collectionName:'sessions',ttl:14*24*60*60}),
    cookie:{httpOnly:true,secure:true,sameSite:'lax',maxAge:14*24*60*60*1000}
}));
// Same-origin writes only; only the gateway is reachable from outside Docker.
app.use(async (req,res,next) => {
    try {
        if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== 'https://' + req.headers.host)
            return res.status(403).json({success:false,message:'Origin rejected'});
        const scalarFields = ['username','password','oldPassword','newPassword','targetUsername','email','name','role','status','signature','label','id'];
        for (const key of scalarFields) if (req.body && req.body[key] !== undefined && typeof req.body[key] !== 'string')
            return res.status(400).json({success:false,message:'Invalid '+key});
        for (const key of ['password','oldPassword','newPassword']) if(req.body?.[key]?.length>1024) return res.status(400).json({success:false,message:'Password too long'});
        if (req.body && req.body.username !== undefined && !/^[A-Za-z0-9_.@-]{1,80}$/.test(req.body.username))
            return res.status(400).json({success:false,message:'Invalid username'});
        if (req.body?.name !== undefined && !/^[A-Za-z0-9_. -]{1,80}$/.test(req.body.name)) return res.status(400).json({success:false,message:'Invalid group name'});
        if (req.body?.role && !['user','admin','superadmin'].includes(req.body.role)) return res.status(400).json({success:false,message:'Invalid role'});
        if (req.body?.status && !['approved','pending','blocked'].includes(req.body.status)) return res.status(400).json({success:false,message:'Invalid status'});
        if (req.session.user) {
            const dbUser = await User.findById(req.session.user.id);
            if (!dbUser || dbUser.status !== 'approved' || (req.session.user.authVersion||0)!==(dbUser.authVersion||0)) delete req.session.user;
            else {
                const groups = await Group.find({name:{$in:dbUser.groups || []}});
                req.session.user = {id:String(dbUser._id),authVersion:dbUser.authVersion||0,username:dbUser.username,role:dbUser.role,status:dbUser.status,
                    permissions:[...new Set([...(dbUser.permissions||[]),...groups.flatMap(g=>g.permissions||[])])]};
            }
        }
        const publicPaths = ['/api/login','/api/login-key','/api/key-challenge','/api/register','/api/auth-settings','/api/signup-settings','/healthz'];
        const isPublic = publicPaths.includes(req.path) && (req.path !== '/api/auth-settings' || req.method === 'GET');
        if (!isPublic && !req.session.user) return res.status(401).json({success:false,message:'Login required'});
        const adminPaths = ['/api/users','/api/create-user','/api/update-user','/api/admin-reset-password','/api/delete-user',
            '/api/groups','/api/create-group','/api/update-group','/api/delete-group','/api/auth-settings',
            '/api/save-menu-config','/api/get-nginx-config','/api/save-nginx-config'];
        if (adminPaths.includes(req.path) && !['admin','superadmin'].includes(req.session.user?.role))
            return res.status(403).json({success:false,message:'Admins only'});
        next();
    } catch (e) { next(e); }
});
// Bounded per-IP login/challenge throttling; no distributed proxy trust beyond the gateway.
const attempts = new Map();
setInterval(()=>{const now=Date.now();for(const [k,v] of attempts) if(v.until<now) attempts.delete(k);},60000).unref();
app.use(['/api/login','/api/login-key','/api/key-challenge','/api/register'],(req,res,next)=>{
    const key=req.ip; const now=Date.now(); let v=attempts.get(key);
    if(!v || v.until<now) {v={n:0,until:now+60000};attempts.set(key,v);}
    if(++v.n>30) return res.status(429).json({success:false,message:'Try again in a minute'});
    next();
});
async function findWithPassword(username,password) {
    if(typeof username!=='string'||typeof password!=='string') return null;
    const u=await User.findOne({username});return u && verifyPassword(password,u.password) ? u : null;
}
async function startSession(req,user) {
    await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
    const dbUser=await User.findById(user.id);
    user.authVersion=dbUser.authVersion||0;
    req.session.user=user;
    await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
}
// --- 3. Schemas ---
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    authVersion: {type:Number,default:0},
    email: { type: String, default: '' }, // อีเมล (จากหน้าสมัคร)
    role: { type: String, default: 'user' }, // user, admin, superadmin
    status: { type: String, default: 'pending' }, // ✅ ค่าเริ่มต้นเป็น pending เพื่อรออนุมัติ
    groups: [String], // เก็บชื่อ Group ที่สังกัด
    permissions: [String], // เก็บ ID เมนูสิทธิ์รายบุคคล
    // Login key files (asymmetric ECDSA P-256). The server stores the full file
    // so the user can re-download it anytime; publicKey verifies login signatures.
    keys: [{
        id: String,
        label: String,
        publicKey: String,   // JWK JSON (verification)
        file: String,        // full downloadable key-file JSON (contains private key)
        createdAt: { type: Date, default: Date.now }
    }]
});

const groupSchema = new mongoose.Schema({
    name: {type:String,unique:true,required:true},
    permissions: [String]
});

const User = mongoose.model('User', userSchema);
const Group = mongoose.model('Group', groupSchema);
// Global auth settings (single doc): which login methods are allowed + key quota.
const settingsSchema = new mongoose.Schema({
    _id: { type: String, default: 'auth' },
    allowPasswordLogin: { type: Boolean, default: true }, // default ON: allow username/password login
    allowKeyLogin: { type: Boolean, default: true },
    maxKeysPerUser: { type: Number, default: 3 },
    // ── Sign up Methods ──
    autoApproveSignup: { type: Boolean, default: false },   // สมัครแล้วเป็น USER ทันที (ไม่ต้องรอ admin)
    signupRequireEmail: { type: Boolean, default: true },  // บังคับใส่อีเมลตอนสมัคร
    signupPasswordPolicy: { type: Boolean, default: true } // บังคับรหัสผ่านมาตรฐาน (เล็ก/ใหญ่/เลข/อักขระพิเศษ)
});
const Settings = mongoose.model('Settings', settingsSchema);
async function getSettings() {
    let s = await Settings.findById('auth');
    if (!s) s = await Settings.create({ _id: 'auth' });
    return s;
}
// ตรวจรหัสผ่านมาตรฐาน: อย่างน้อย 8 ตัว + ตัวเล็ก + ตัวใหญ่ + ตัวเลข + อักขระพิเศษ
function passwordPolicyError(pw) {
    pw = String(pw || '');
    if (pw.length < 8) return 'Password must be at least 8 characters';
    if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter';
    if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter';
    if (!/[0-9]/.test(pw)) return 'Password must contain a number';
    if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain a special character';
    return null;
}

// ทุกคนที่เป็น role "user" อยู่ในกลุ่ม "user" เสมอ (baseline group) — คืน array groups ที่การันตีมี "user"
function withUserGroup(role, groups) {
    const g = Array.isArray(groups) ? groups.slice() : [];
    if (role === 'user' && !g.includes('user')) g.push('user');
    return g;
}

// สร้างกลุ่ม baseline "user" ถ้ายังไม่มี (permission group, ไม่ใช่ Plan)
async function ensureBaseUserGroup() {
    const existing = await Group.findOne({ name: 'user' });
    if (!existing) {
        await Group.create({ name: 'user', permissions: ['wcc_desktop'] });
    }
}

// Generate an ECDSA P-256 key pair -> stored key object { id, label, publicKey, file }.
function generateKeyObject(username, label) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pubJwk = publicKey.export({ format: 'jwk' });
    const privJwk = privateKey.export({ format: 'jwk' });
    const id = crypto.randomBytes(8).toString('hex');
    const file = JSON.stringify({ v: 1, type: 'wcc-login-key', alg: 'ECDSA-P256', username, keyId: id, privateKey: privJwk }, null, 2);
    return { id, label: label || 'Key', publicKey: JSON.stringify(pubJwk), file, createdAt: new Date() };
}

// In-memory one-time challenges for key-file login (username -> { nonce, exp }).
const keyChallenges = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of keyChallenges) if (v.exp < now) keyChallenges.delete(k); }, 60000);

// --- 4. Auth & Registration APIs ---

// 4.1 Login API
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const settings = await getSettings();
        if (!settings.allowPasswordLogin) return res.json({ success: false, message: 'Password login is disabled. Please use a key file.' });
        const user = await findWithPassword(username, password);

        if (!user) return res.json({ success: false, message: 'Invalid username or password' });

        // ตรวจสอบสถานะ (ต้องเป็น approved เท่านั้นถึงจะเข้าหน้า Home ได้)
        if (user.status !== 'approved') {
            return res.json({ success: false, message: 'Your account is pending or blocked' });
        }

        // รวมสิทธิ์: สิทธิ์ส่วนตัว + สิทธิ์จากทุกกลุ่มที่สังกัด
        let combinedPermissions = [...(user.permissions || [])];
        if (user.groups && user.groups.length > 0) {
            const groupsData = await Group.find({ name: { $in: user.groups } });
            groupsData.forEach(g => {
                combinedPermissions = [...new Set([...combinedPermissions, ...(g.permissions || [])])];
            });
        }

        const userData = {
            id: user._id ? String(user._id) : '',
            username: user.username,
            role: user.role,
            status: user.status,
            permissions: combinedPermissions
        };

        await startSession(req, userData);
        res.json({ success: true, user: userData });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// 4.2 Register API (สำหรับคนสมัครเองจากหน้า index)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        const s = await getSettings();
        if (s.signupRequireEmail && !(email && String(email).trim())) {
            return res.json({ success: false, message: 'Email is required' });
        }
        if (s.signupPasswordPolicy) {
            const perr = passwordPolicyError(password);
            if (perr) return res.json({ success: false, message: perr });
        }
        const exists = await User.findOne({ username });
        if (exists) return res.json({ success: false, message: 'Username already exists' });

        const approved = !!s.autoApproveSignup;   // สมัครแล้วเป็น USER ทันที ถ้าเปิดไว้
        await User.create({
            username,
            password: hashPassword(password),
            email: (email || '').trim(),
            role: 'user',
            status: approved ? 'approved' : 'pending',
            groups: approved ? withUserGroup('user', []) : [],
            permissions: []
        });
        res.json({ success: true, autoApproved: approved });
    } catch (e) {
        res.json({ success: false, message: e.message });
    }
});

// 4.3 Change Password (User เปลี่ยนเอง)
app.post('/api/change-password', async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;
        const user = await findWithPassword(username, oldPassword);
        if (!user) return res.json({ success: false, message: 'Old password incorrect' });

        const policyError = passwordPolicyError(newPassword);
        if (policyError) return res.status(400).json({success:false,message:policyError});
        user.password = hashPassword(newPassword);
        user.authVersion=(user.authVersion||0)+1;
        await user.save();
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// 4.3b Per-user login-key management (list / create / download / delete)
// Authorized by an active login session (preferred) or username+password.
async function authUser(req, username, password) {
    const sessUser = req.session && req.session.user;
    if (sessUser && sessUser.username === username) return await User.findOne({ username });
    if (password) return await findWithPassword(username, password);
    return null;
}

app.post('/api/keys/list', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await authUser(req, username, password);
        if (!user) return res.json({ success: false, message: 'Not authorized' });
        const settings = await getSettings();
        const keys = (user.keys || []).map(k => ({ id: k.id, label: k.label, createdAt: k.createdAt }));
        res.json({ success: true, keys, max: settings.maxKeysPerUser });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/keys/create', async (req, res) => {
    try {
        const { username, password, label } = req.body;
        const user = await authUser(req, username, password);
        if (!user) return res.json({ success: false, message: 'Not authorized' });
        const settings = await getSettings();
        if ((user.keys || []).length >= settings.maxKeysPerUser)
            return res.json({ success: false, message: 'Key limit reached (max ' + settings.maxKeysPerUser + ')' });
        const k = generateKeyObject(user.username, label || ('Key ' + ((user.keys || []).length + 1)));
        user.keys.push(k);
        await user.save();
        res.json({ success: true, id: k.id, label: k.label, file: k.file });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/keys/download', async (req, res) => {
    try {
        const { username, password, id } = req.body;
        const user = await authUser(req, username, password);
        if (!user) return res.json({ success: false, message: 'Not authorized' });
        const k = (user.keys || []).find(x => x.id === id);
        if (!k) return res.json({ success: false, message: 'Key not found' });
        res.json({ success: true, label: k.label, file: k.file });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/api/keys/delete', async (req, res) => {
    try {
        const { username, password, id } = req.body;
        const user = await authUser(req, username, password);
        if (!user) return res.json({ success: false, message: 'Not authorized' });
        const before = (user.keys || []).length;
        user.keys = (user.keys || []).filter(x => x.id !== id);
        if (user.keys.length === before) return res.json({ success: false, message: 'Key not found' });
        await user.save();
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// 4.3b-upload Register an EXISTING key file (e.g. one issued on another agent)
// so the SAME key file can log in here too. We store the derived public key +
// keep the file for re-download. Login matches on the file's `username`, so use
// the same username across agents for one key to work everywhere.
app.post('/api/keys/upload', async (req, res) => {
    try {
        const { username, password, file, label } = req.body;
        const user = await authUser(req, username, password);
        if (!user) return res.json({ success: false, message: 'Not authorized' });
        const settings = await getSettings();
        if ((user.keys || []).length >= settings.maxKeysPerUser)
            return res.json({ success: false, message: 'Key limit reached (max ' + settings.maxKeysPerUser + ')' });
        let obj;
        try { obj = typeof file === 'string' ? JSON.parse(file) : file; }
        catch (_) { return res.json({ success: false, message: 'Invalid key file (not JSON)' }); }
        if (!obj || obj.type !== 'wcc-login-key' || !obj.privateKey)
            return res.json({ success: false, message: 'Not a valid wcc-login-key file' });
        const priv = obj.privateKey;
        if (priv.kty !== 'EC' || priv.crv !== 'P-256' || !priv.x || !priv.y)
            return res.json({ success: false, message: 'Unsupported key (need EC P-256)' });
        // Derive the public JWK (drop the private scalar d) and sanity-check it.
        const pubJwk = { kty: 'EC', crv: 'P-256', x: priv.x, y: priv.y };
        try { crypto.createPublicKey({ key: pubJwk, format: 'jwk' }); }
        catch (e) { return res.json({ success: false, message: 'Invalid key material' }); }
        const id = obj.keyId || crypto.randomBytes(8).toString('hex');
        if ((user.keys || []).some(k => k.id === id))
            return res.json({ success: false, message: 'This key is already registered' });
        // Re-issue the stored file under THIS username so re-download stays consistent.
        const storeFile = JSON.stringify({ v: 1, type: 'wcc-login-key', alg: 'ECDSA-P256', username: user.username, keyId: id, privateKey: priv }, null, 2);
        user.keys.push({ id, label: label || 'Uploaded Key', publicKey: JSON.stringify(pubJwk), file: storeFile, createdAt: new Date() });
        await user.save();
        res.json({ success: true, id, label: label || 'Uploaded Key' });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// 4.3c Issue a one-time challenge (nonce) for key-file login
app.post('/api/key-challenge', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(user.keys && user.keys.length)) return res.json({ success: false, message: 'No key registered for this user' });
        const nonce = crypto.randomBytes(32).toString('base64');
        keyChallenges.set(username, { nonce, exp: Date.now() + 120000 });
        res.json({ success: true, challenge: nonce });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// 4.3d Verify the signature over the challenge against ANY of the user's keys -> log in
app.post('/api/login-key', async (req, res) => {
    try {
        const settings = await getSettings();
        if (!settings.allowKeyLogin) return res.json({ success: false, message: 'Key login is disabled.' });
        const { username, signature } = req.body;
        const chal = keyChallenges.get(username);
        if (!chal || chal.exp < Date.now()) return res.json({ success: false, message: 'Challenge expired, please try again' });
        const user = await User.findOne({ username });
        if (!user || !(user.keys && user.keys.length)) return res.json({ success: false, message: 'No key registered' });

        let ok = false;
        for (const k of user.keys) {
            try {
                const pub = crypto.createPublicKey({ key: JSON.parse(k.publicKey), format: 'jwk' });
                if (crypto.verify('sha256', Buffer.from(chal.nonce, 'base64'), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature || '', 'base64'))) { ok = true; break; }
            } catch (e) { /* try next key */ }
        }

        keyChallenges.delete(username); // one-time use
        if (!ok) return res.json({ success: false, message: 'Key verification failed' });
        if (user.status !== 'approved') return res.json({ success: false, message: 'Your account is pending or blocked' });

        let combinedPermissions = [...(user.permissions || [])];
        if (user.groups && user.groups.length > 0) {
            const groupsData = await Group.find({ name: { $in: user.groups } });
            groupsData.forEach(g => {
                combinedPermissions = [...new Set([...combinedPermissions, ...(g.permissions || [])])];
            });
        }
        const userData = { id: user._id ? String(user._id) : '', username: user.username, role: user.role, status: user.status, permissions: combinedPermissions };
        await startSession(req, userData);
        res.json({ success: true, user: userData });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// 4.3e Auth settings — read (public) / write (admins only)
app.get('/api/auth-settings', async (req, res) => {
    try {
        const s = await getSettings();
        res.json({ success: true, allowPasswordLogin: s.allowPasswordLogin, allowKeyLogin: s.allowKeyLogin, maxKeysPerUser: s.maxKeysPerUser,
                   autoApproveSignup: s.autoApproveSignup, signupRequireEmail: s.signupRequireEmail, signupPasswordPolicy: s.signupPasswordPolicy });
    } catch (e) { res.json({ success: false, message: e.message }); }
});
app.post('/api/auth-settings', async (req, res) => {
    try {
        const sessUser = req.session && req.session.user;
        if (!sessUser || (sessUser.role !== 'admin' && sessUser.role !== 'superadmin')) return res.json({ success: false, message: 'Admins only' });
        const { allowPasswordLogin, allowKeyLogin, maxKeysPerUser, autoApproveSignup, signupRequireEmail, signupPasswordPolicy } = req.body;
        const s = await getSettings();
        if (typeof allowPasswordLogin === 'boolean') s.allowPasswordLogin = allowPasswordLogin;
        if (typeof allowKeyLogin === 'boolean') s.allowKeyLogin = allowKeyLogin;
        if (Number.isInteger(maxKeysPerUser) && maxKeysPerUser >= 1 && maxKeysPerUser <= 20) s.maxKeysPerUser = maxKeysPerUser;
        if (typeof autoApproveSignup === 'boolean') s.autoApproveSignup = autoApproveSignup;
        if (typeof signupRequireEmail === 'boolean') s.signupRequireEmail = signupRequireEmail;
        if (typeof signupPasswordPolicy === 'boolean') s.signupPasswordPolicy = signupPasswordPolicy;
        if (!s.allowPasswordLogin && !s.allowKeyLogin) return res.json({ success: false, message: 'At least one login method must stay enabled' });
        await s.save();
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});
// Sign up form reads these to know if email is required / policy on
app.get('/api/signup-settings', async (req, res) => {
    try {
        const s = await getSettings();
        res.json({ success: true, requireEmail: s.signupRequireEmail, passwordPolicy: s.signupPasswordPolicy, autoApprove: s.autoApproveSignup });
    } catch (e) { res.json({ success: false }); }
});

// (removed 2026-09-09) /api/guest-permissions + guest-public user —
// public boxes are now controlled by menu_config "zone: public" (see index.html generateMenu)

// --- 5. User Management APIs (สำหรับหน้า Admin) ---

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password -keys'); // ไม่ส่ง password ออกไป
        res.json(users);
    } catch (e) { res.status(500).json([]); }
});

// Admin สร้าง User เอง (กำหนดให้เป็น approved ทันที)
app.post('/api/create-user', async (req, res) => {
    try {
        const { username, password, group, groups, email, permissions } = req.body;
        const error = passwordPolicyError(password);
        if (error) return res.status(400).json({success:false,message:error});
        const exists = await User.findOne({ username });
        if (exists) return res.json({ success: false, message: 'User already exists' });

        let g = Array.isArray(groups) ? groups.slice() : (group ? [group] : []);
        g = withUserGroup('user', g);   // สร้างโดย admin = role user → อยู่ในกลุ่ม user เสมอ
        await User.create({
            username,
            password: hashPassword(password),
            email: (email || '').trim(),
            role: 'user',
            status: 'approved', // สร้างโดย Admin ให้ผ่านเลย
            groups: g,
            permissions: Array.isArray(permissions) ? permissions.filter(p => typeof p === "string") : []
        });
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

// อัปเดตข้อมูล User (เปลี่ยนสถานะ approved/pending/role/กลุ่ม/สิทธิ์)
app.post('/api/update-user', async (req, res) => {
    try {
        const { username, role, status, groups, permissions, email } = req.body;
        const updateData = {};
        if (role) updateData.role = role;
        if (status) updateData.status = status;
        if (groups) updateData.groups = groups;
        if (permissions) updateData.permissions = permissions;
        if (email !== undefined) updateData.email = String(email || '').trim();
        // role user → ต้องอยู่ในกลุ่ม "user" เสมอ (ใช้ role ที่กำลังจะเป็น ถ้าไม่ส่งมาใช้ของเดิม)
        const effRole = role || (await User.findOne({ username }, 'role') || {}).role;
        if (effRole === 'user') {
            const baseGroups = (updateData.groups !== undefined) ? updateData.groups : ((await User.findOne({ username }, 'groups') || {}).groups || []);
            updateData.groups = withUserGroup('user', baseGroups);
        }

        await User.findOneAndUpdate({ username }, updateData);
        res.json({ success: true });
    } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/admin-reset-password', async (req, res) => {
    try {
        const { targetUsername, newPassword } = req.body;
        const error = passwordPolicyError(newPassword);
        if (error) return res.status(400).json({success:false,message:error});
        await User.findOneAndUpdate({ username: targetUsername }, { $set:{password: hashPassword(newPassword)}, $inc:{authVersion:1} });
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

app.post('/api/delete-user', async (req, res) => {
    try {
        await User.findOneAndDelete({ username: req.body.username });
        res.json({ success: true });
    } catch (e) { res.json({ success: false }); }
});

// --- 6. Group Management APIs ---

app.get('/api/groups',async(req,res)=>res.json(await Group.find({})));
app.post('/api/create-group',async(req,res)=>{
    const name=String(req.body.name||'').trim();
    if(!name || await Group.findOne({name})) return res.status(400).json({success:false,message:'Group exists or invalid name'});
    await Group.create({name,permissions:Array.isArray(req.body.permissions)?req.body.permissions.filter(x=>typeof x==='string'):[]});
    res.json({success:true});
});
app.post('/api/update-group',async(req,res)=>{
    if(!Array.isArray(req.body.permissions)||req.body.permissions.some(x=>typeof x!=='string'))return res.status(400).json({success:false,message:'Invalid permissions'});
    await Group.findOneAndUpdate({name:req.body.name},{permissions:req.body.permissions});res.json({success:true});
});
app.post('/api/delete-group',async(req,res)=>{
    if(req.body.name==='user')return res.status(400).json({success:false,message:'The base user group cannot be deleted'});
    await Group.deleteOne({name:req.body.name});await User.updateMany({groups:req.body.name},{$pull:{groups:req.body.name}});
    res.json({success:true});
});

// Installation state is separate from the immutable application image.
const stateDir='/data';
const menuFile=stateDir+'/menu_config.js';
app.post('/api/save-menu-config',(req,res)=>{
    if(typeof req.body.code!=='string'||req.body.code.length>200000) return res.status(400).json({success:false,message:'Invalid menu code'});
    fs.writeFileSync(menuFile+'.tmp',req.body.code,{mode:0o644});fs.renameSync(menuFile+'.tmp',menuFile);
    res.json({success:true});
});
app.get('/api/get-nginx-config',(req,res)=>res.json({success:true,content:fs.readFileSync('/app/nginx.conf','utf8')}));
app.post('/api/save-nginx-config',(req,res)=>res.status(405).json({success:false,message:'Edit gateway/nginx.conf and rebuild gateway. Live proxy configuration writes are disabled.'}));
const Defaults=mongoose.model('Defaults',new mongoose.Schema({_id:String,value:mongoose.Schema.Types.Mixed}));
app.get('/api/wcc-defaults',async(req,res)=>res.json((await Defaults.findById('desktop'))?.value||{}));
app.post('/api/wcc-defaults',async(req,res)=>{
    if(!['admin','superadmin'].includes(req.session.user.role))return res.sendStatus(403);
    const value={dockVisibility:req.body.dockVisibility,proxDockThreshold:req.body.proxDockThreshold};
    await Defaults.findByIdAndUpdate('desktop',{value},{upsert:true});res.json({success:true});
});
app.get('/api/whoami', (req,res)=>{
    const u=req.session.user;res.set('X-User',u.id).set('X-User-Name',u.username).set('X-User-Role',u.role);
    res.json({userid:u.id,username:u.username,role:u.role,status:u.status});
});
app.get('/api/desktop-access',(req,res)=>{
    const u=req.session.user;
    if(!['admin','superadmin'].includes(u.role)&&!u.permissions.includes('wcc_desktop'))return res.sendStatus(403);
    res.sendStatus(200);
});
app.get('/api/admin-access',(req,res)=>res.sendStatus(['admin','superadmin'].includes(req.session.user.role)?200:403));
for(const route of ['/api/session','/api/user/session']) app.get(route,(req,res)=>res.json({authenticated:true,success:true,user:req.session.user}));
function logout(req,res){req.session.destroy(()=>{res.clearCookie('wcc_sid',{secure:true,httpOnly:true,sameSite:'lax'});res.json({success:true,authenticated:false});});}
for(const route of ['/api/session','/api/user/session']) app.delete(route,logout);
for(const route of ['/api/logout','/api/user/logout']) app.post(route,logout);
app.get('/healthz',(req,res)=>res.status(mongoose.connection.readyState===1?200:503).json({ready:mongoose.connection.readyState===1}));
app.use((err,req,res,next)=>{console.error('Request failed:',err.name);res.status(500).json({success:false,message:'Request failed'});});
async function main(){
    await mongoose.connect(mongoUrl);
    await ensureBaseUserGroup();
    const username=required('WCC_ADMIN_USER'), password=required('WCC_ADMIN_PASSWORD');
    if(!/^[A-Za-z0-9_.@-]{1,80}$/.test(username)) throw new Error('Invalid WCC_ADMIN_USER');
    const error=passwordPolicyError(password);if(error)throw new Error(error);
    if(!await User.findOne({username})) {
        await User.create({username,password:hashPassword(password),role:'superadmin',status:'approved',groups:[],permissions:[]});
        console.log('Initial administrator created; use the private installation .env credentials.');
    }
    fs.mkdirSync(stateDir,{recursive:true});
    if(!fs.existsSync(menuFile))fs.copyFileSync('/app/menu_config.js',menuFile);
    app.listen(3000,'0.0.0.0',()=>console.log('WCC authentication ready'));
}
main().catch(e=>{console.error('Startup failed:',e.name,e.message.replace(mongoUrl,'[database]'));process.exit(1);});
