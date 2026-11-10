const assert = require('assert');

console.log('=== TEST: LÀM MỚI DỮ LIỆU KHI TẮT LIVE HOẶC PHIÊN LIVE MỚI ===');

const players = new Map();
const fishingQueue = [];
let currentRoomId = '7706145053500230406';

function resetLiveSessionData(reason) {
  fishingQueue.length = 0;
  players.clear();
  return { cleared: true, reason };
}

// 1. Thêm cần thủ vào phòng
players.set('user_1', { id: 'user_1', username: 'Challenge', onBank: true });
players.set('user_2', { id: 'user_2', username: 'lemon.beer', onBank: true });
fishingQueue.push({ player: { id: 'user_1' }, coins: 0 });

assert.strictEqual(players.size, 2, 'Phòng ban đầu có 2 cần thủ');
assert.strictEqual(fishingQueue.length, 1, 'Có 1 lượt câu trong hàng đợi');

// 2. Streamer kết thúc phiên LIVE (streamEnd)
console.log('--- TEST 1: Streamer kết thúc LIVE (streamEnd) -> Dọn sạch bờ câu ---');
const res = resetLiveSessionData('Phiên LIVE đã kết thúc (streamEnd)');
assert.strictEqual(players.size, 0, 'Toàn bộ cần thủ cũ phải bị xóa khỏi phòng!');
assert.strictEqual(fishingQueue.length, 0, 'Hàng đợi câu phải được dọn sạch!');

// 3. Bắt đầu phiên LIVE mới với Room ID khác
console.log('--- TEST 2: Kết nối phiên LIVE mới (Room ID mới) -> Làm mới dữ liệu ---');
players.set('old_user', { id: 'old_user', username: 'OldPlayer', onBank: true });
const newRoomId = '7706164976787999494';

if (currentRoomId && String(newRoomId) !== String(currentRoomId)) {
  resetLiveSessionData(`Phát hiện phiên LIVE mới (${currentRoomId} -> ${newRoomId})`);
  currentRoomId = newRoomId;
}

assert.strictEqual(players.size, 0, 'Cần thủ phiên cũ không được tồn tại trong phòng mới!');
assert.strictEqual(currentRoomId, '7706164976787999494', 'Room ID mới đã được cập nhật');

console.log('✅ TẤT CẢ CÁC BÀI TEST LÀM MỚI DỮ LIỆU KHI TẮT LIVE ĐÃ ĐẠT 100%!');

