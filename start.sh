#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
mkdir -p .run logs

printf 'Building production frontend bundle...\n'
pnpm --filter @workspace/wa-bot-studio run build

port_3000_pids() {
  {
    if command -v lsof >/dev/null 2>&1; then
      lsof -nP -tiTCP:3000 -sTCP:LISTEN 2>/dev/null || true
    fi
    if command -v fuser >/dev/null 2>&1; then
      fuser -n tcp 3000 2>/dev/null | sed 's/^[^:]*://' | tr ' ' '\n' | grep -E '^[0-9]+$' || true
    fi
    # Termux may restrict /proc/net access for fuser/lsof. Also find this
    # workspace's API process directly so stale instances started here stop.
    pgrep -f '[n]ode .*dist/index\.mjs' 2>/dev/null || true
    pgrep -f '[p]npm --filter @workspace/api-server run (dev|start)' 2>/dev/null || true
  } | awk '/^[0-9]+$/ && !seen[$0]++'
}

clear_port_3000() {

  local -a pids=()
  mapfile -t pids < <(port_3000_pids)
  if ((${#pids[@]} == 0)); then
    printf 'Port 3000 is already free.\n'
  else
    printf 'Stopping process(es) on port 3000: %s\n' "${pids[*]}"
    kill -TERM "${pids[@]}" 2>/dev/null || true

    for _ in {1..10}; do
      sleep 0.3
      mapfile -t pids < <(port_3000_pids)
      ((${#pids[@]} == 0)) && break
    done

    if ((${#pids[@]} > 0)); then
      printf 'Force-killing process(es) still using port 3000: %s\n' "${pids[*]}"
      kill -KILL "${pids[@]}" 2>/dev/null || true
      sleep 0.3
      mapfile -t pids < <(port_3000_pids)
    fi

    if ((${#pids[@]} > 0)); then
      printf 'Error: unable to clear port 3000; remaining PID(s): %s\n' "${pids[*]}" >&2
      return 1
    fi
    printf 'Port 3000 is clear.\n'
  fi

  rm -f "$ROOT_DIR/.run/api.pid"
}

start_service() {
  local name="$1" pid_file="$2" log_file="$3"
  shift 3

  if [[ -f "$pid_file" ]]; then
    local old_pid
    old_pid="$(cat "$pid_file")"
    if [[ "$old_pid" =~ ^[0-9]+$ ]] && kill -0 "$old_pid" 2>/dev/null; then
      printf '%s already running (PID %s)\n' "$name" "$old_pid"
      return
    fi
    rm -f "$pid_file"
  fi

  nohup "$@" >>"$log_file" 2>&1 </dev/null &
  local pid=$!
  printf '%s\n' "$pid" > "$pid_file"
  printf 'Started %s (PID %s), log: %s\n' "$name" "$pid" "$log_file"
}

printf '\nClearing port 3000 before API startup...\n'
clear_port_3000
printf 'Starting API server with the built frontend on the same port...\n'
start_service 'API + web panel (port 3000)' "$ROOT_DIR/.run/api.pid" "$ROOT_DIR/logs/api.log" \
  pnpm --filter @workspace/api-server run dev

printf '\nCheck log: tail -f logs/api.log\n'
printf 'Panel and API: http://127.0.0.1:3000\n'
