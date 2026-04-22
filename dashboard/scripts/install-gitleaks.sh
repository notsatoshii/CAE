#!/usr/bin/env bash
# install-gitleaks.sh — idempotent gitleaks installer for CAE dev environments.
# Pins to 8.18.4 for reproducibility. Override with: GITLEAKS_VERSION=X.Y.Z bash install-gitleaks.sh
set -euo pipefail

GITLEAKS_VERSION="${GITLEAKS_VERSION:-8.18.4}"

if command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks already present: $(gitleaks version)"
  exit 0
fi

echo "Installing gitleaks v${GITLEAKS_VERSION}…"

if command -v brew >/dev/null 2>&1; then
  brew install gitleaks
else
  # Direct binary install fallback for Linux CI and dev boxes without Homebrew.
  # T-14-01-01: prefer Homebrew (signed); fall back to pinned HTTPS GitHub release.
  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT

  ARCH=$(uname -m)
  # GitHub release names use x64 not x86_64
  [[ "$ARCH" == "x86_64" ]] && ARCH=x64
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')

  TARBALL="gitleaks_${GITLEAKS_VERSION}_${OS}_${ARCH}.tar.gz"
  URL="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${TARBALL}"

  echo "Downloading ${URL}"
  curl -sSfL "$URL" | tar -xz -C "$TMP"

  sudo install -m 0755 "$TMP/gitleaks" /usr/local/bin/gitleaks
fi

echo "gitleaks $(gitleaks version) installed"
