#!/bin/bash
# JupyterLab in its own venv (/opt/jupyter — the system Python is PEP 668 managed). Served by the desktop's nginx at
# <SUBFOLDER>jupyter/ and run as abc by custom-services.d/jupyter.
set -e
python3 -m venv /opt/jupyter
/opt/jupyter/bin/pip install -q --no-cache-dir --upgrade pip
/opt/jupyter/bin/pip install -q --no-cache-dir jupyterlab ipykernel
echo "[install] jupyterlab $(/opt/jupyter/bin/jupyter lab --version)"
