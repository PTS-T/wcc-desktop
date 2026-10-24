# WCC Desktop — Web Containers Chain

WCC คือเว็บทางเข้ากลางสำหรับนำหลาย container มาใช้งานร่วมกันผ่านเบราว์เซอร์ ด้วยบัญชีและ session เดียว ชุดนี้แยกเฉพาะ **WCC + Desktop รุ่นใหม่** ออกจาก WCC Platform เพื่อให้ติดตั้งบนเครื่องใหม่ได้โดยไม่ต้องนำระบบ Agent ทั้งชุดมาด้วย

Desktop ใช้ XFCE + Selkies พร้อม Brave, FileBrowser, JupyterLab และ WCC Dock สำหรับสลับแอป ไม่ต้องลงโปรแกรม remote desktop ที่เครื่องผู้ใช้

## แนวคิดการออกแบบ

```text
Browser ── HTTPS ──► WCC Gateway (Nginx)
                       │
                       ├── WCC UI: login / menu / account / admin
                       ├── auth_request ──► Auth service (Node.js)
                       │                         └── MongoDB: users, groups, settings, sessions
                       │
                       └── /mawcc/desktop/ ──► Shared Desktop container
                                                ├── XFCE + Brave / Selkies WebSocket
                                                ├── WCC shell + Dock
                                                ├── FileBrowser (localhost:8085)
                                                └── JupyterLab (localhost:8888)
```

คำว่า Chain ในชุดนี้หมายถึงการต่อเส้นทางจาก gateway → การตรวจบัญชีและสิทธิ์ → แอปใน container ภายใต้ origin เดียว ไม่ใช่ blockchain และไม่ต้องเปิด port ของทุกแอปออกมาภายนอก

- **Gateway เป็นประตูเดียว:** เปิดเฉพาะ HTTP/HTTPS; HTTP ส่งต่อไป HTTPS ส่วน Auth, MongoDB, SSH และพอร์ตต้นทางของ Desktop อยู่ในเครือข่าย Docker
- **แยกหน้าจอกับสิทธิ์จริง:** menu กำหนดหน้าตา/การแสดงปุ่ม ส่วน gateway และ Auth ตรวจสิทธิ์ฝั่ง server ก่อนเข้า Desktop และ Admin APIs แม้เรียก URL โดยตรง
- **Session คงอยู่หลัง restart:** cookie เป็น Secure/HttpOnly/SameSite=Lax; session เก็บใน MongoDB และอ่าน role/status ปัจจุบันทุกครั้ง บัญชีที่ถูก block จึงเข้า Desktop ต่อไม่ได้ และการเปลี่ยน/reset รหัสผ่านเพิกถอน session เดิม
- **ข้อมูลแยกจาก image:** อัปเดตหรือสร้าง container ใหม่แล้วข้อมูลผู้ใช้และ Desktop home ยังอยู่ใน named volumes
- **เพิ่มแอปเป็นโมดูล:** เพิ่ม service ใน Compose, route ที่มี `auth_request` ใน gateway และปุ่มใน WCC Backend โดยไม่ต้องแก้ Desktop ทั้งตัว

### ขอบเขตของรุ่นนี้

มี Gateway, Auth, MongoDB และ **Desktop กลางหนึ่งเครื่อง** ผู้ใช้ที่ได้รับสิทธิ์ Desktop ใช้หน้าจอ ไฟล์ และ browser profile ร่วมกัน จึงเหมาะกับกลุ่มที่ไว้ใจกัน บัญชี WCC แยกกันไม่ได้แปลว่ามี Desktop หรือ filesystem ส่วนตัวแยกกัน

ไม่ได้รวม Agent Chat, CLI Agent runtime, Main Brain, Kanboard, ระบบชำระเงิน และ workflow/AI integrations ของ WCC Platform ปุ่มและ proxy ของบริการเหล่านั้นไม่อยู่ในค่าเริ่มต้นนี้

repo เดิมเป็นตัวอย่างแนวคิด gateway + auth + Mongo + หลาย webtop: [PTS-style/wcc_desktop](https://github.com/PTS-style/wcc_desktop/tree/26-1-2026_15user) รุ่นนี้ใช้ WCC UI และ Desktop ใหม่ โดยเริ่มจาก Desktop กลางหนึ่งเครื่อง การเพิ่มหลาย Desktop ต้องเพิ่ม route และการตรวจสิทธิ์แยกด้วย ไม่ใช่แค่เพิ่มปุ่มใน menu

## ติดตั้ง

เป้าหมายที่ใช้ทดสอบคือ Linux x86_64, Docker Engine และ Docker Compose plugin (`docker compose`) ใช้ Python 3 สำหรับสร้าง `.env` เผื่อ RAM สำหรับ Desktop/browser และพื้นที่ image หลาย GB การ build ครั้งแรกต้องใช้อินเทอร์เน็ต

```bash
git clone https://github.com/PTS-T/wcc-desktop.git
cd wcc-desktop
python3 scripts/setup.py
docker compose up -d --build
docker compose ps
```

เปิด `https://<IP-หรือ-domain>/` ลงชื่อเข้าใช้ด้วย `WCC_ADMIN_USER` และ `WCC_ADMIN_PASSWORD` ใน `.env` บนเครื่องติดตั้ง ไฟล์นี้ถูกสร้างด้วย permission `0600` และถูก ignore จาก Git ไม่มีรหัสผ่านตั้งต้นร่วมกัน และไม่มี login key จากเครื่องผู้พัฒนาติดมาด้วย

ครั้งแรกใช้ certificate ที่สร้างใหม่เฉพาะ installation เบราว์เซอร์จะแจ้งว่าไม่เชื่อถือ ให้ใช้ certificate ที่ browser เชื่อถือเมื่อให้บริการจริง Key-file login ใช้ WebCrypto จึงต้องเปิดผ่าน HTTPS

เปลี่ยน port ตั้งแต่สร้างค่าเริ่มต้นได้:

```bash
python3 scripts/setup.py --admin-user owner --http-port 6688 --https-port 6443
```

คำสั่ง setup จะไม่เขียนทับ `.env` ที่มีอยู่ หากต้องการแก้ port ให้แก้ `.env` แล้วสั่ง `docker compose up -d` อย่าเปลี่ยน `MONGO_PASSWORD` หลัง MongoDB ถูกสร้างแล้วโดยไม่เปลี่ยนรหัสในฐานข้อมูลด้วย ค่า admin ใน `.env` ใช้สร้างบัญชีเมื่อยังไม่มีบัญชีชื่อนั้นเท่านั้น การเปลี่ยนรหัสหลังติดตั้งให้ใช้ User Panel หรือ Admin Panel

### Login ด้วย Initial Key

ใน `keys/initial-admin.wcc-key.json` มี Initial Key แบบเข้ารหัสสำหรับเครื่องทดลองที่ผู้ดูแลลงทะเบียนไว้ ดาวน์โหลดไฟล์ JSON → เปิดหน้า HTTPS Login → **Choose Key File** → ใส่ **KEY PASSPHRASE** ที่ได้รับแยกต่างหาก → **Connect** ช่อง Username/Password เว้นว่างได้

รหัสปลดล็อกไม่อยู่ใน Git และ browser ถอดรหัสในเครื่องก่อนลงชื่อ challenge ดูขั้นตอนใช้งาน/สร้าง key ของตัวเอง/เพิกถอนที่ [keys/README.md](keys/README.md) การติดตั้งใหม่ยังใช้บัญชีที่สร้างจาก `.env` ของตนเอง และไม่ได้ import key ทดลองนี้โดยอัตโนมัติ

### HTTPS certificate ที่เชื่อถือ

นำ certificate และ private key ของโดเมนมาแทนไฟล์ใน TLS volume แล้ว restart gateway เช่น:

```bash
docker compose cp /path/to/fullchain.pem gateway:/etc/wcc/tls/server.crt
docker compose cp /path/to/privkey.pem gateway:/etc/wcc/tls/server.key
docker compose exec gateway chmod 600 /etc/wcc/tls/server.key
docker compose restart gateway
```

หากใช้ reverse proxy ด้านหน้า ต้องส่งต่อ WebSocket และ cookie โดยใช้ HTTPS ปลายทาง ตั้ง public `HTTPS_PORT` ให้ตรง port ที่ browser ใช้งาน

## วิธีใช้งาน

1. Login → **Desktop** เพื่อเปิด XFCE
2. เปิด WCC Dock ที่มุมขวาบนเพื่อสลับ **Desktop / FileBrowser / Jupyter / System Config**
3. FileBrowser และ Jupyter เริ่มที่ `/config/Desktop` ซึ่งตรงกับโฟลเดอร์ Desktop ของผู้ใช้ `abc` ใน container
4. **User Panel** ใช้เปลี่ยนรหัสผ่านและสร้าง/ดาวน์โหลด/ลบ login-key ของบัญชีตัวเอง
5. **Admin Panel** ใช้สร้างผู้ใช้ อนุมัติ/บล็อกบัญชี และจัดการกลุ่ม/permission
6. **WCC Backend** ใช้จัดเมนู ส่วน nginx config ให้อัปเดตผ่าน source แล้ว rebuild gateway

ผู้สมัครใหม่อยู่สถานะ pending จน admin อนุมัติ กลุ่มพื้นฐาน `user` มี permission `wcc_desktop` ตั้งแต่ติดตั้ง ผู้ดูแลแก้ permission นี้ได้ตามนโยบาย ไม่ควรอนุมัติคนที่ไม่ควรใช้ Desktop กลาง

FileBrowser/Jupyter ใช้การยืนยันตัวตนของ WCC ที่อยู่ด้านหน้า จึงไม่ได้ขอรหัสซ้ำ **อย่าเพิ่ม ports เพื่อเปิด 3000/8085/8888/22/27017 ออกภายนอก** และอย่า mount Docker socket หรือโฟลเดอร์สำคัญของ host เข้า Desktop โดยไม่มีเหตุจำเป็น

Login-key เป็น credential ส่วนบุคคล ฐานข้อมูลเก็บไฟล์ key เพื่อให้ผู้ใช้ดาวน์โหลดซ้ำได้ ดังนั้นฐานข้อมูลและ backup ต้องได้รับการป้องกันเหมือน secret ส่วนรหัสผ่านเก็บด้วย scrypt พร้อม random salt ไม่เก็บ plaintext

การแก้ menu ผ่าน WCC Backend เป็นสิทธิ์ของ admin ที่ไว้ใจได้ เพราะ menu เป็น JavaScript ที่ browser ใช้งาน การซ่อนปุ่มอย่างเดียวไม่ใช่การตั้ง access control ให้แอปใหม่

## โครงสร้าง repo และข้อมูลถาวร

```text
compose.yaml                 # 4 services; publish เฉพาะ gateway
.env.example                 # ชื่อตัวแปร ไม่มี secret
wcc/auth/                    # Node.js account/session/key/group APIs
wcc/web/                     # WCC frontend
gateway/                     # HTTPS, routes, auth_request, WebSocket
desktop/                     # Desktop image, startup services, WCC shell
scripts/setup.py             # สร้าง secret ต่อ installation
scripts/smoke.py             # ตรวจ end-to-end หลังติดตั้ง
NOTICE.md                    # ที่มาและ third-party software
```

| Volume | ข้อมูล |
|---|---|
| `mongo-data` | ผู้ใช้ กลุ่ม settings login-key และ session |
| `wcc-state` | menu ที่แก้ผ่าน WCC Backend |
| `desktop-home` | `/config`: Desktop files, browser profile, Jupyter settings |
| `desktop-secret` | SSH credential ภายใน installation |
| `gateway-tls` | certificate และ private key เฉพาะเครื่อง |

ไม่ mount workspace ของ Agent หรือข้อมูล production มาในชุดนี้ Desktop และ Auth build จาก Dockerfile ใน repo; Dockerfile ของ Desktop ต่อยอด LinuxServer Webtop ที่ระบุ base image digest และติดตั้ง Brave/FileBrowser/Jupyter จาก upstream ขณะ build บาง dependency เป็น rolling upstream จึงไม่ใช่ bit-for-bit reproducible build ควรบันทึก image digest ของรุ่นที่ใช้งานจริง

## ตรวจสอบ อัปเดต และสำรองข้อมูล

```bash
# สำหรับ certificate ที่เชื่อถือแล้ว
python3 scripts/smoke.py --url https://your-domain
# เฉพาะเครื่องทดสอบที่ใช้ certificate สร้างเอง
python3 scripts/smoke.py --url https://127.0.0.1 --insecure

docker compose logs --tail 100 auth gateway desktop
# อัปเดต source และ rebuild โดยคง named volumes
git pull --ff-only
docker compose up -d --build
```

smoke test อ่าน admin credential จาก `.env` โดยไม่พิมพ์ค่า ทดสอบ auth boundary, account roles, key login APIs, Desktop/FileBrowser/Jupyter และสร้างผู้ใช้ชั่วคราวที่ลบเมื่อจบ

ก่อน upgrade ให้หยุด stack (`docker compose stop`) และสำรอง named volumes **ทั้งห้า** พร้อม `.env` ด้วยเครื่องมือ backup ของ Docker/host แล้วค่อย `docker compose start` การ restore ต้องนำข้อมูลและ `.env` ที่ตรงกันกลับมาด้วย อย่านำ backup ขึ้น Git หรือ Wall

`docker compose down` คงข้อมูลไว้ แต่ `docker compose down -v` **ลบข้อมูลทั้งหมดของชุดนี้** ใช้เฉพาะเมื่อต้องการ reset installation จริง

### ปัญหาที่พบบ่อย

- เข้าไม่ได้: ตรวจ `docker compose ps` และ log; build Desktop ครั้งแรกอาจใช้เวลาหลายนาที
- login แล้ว Desktop 403: ตรวจสถานะ approved และ permission `wcc_desktop` ของบัญชี/กลุ่ม
- หน้าจอดำหรือ reconnect: ตรวจ WebSocket ผ่าน reverse proxy และ log Desktop; browser/GPU policy อาจต่างกันในแต่ละเครื่อง
- เปลี่ยนรหัส Mongo ใน `.env` แล้ว auth ไม่ขึ้น: initial root password ของ Mongo ไม่เปลี่ยนตาม `.env` เมื่อมี volume เดิม
- แก้ nginx config: `docker compose up -d --build gateway`; ไม่เปิด live config write API

## ผลทดสอบรุ่นเริ่มต้น

ผ่านการ build และติดตั้งใหม่บน Linux x86_64, HTTP/HTTPS และ 33 integration checks รวมถึง browser จริง: Desktop streaming, FileBrowser, JupyterLab, Python kernel ผ่าน WebSocket, key login และการปฏิเสธ challenge ที่ใช้แล้ว ทดสอบ recreate ทั้ง stack แล้ว session, menu, TLS certificate และไฟล์ Desktop ยังอยู่ รายละเอียดอยู่ใน [docs/validation.md](docs/validation.md)

## ที่มาและ license

ดู [NOTICE.md](NOTICE.md) สำหรับซอฟต์แวร์ต้นทางและ license ของ dependency เจ้าของยังไม่ได้เลือก license สำหรับ WCC-specific source การเปิด repo เป็น public ครั้งนี้ไม่ได้เพิ่ม license grant ใหม่โดยอัตโนมัติ
