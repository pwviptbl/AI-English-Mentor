#!/usr/bin/env bash
set -euo pipefail

SESSION="ai-english-mentor-dev"
BASE_DIR="/home/kali/Modelos/AI-English-Mentor"
BACKEND_DIR="${BASE_DIR}/backend"
FRONTEND_DIR="${BASE_DIR}/frontend"

require_tmux() {
  if ! command -v tmux >/dev/null 2>&1; then
    echo "tmux nao encontrado no PATH."
    exit 1
  fi
}

start_session() {
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Sessao '$SESSION' ja existe."
    return 0
  fi

  tmux new -d -s "$SESSION" -n backend "cd '$BACKEND_DIR' && source .venv/bin/activate 2>/dev/null || true; uvicorn app.main:app --reload --port 8000"
  tmux new-window -t "$SESSION" -n frontend "cd '$FRONTEND_DIR' && npm run dev"
  echo "Sessao '$SESSION' criada com backend/frontend."
}

attach_session() {
  tmux attach -t "$SESSION"
}

kill_session() {
  tmux kill-session -t "$SESSION"
}

main_menu() {
  require_tmux
  while true; do
    echo ""
    echo "AI English Mentor dev menu"
    echo "1) Iniciar session (backend + frontend)"
    echo "2) Anexar a session"
    echo "3) Finalizar session"
    echo "4) Sair"
    printf "Escolha: "
    read -r choice

    case "$choice" in
      1)
        start_session
        ;;
      2)
        attach_session
        ;;
      3)
        kill_session
        ;;
      4)
        exit 0
        ;;
      *)
        echo "Opcao invalida."
        ;;
    esac
  done
}

main_menu
