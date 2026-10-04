#!/usr/bin/env bash

set -euo pipefail

: "${HTMX_VERSION:?HTMX_VERSION must be set}"
: "${MARKDOWN_IT_VERSION:?MARKDOWN_IT_VERSION must be set}"
: "${ALPINE_VERSION:?ALPINE_VERSION must be set}"
: "${INTER_VERSION:?INTER_VERSION must be set}"

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly ROOT_DIR
readonly VENDOR_DIR="${ROOT_DIR}/vendor"
readonly HTMX_RELEASE_URL="https://github.com/bigskysoftware/htmx/releases/download/v${HTMX_VERSION}/htmx-${HTMX_VERSION}-dist.zip"
readonly HTMX_LICENSE_URL="https://raw.githubusercontent.com/bigskysoftware/htmx/v${HTMX_VERSION}/LICENSE"
readonly MARKDOWN_IT_SOURCE_URL="https://github.com/markdown-it/markdown-it/archive/refs/tags/${MARKDOWN_IT_VERSION}.tar.gz"
readonly ALPINE_SOURCE_URL="https://github.com/alpinejs/alpine/archive/refs/tags/v${ALPINE_VERSION}.tar.gz"
readonly INTER_RELEASE_URL="https://github.com/rsms/inter/releases/download/v${INTER_VERSION}/Inter-${INTER_VERSION}.zip"

work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT INT TERM

mkdir -p "${VENDOR_DIR}/fonts" "${VENDOR_DIR}/licenses"

download() {
  local url="$1"
  local destination="$2"

  printf 'Downloading %s\n' "${url}"
  curl --fail --silent --show-error --location \
    "${url}" --output "${destination}"
}

extract_source() {
  local archive="$1"
  local destination="$2"

  mkdir "${destination}"
  tar -xzf "${archive}" --strip-components=1 -C "${destination}"
}

build_package() {
  local directory="$1"

  (
    cd "${directory}"
    npm ci --ignore-scripts --no-audit --no-fund
    npm run build
  )
}

publish() {
  local source="$1"
  local destination="$2"

  cp "${source}" "${destination}.tmp"
  mv "${destination}.tmp" "${destination}"
}

download "${HTMX_RELEASE_URL}" "${work_dir}/htmx.zip"
unzip -p "${work_dir}/htmx.zip" dist/htmx.min.js > "${work_dir}/htmx.min.js"
download "${HTMX_LICENSE_URL}" "${work_dir}/htmx.LICENSE"

# markdown-it and Alpine publish source tags but no prebuilt release assets.
download "${MARKDOWN_IT_SOURCE_URL}" "${work_dir}/markdown-it.tar.gz"
extract_source "${work_dir}/markdown-it.tar.gz" "${work_dir}/markdown-it"
build_package "${work_dir}/markdown-it"

download "${ALPINE_SOURCE_URL}" "${work_dir}/alpine.tar.gz"
extract_source "${work_dir}/alpine.tar.gz" "${work_dir}/alpine"
build_package "${work_dir}/alpine"

download "${INTER_RELEASE_URL}" "${work_dir}/inter.zip"
unzip -p "${work_dir}/inter.zip" web/InterVariable.woff2 \
  > "${work_dir}/InterVariable.woff2"
unzip -p "${work_dir}/inter.zip" web/InterVariable-Italic.woff2 \
  > "${work_dir}/InterVariable-Italic.woff2"
unzip -p "${work_dir}/inter.zip" LICENSE.txt > "${work_dir}/inter.LICENSE"

publish "${work_dir}/htmx.min.js" "${VENDOR_DIR}/htmx.min.js"
publish \
  "${work_dir}/markdown-it/dist/browser/markdown-it.umd.min.js" \
  "${VENDOR_DIR}/markdown-it.min.js"
publish \
  "${work_dir}/alpine/packages/alpinejs/dist/cdn.min.js" \
  "${VENDOR_DIR}/alpine.min.js"
publish \
  "${work_dir}/InterVariable.woff2" \
  "${VENDOR_DIR}/fonts/InterVariable.woff2"
publish \
  "${work_dir}/InterVariable-Italic.woff2" \
  "${VENDOR_DIR}/fonts/InterVariable-Italic.woff2"
publish "${work_dir}/htmx.LICENSE" "${VENDOR_DIR}/licenses/htmx.txt"
publish \
  "${work_dir}/markdown-it/LICENSE" \
  "${VENDOR_DIR}/licenses/markdown-it.txt"
publish "${work_dir}/alpine/LICENSE.md" "${VENDOR_DIR}/licenses/alpine.txt"
publish "${work_dir}/inter.LICENSE" "${VENDOR_DIR}/licenses/inter.txt"

printf 'Vendored dependencies into %s\n' "${VENDOR_DIR}"
