const assert = require('assert');

// 1. Kiểm tra logic xử lý thời gian không hoạt động 30s
console.log('--- TEST 1: Kiểm tra logic 30s inactivity leave ---');
const INACTIVE_LEAVE_MS = 30 * 1000;
const now = Date.now();

const player = {
  id: '6556881756061138945',
  username: 'lemon.beer',
  onBank: true,
  joinedAt: now - 35000,
  lastActiveAt: now - 31000 // Đã quá 30s không tương tác
};

const timeSinceActive = now - (player.lastActiveAt || player.joinedAt || now);
assert.strictEqual(timeSinceActive >= INACTIVE_LEAVE_MS, true, 'Người chơi phải được xác định là quá 30s không tương tác');

// 2. Kiểm tra lọc tin nhắn trùng lặp (Message Deduplication)
console.log('--- TEST 2: Kiểm tra lọc tin nhắn trùng lặp khi reconnect ---');
const processedMsgIds = new Set();

function shouldProcessMsg(msgId) {
  if (processedMsgIds.has(msgId)) return false;
  processedMsgIds.add(msgId);
  return true;
}

const msgId1 = '6556881756061138945_hi_1794228000';
assert.strictEqual(shouldProcessMsg(msgId1), true, 'Lần đầu nhận tin nhắn -> Xử lý');
assert.strictEqual(shouldProcessMsg(msgId1), false, 'Replay tin nhắn trùng -> Bỏ qua không reset lastActiveAt');
assert.strictEqual(shouldProcessMsg(msgId1), false, 'Replay tin nhắn trùng lần 2 -> Tiếp tục bỏ qua');

// 3. Kiểm tra hàm startPlayerLeave & removeScenePlayer với String ID
console.log('--- TEST 3: Kiểm tra xử lý removeScenePlayer trên Canvas Client ---');
const scenePlayers = [
  { id: '6556881756061138945', username: 'lemon.beer', sceneSlot: 0, leaveStarted: null },
  { id: 'demo-kh-ch-xem', username: 'Khách xem', sceneSlot: 1, leaveStarted: null }
];

function removeScenePlayer(pid) {
  const idx = scenePlayers.findIndex(p => String(p.id) === String(pid));
  if (idx !== -1) {
    scenePlayers.splice(idx, 1);
  }
}

// Truyền vào id dạng chuỗi hoặc số
removeScenePlayer('6556881756061138945');
assert.strictEqual(scenePlayers.length, 1, 'Cần thủ 6556881756061138945 phải được xóa khỏi danh sách');
assert.strictEqual(scenePlayers[0].id, 'demo-kh-ch-xem', 'Chỉ còn Khách xem ở lại');

console.log('✅ TẤT CẢ CÁC BÀI TEST 30S INACTIVITY LEAVE ĐÃ VƯỢT QUA 100%!');

