# Initial release validation — 2026-10-24

Test target: a separate Ubuntu 22.04 x86_64 Docker host. Previous experimental containers and Docker volumes were removed before installation. Production services were left running without source or configuration changes.

Build: Docker Engine 27.5.1 / Compose 5.6.1; source-built Gateway, Auth and Desktop plus MongoDB 7.0. The upstream Webtop base is pinned by manifest digest in desktop/Dockerfile. A read-only export of that upstream base was loaded as a cache to avoid a slow registry pull; WCC production images and runtime volumes were never copied into the installation.

| Check | Result |
|---|---|
| Setup creates .env mode 0600 and refuses overwrite | Passed |
| Salted scrypt verification, wrong/malformed/plaintext rejection | Passed |
| Auth source and 19 inline frontend scripts parse | Passed |
| npm audit --omit=dev for locked Auth dependencies | 0 reported vulnerabilities at validation time |
| Compose configuration and source builds | Passed |
| HTTPS integration suite scripts/smoke.py | 33 checks passed |
| Anonymous Desktop/FileBrowser/Jupyter denial | Passed; relative login redirects preserve the external port |
| Normal-user denial from Admin UI and APIs | Passed |
| Blocked account and password change revoke existing session | Passed |
| Desktop browser streaming | Live WebSocket messages and visible XFCE desktop |
| WCC Dock FileBrowser/Jupyter/System Config navigation | Passed |
| Jupyter Python kernel over WebSocket | Executed print(1 + 1), received 2; temporary kernel deleted |
| P-256 key login with browser WebCrypto | Passed; replayed challenge rejected; temporary key deleted |
| Browser JavaScript errors | None observed in the exercised flow |
| 390px browser viewport | Exercised Dock/settings; root viewport containment passed |
| Full stack force-recreate with existing volumes | Session, menu and TLS certificate preserved |
| Persistent Desktop file | Written through Jupyter; survives recreation; same file read through FileBrowser using its normal noauth JWT exchange |
| URL path containing spaces | Jupyter write and FileBrowser read passed |
| Temporary users, login key, kernel and proof file | Removed after verification |
| Source exclusion/secret scan | No runtime .env, databases, node_modules, SSH/TLS keys, GitHub token or production instance identifiers staged |

The test used a generated installation certificate with browser/CLI verification bypass specifically for that local certificate. Deployments with public users should install a trusted certificate as described in README. The Desktop is shared, not a per-account sandbox. These checks cover the packaged flows; they are not a security certification or an exhaustive upstream application test.
