#!/bin/sh
set -eu

# A named volume survives image rebuilds. Refresh it when the manifests change.
dependency_hash=$(sha256sum package.json package-lock.json | sha256sum | cut -d ' ' -f 1)
installed_hash=$(cat node_modules/.amootech-dependencies 2>/dev/null || true)
if [ "$dependency_hash" != "$installed_hash" ] || [ ! -x node_modules/.bin/next ]; then
    if [ ! -w node_modules ]; then
        echo "node_modules is not writable by $(id -un); repair the dependency volume ownership before starting frontend." >&2
        exit 1
    fi
    npm ci --no-audit --no-fund
    printf '%s\n' "$dependency_hash" > node_modules/.amootech-dependencies
fi

exec "$@"
