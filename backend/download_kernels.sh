#!/usr/bin/env bash
set -euo pipefail

KERNEL_DIR="$(dirname "$0")/kernels"
mkdir -p "$KERNEL_DIR"

BASE="https://naif.jpl.nasa.gov/pub/naif/generic_kernels"

download() {
    local url="$1"
    local dest="$KERNEL_DIR/$(basename "$url")"
    if [[ -f "$dest" ]]; then
        echo "Already exists: $(basename "$url")"
    else
        echo "Downloading: $(basename "$url")"
        curl -L --progress-bar -o "$dest" "$url"
    fi
}

download "$BASE/lsk/naif0012.tls"
download "$BASE/spk/planets/de440s.bsp"
download "$BASE/pck/pck00011.tpc"
download "$BASE/fk/satellites/moon_de440_250416.tf"
download "$BASE/pck/moon_pa_de440_200625.bpc"

echo "All kernels ready in $KERNEL_DIR"
