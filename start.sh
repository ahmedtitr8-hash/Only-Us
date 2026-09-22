#!/data/data/com.termux/files/usr/bin/bash
# يشغّل سيرفر التسجيل + تونيل Tailscale Funnel مع بعض بأمر وحد: ./start.sh
set -e
cd "$(dirname "$0")"

# يقرأ PORT من .env إن وجد
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi
PORT="${PORT:-3000}"

echo "🚀 تشغيل السيرفر..."
node server.js &
SERVER_PID=$!

cleanup() {
  echo "⏹ إيقاف السيرفر..."
  kill "$SERVER_PID" 2>/dev/null
}
trap cleanup EXIT

sleep 2

# يشغّل tailscaled لو مو شغال أصلاً
if ! pgrep -f tailscaled >/dev/null 2>&1; then
  echo "🔧 تشغيل tailscaled..."
  tailscaled-start
  sleep 1
fi

echo "🌐 تشغيل Tailscale Funnel على بورت ${PORT}..."
tailscale-cli funnel "$PORT"
