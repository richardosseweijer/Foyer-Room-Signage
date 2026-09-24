#!/usr/bin/env bash
# Preflight for install-host-units.sh (sourced). Safe to source from tests.
# Verifies the Node/npm the systemd unit will see, and that a production build exists.
#
# Unit contract (deploy/foyer.service + deploy/foyer-panel.service):
#   Environment=PATH=/usr/bin:/usr/local/bin
#   ExecStart=/usr/bin/npm start   /   ExecStart=/usr/bin/npm run start:panel
# foyer-kiosk.service does not run Node; PATH still matches the Node units above.
#
# Override for tests: FOYER_UNIT_PATH, FOYER_PREFLIGHT_NPM, FOYER_PREFLIGHT_BUILD_MARKER

# PATH the foyer.service / foyer-panel.service units use (must match deploy/*.service Environment=PATH=).
FOYER_UNIT_PATH_DEFAULT="/usr/bin:/usr/local/bin"

# Build artifact produced by `npm run build` (vite vercel/nitro preset).
FOYER_BUILD_MARKER_DEFAULT=".vercel/output/nitro.json"

foyer_preflight_die() {
  echo "install-host-units: preflight failed: $*" >&2
  return 1
}

# Print major version number from `node -v` / `v22.19.0` → 22. Empty on failure.
foyer_node_major() {
  local ver major
  ver="$1"
  major="$(printf '%s' "${ver}" | sed -n 's/^v*\([0-9][0-9]*\).*/\1/p')"
  printf '%s' "${major}"
}

# Args: (none) — uses FOYER_UNIT_PATH / FOYER_PREFLIGHT_NPM
foyer_preflight_node_npm() {
  local unit_path npm_bin node_bin node_ver major
  unit_path="${FOYER_UNIT_PATH:-${FOYER_UNIT_PATH_DEFAULT}}"

  npm_bin="${FOYER_PREFLIGHT_NPM:-/usr/bin/npm}"
  if [ ! -x "${npm_bin}" ]; then
    foyer_preflight_die "missing ${npm_bin} (ExecStart in deploy/foyer.service / foyer-panel.service). Install Node 22 via NodeSource — INSTALL.md §2. nvm under ~/.nvm is invisible to the unit PATH (${unit_path})."
    return 1
  fi

  # Resolve node the same way the unit will (PATH=unit path only).
  # shellcheck disable=SC2086
  node_bin="$(PATH="${unit_path}" command -v node 2>/dev/null || true)"
  if [ -z "${node_bin}" ] || [ ! -x "${node_bin}" ]; then
    foyer_preflight_die "no node on unit PATH=${unit_path}. Install Node 22 via NodeSource — INSTALL.md §2. nvm (~/.nvm) is not on that PATH; enabling foyer.service would crash-loop."
    return 1
  fi

  node_ver="$("${node_bin}" -v 2>/dev/null || true)"
  major="$(foyer_node_major "${node_ver}")"
  if [ -z "${major}" ] || [ "${major}" -lt 22 ]; then
    foyer_preflight_die "Node under unit PATH is ${node_ver:-unknown} (${node_bin}); need major >= 22. systemd Environment=PATH=${unit_path} — nvm (~/.nvm) is invisible to the unit. Install Node 22 via NodeSource (INSTALL.md §2), then re-run. Enabling now would crash-loop foyer.service."
    return 1
  fi

  if ! PATH="${unit_path}" command -v npm >/dev/null 2>&1; then
    foyer_preflight_die "npm not found on unit PATH=${unit_path} (ExecStart=/usr/bin/npm). Install Node 22 via NodeSource — INSTALL.md §2."
    return 1
  fi

  echo "install-host-units: preflight OK — node ${node_ver} (${node_bin}), npm ${npm_bin}"
  return 0
}

# Args: repo_root
# Env: FOYER_PREFLIGHT_BUILD_MARKER (relative to repo_root or absolute)
foyer_preflight_build() {
  local repo_root marker path
  repo_root="$1"
  marker="${FOYER_PREFLIGHT_BUILD_MARKER:-${FOYER_BUILD_MARKER_DEFAULT}}"
  case "${marker}" in
    /*) path="${marker}" ;;
    *) path="${repo_root}/${marker}" ;;
  esac
  if [ ! -f "${path}" ]; then
    foyer_preflight_die "missing build output (${path}). Run: npm ci --include=dev && npm run build (INSTALL.md §4), then re-run. Enabling now would crash-loop foyer.service."
    return 1
  fi
  echo "install-host-units: preflight OK — build present (${path})"
  return 0
}

# Args: repo_root
foyer_preflight_all() {
  local repo_root="$1"
  foyer_preflight_node_npm || return 1
  foyer_preflight_build "${repo_root}" || return 1
  return 0
}
