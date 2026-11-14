#!/usr/bin/env bash
# Instala Docker Engine + Docker Compose (repositório oficial da Docker) no Fedora.
# Uso: bash scripts/instalar-docker-fedora.sh
set -euo pipefail

sudo dnf -y install dnf-plugins-core
sudo dnf config-manager addrepo --overwrite --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Inicia agora e a cada boot
sudo systemctl enable --now docker

# Permite usar "docker" sem sudo (vale a partir do próximo login ou de "newgrp docker")
sudo usermod -aG docker "$USER"

sudo docker version --format 'Docker {{.Server.Version}}'
sudo docker compose version
echo "Pronto. Faça logout/login (ou rode 'newgrp docker') para usar docker sem sudo."
