import { NETWORK_SEND_HZ } from '../config.js';

// لا ننشئ أي اتصال جديد هنا — نستخدم bridge.send الموجود اللي يمرر لقناة PeerJS DataConnection
// الحالية بالمشروع الأساسي (نفس قناة الشات/الألعاب)، فقط بنوع رسالة جديد "world-*".
export class WorldSync {
  constructor(bridge) {
    this.bridge = bridge;
    this._lastSend = 0;
    this._lastSentState = null;
    this.peerInWorld = false;
    this.onPeerEnter = null;
    this.onPeerState = null;

    bridge.onMessage = (msg) => {
      switch (msg.kind) {
        case 'world-enter':
          this.peerInWorld = true;
          if (this.onPeerEnter) this.onPeerEnter(msg);
          break;
        case 'world-state':
          this.peerInWorld = true;
          if (this.onPeerState) this.onPeerState(msg);
          break;
      }
    };
  }

  announceEnter(colorId) {
    this.bridge.send({ kind: 'world-enter', color: colorId, name: this.bridge.getMyName() });
  }

  maybeSendState(now, controller, colorId) {
    if (now - this._lastSend < 1000 / NETWORK_SEND_HZ) return;
    const s = {
      kind: 'world-state',
      x: round(controller.pos.x), z: round(controller.pos.z),
      ry: round(controller.yaw), state: controller.state,
      sitting: controller.sitting, color: colorId,
    };
    // ما نرسل إذا ما فيه أي تغيير فعلي عن آخر إرسال (توفير بيانات) — إلا كل ~1.2s كـ heartbeat
    const key = `${s.x}|${s.z}|${s.ry}|${s.state}|${s.sitting}`;
    if (key === this._lastSentState && now - this._lastSend < 1200) return;
    this._lastSentState = key;
    this._lastSend = now;
    this.bridge.send(s);
  }
}

function round(n) { return Math.round(n * 1000) / 1000; }

// استيفاء سلس لموقع/دوران الشخصية البعيدة بين كل تحديث شبكة يوصل
export function interpolateRemote(remoteController, dt) {
  const c = remoteController;
  const t = Math.min(1, dt * 12);
  c.pos.x += (c.target.x - c.pos.x) * t;
  c.pos.z += (c.target.z - c.pos.z) * t;
  let diff = c.target.yaw - c.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  c.yaw += diff * t;
}
