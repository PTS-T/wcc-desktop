Look & feel of the WCC Dock apps (baked into the image at /opt/wcc-apps/) — dark, same palette as Agent Chat's dark theme
(bg #0a0a0c · surface #141417 · line #2a2a30 · text #f2f2f4 · accent #f97316).
- filebrowser/custom.css   FileBrowser branding css (theme dark + --branding.files /opt/wcc-apps/filebrowser, set by custom-cont-init.d/40-wcc-apps.sh)
- jupyter/overrides.json   JupyterLab defaults: "JupyterLab Dark" theme, no news pop-up (→ /opt/jupyter/share/jupyter/lab/settings/)
- jupyter/custom.css       JupyterLab custom css (copied to /config/.jupyter/custom/ per boot; LabApp.custom_css=True)
