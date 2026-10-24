# Initial Key

`initial-admin.wcc-key.json` is the encrypted Initial Key registered on the maintainer's test installation. Its unlock passphrase is delivered separately to the installation owner. It grants no access without that passphrase.

## Login without typing a password

Use your personal unencrypted `.key` file: **Choose Key File** → select the file → **Connect with Key**. Username, password and key-passphrase inputs hide automatically. On the maintainer's test installation, the owner receives `initial-admin.key` through the project Wall; it is not published in this public repository.

The login page identifies encrypted files and explains how to choose the personal `.key` instead. It only displays the passphrase input after explicitly choosing **ใช้ไฟล์เข้ารหัสพร้อมรหัสปลดล็อก**. An encrypted JSON cannot be used without its unlock phrase.

A personal `.key` grants access to its account. Keep it private; download your own key from **User Panel**, and revoke it there if it is lost.

## Optional encrypted-file login

1. Download the JSON file with GitHub's **Download raw file** action.
2. Open the installation's HTTPS login page and choose **Choose Key File**.
3. Select the downloaded JSON. Choose **ใช้ไฟล์เข้ารหัสพร้อมรหัสปลดล็อก** to show and focus **KEY PASSPHRASE**. Enter its separate unlock phrase and press **Unlock & Connect**. Reselecting the file keeps a phrase already entered.
4. Once signed in, use **User Panel** to create your own replacement key. After verifying the replacement works, delete **Initial Key** from User Panel to revoke it.

Use **ใช้ชื่อผู้ใช้ / รหัสผ่าน** to clear the selected key and return to password login.

The browser decrypts the key locally and signs a short-lived one-time challenge. The passphrase and decrypted private key are not sent to the server. Legacy unencrypted `.key` files continue to work.

The file in this directory is not automatically imported into fresh installations. A new installation creates its own administrator from its private `.env`; log in with that password and create your own key through User Panel.

## Export another key with encryption

With Node.js22 available, keep the plaintext key and passphrase file outside the repository, then run:

```bash
WCC_KEY_PASSPHRASE_FILE=/private/unlock.txt node scripts/encrypt-key.cjs /private/user.key keys/user.wcc-key.json
```

Only the encrypted JSON may be committed. Encryption is AES-256-GCM with a random96-bit IV and PBKDF2-HMAC-SHA256 (600,000 iterations, random128-bit salt). Keep a strong, separate passphrase; the exporter requires at least16 characters. Deleting a key in User Panel revokes it independently of any Git copy, and it is not reimported on restart.
