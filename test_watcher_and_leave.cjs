const assert = require('assert');

console.log('🧪 Bắt đầu kiểm tra logic: 5 người câu, 1 người thoát sau 2.5 phút rời đi, 4 người kia tiếp tục câu...');

const players = new Map();
const fishingQueue = [];
let currentFishingSession = null;
const INACTIVE_LEAVE_SEC = 150; // 2.5 phút
const INACTIVE_LEAVE_MS = INACTIVE_LEAVE_SEC * 1000;

function checkInactiveLeave(simulatedNow) {
  const leaves = [];
  for (const player of players.values()) {
    if (player.onBank === false) continue;

    const inQueue = fishingQueue.some(q => q.player && q.player.id === player.id);
    const isCurrentFishing = currentFishingSession && currentFishingSession.player && currentFishingSession.player.id === player.id;
    if (inQueue || isCurrentFishing) continue;

    const lastSignal = Math.max(
      player.lastInteractionAt || 0,
      player.joinedAt || 0
    );
    const timeSinceLastSignal = simulatedNow - lastSignal;

    if (timeSinceLastSignal >= INACTIVE_LEAVE_MS) {
      player.onBank = false;
      player.hasPendingTurn = false;
      player.isWatching = false;
      leaves.push(player.id);
    }
  }
  return leaves;
}

// Khởi tạo 5 người cùng câu trên bờ lúc t0:
const t0 = 1000000;
for (let i = 1; i <= 5; i++) {
  players.set(`user_${i}`, {
    id: `user_${i}`,
    username: `Cần thủ ${i}`,
    onBank: true,
    hasPendingTurn: true,
    joinedAt: t0,
    lastInteractionAt: t0,
    lastActiveAt: t0,
    isWatching: true
  });
}

assert.strictEqual(players.size, 5);
console.log('✅ Đã tạo 5 cần thủ cùng vào bờ tại thời điểm t0.');

// Tình huống: Người số 5 thoát live lúc t0 (không chạm like, không chat, không tặng quà).
// 4 người kia (1, 2, 3, 4) vẫn xem live và chạm thả tim (Like) ở giây thứ 100:
const t100 = t0 + 100 * 1000;
for (let i = 1; i <= 4; i++) {
  const p = players.get(`user_${i}`);
  p.lastInteractionAt = t100; // Thả tim màn hình
}

// Kiểm tra ở giây thứ 30: KHÔNG AI BỊ RỜI BỜ (tránh lỗi kick nhầm người đang xem)
let leaves = checkInactiveLeave(t0 + 30 * 1000);
assert.strictEqual(leaves.length, 0);
assert.strictEqual([...players.values()].filter(p => p.onBank).length, 5);
console.log('✅ Giây thứ 30: Cả 5 người vẫn ở trên bờ câu cá an toàn (không bị kick nhầm).');

// Kiểm tra ở giây thứ 120 (2 phút): Người số 5 chưa đủ 150s -> Vẫn còn trên bờ
leaves = checkInactiveLeave(t0 + 120 * 1000);
assert.strictEqual(leaves.length, 0);
console.log('✅ Giây thứ 120: Người số 5 chưa đủ 150s -> Vẫn còn trên bờ.');

// Kiểm tra ở giây thứ 150 (2.5 phút kể từ khi Người 5 thoát):
const t150 = t0 + 150 * 1000;
leaves = checkInactiveLeave(t150);
assert.strictEqual(leaves.length, 1);
assert.strictEqual(leaves[0], 'user_5');
assert.strictEqual(players.get('user_5').onBank, false, 'Người số 5 đã rời bờ');

// Kiểm tra 4 người còn lại:
for (let i = 1; i <= 4; i++) {
  assert.strictEqual(players.get(`user_${i}`).onBank, true, `Người ${i} phải còn trên bờ`);
}
const remainingOnBank = [...players.values()].filter(p => p.onBank).length;
assert.strictEqual(remainingOnBank, 4);
console.log('✅ Đúng 2.5 phút (150s): Người số 5 đã rời khỏi bờ câu, 4 người kia VẪN TIẾP TỤC Ở LẠI CÂU!');

// Tiếp tục: 4 người kia lại thả tim ở giây thứ 220:
const t220 = t0 + 220 * 1000;
for (let i = 1; i <= 4; i++) {
  players.get(`user_${i}`).lastInteractionAt = t220;
}
leaves = checkInactiveLeave(t0 + 260 * 1000);
assert.strictEqual(leaves.length, 0);
assert.strictEqual([...players.values()].filter(p => p.onBank).length, 4);
console.log('✅ Sau 4 phút: 4 người thả tim vẫn tiếp tục ở lại bờ câu cá bình thường!');

console.log('\n🎉 BÀI TEST ĐẠT 100%! CƠ CHẾ HOẠT ĐỘNG HOÀN TOÀN CHUẨN XÁC!');
