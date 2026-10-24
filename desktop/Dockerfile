# WCC Desktop — sandbox desktop for users + agents (XFCE + Selkies streaming), one shared machine for now.
# Base: linuxserver/webtop (Selkies 2 + nginx :3000, SUBFOLDER=/desktop/). Apps are baked in here so a
# recreate starts in seconds; the per-boot bits (SSH login, launchers) live in custom-cont-init.d/.
# Add more services the same way as multi-agent_kung/wcc: an install_<name>.sh + a RUN line below.
FROM lscr.io/linuxserver/webtop:ubuntu-xfce@sha256:278797c03b62454aaf05cd1fdeb35dbdc822846855020f9e5233f508a89980d9

COPY install_brave.sh install_sshd.sh /tmp/wcc-install/
RUN bash /tmp/wcc-install/install_brave.sh \
 && bash /tmp/wcc-install/install_sshd.sh \
 && rm -rf /tmp/wcc-install /var/lib/apt/lists/*

# WCC Dock apps served from the desktop itself: <SUBFOLDER>filebrowser/ · <SUBFOLDER>jupyter/ (own layer → cached separately)
COPY install_filebrowser.sh install_jupyter.sh /tmp/wcc-install/
RUN bash /tmp/wcc-install/install_filebrowser.sh \
 && bash /tmp/wcc-install/install_jupyter.sh \
 && rm -rf /tmp/wcc-install /root/.cache

# Look & feel of the Dock apps (Agent Chat dark): FileBrowser css · JupyterLab default theme + css — see apps/README.md
COPY apps/ /opt/wcc-apps/
RUN install -D -m 644 /opt/wcc-apps/jupyter/overrides.json /opt/jupyter/share/jupyter/lab/settings/overrides.json

LABEL org.wcc.component="wcc-desktop"

COPY custom-cont-init.d/ /custom-cont-init.d/
COPY custom-services.d/ /custom-services.d/
COPY web_proxy_nginx/ /usr/share/selkies/wcc-shell/
RUN chmod +x /custom-cont-init.d/* /custom-services.d/*
