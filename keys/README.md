# Initial Key

`initial-admin.wcc-key.json` is the encrypted Initial Key registered on the maintainer's test installation. Its unlock passphrase is delivered separately to the installation owner. It grants no access without that passphrase.

## Login

1. Download the JSON file with GitHub's **Download raw file** action.
2. Open the installation's HTTPS login page and choose **Choose Key File**.
3. Select the downloaded JSON, enter its separate **KEY PASSPHRASE**, and press **Connect**. Username/password fields may remain empty.
4. Once signed in, use **User Panel** to create your own replacement key. After verifying the replacement works, delete **Initial Key** from User Panel to revoke it.

The browser decrypts the key locally and signs a short-lived one-time challenge. The passphrase and decrypted private key are not sent to the server. Legacy unencrypted `.key` files continue to work.

The file in this directory is not automatically imported into fresh installations. A new installation creates its own administrator from its private `.env`; log in with that password and create your own key through User Panel.

## Export another key with encryption

With Node.js22 available, keep the plaintext key and passphrase file outside the repository, then run:

```bash
WCC_KEY_PASSPHRASE_FILE=/private/unlock.txt node scripts/encrypt-key.cjs /private/user.key keys/user.wcc-key.json
```

Only the encrypted JSON may be committed. Encryption is AES-256-GCM with a random96-bit IV and PBKDF2-HMAC-SHA256 (600,000 iterations, random128-bit salt). Keep a strong, separate passphrase; the exporter requires at least16 characters. Deleting a key in User Panel revokes it independently of any Git copy, and it is not reimported on restart.
