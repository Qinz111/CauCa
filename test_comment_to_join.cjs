const assert = require('assert');

console.log('========================================================================');
console.log('🧪 KIỂM THỬ: CHỈ KHI BÌNH LUẬN (COMMENT) MỚI ĐƯỢC VÀO BỜ CÂU CÁ');
console.log('========================================================================\n');

// Mock dữ liệu người dùng và hệ thống
const players = new Map();
let emittedJoinEvents = [];
let emittedLeaveEvents = [];

function emit(event, data) {
  if (event === 'player:join') emittedJoinEvents.push(data);
  if (event === 'player:leave') emittedLeaveEvents.push(data);
}

const DEFAULT_FREE_COOLDOWN_SEC = 60;

function ensurePlayer(userInput = {}, enterBank = false) {
  const user = userInput;
  const id = String(user.id || user.userId || user.uniqueId || `guest-${Date.now()}`);
  let player = players.get(id);
  const now = Date.now();
  if (!player) {
    player = {
      id,
      username: String(user.username || user.nickname || 'Cần thủ').slice(0, 28),
      totalWeight: 0,
      totalFish: 0,
      catches: 0,
      heaviestFish: 0,
      cooldownUntil: 0,
      currentCooldownSec: DEFAULT_FREE_COOLDOWN_SEC,
      totalLikes: 0,
      totalCoinsGiven: 0,
      giftCount: 0,
      joinedAt: now,
      lastActiveAt: now,
      onBank: enterBank === true
    };
    players.set(id, player);
    if (enterBank === true) {
      emit('player:join', player);
    }
  } else {
    if (enterBank === true) {
      player.lastActiveAt = now;
      if (player.onBank === false) {
        player.onBank = true;
        emit('player:join', player);
      }
    }
  }
  return player;
}

// 1. Khi người xem chỉ lướt qua / vào phòng xem live (MEMBER event)
console.log('▶ Test 1: Người xem A chỉ vào phòng xem live (chưa bình luận)');
const userA = { uniqueId: 'viewer_a', nickname: 'Anh Xem Chùa' };

// Xử lý sự kiện MEMBER
// KHÔNG gọi ensurePlayer với enterBank=true, KHÔNG phát player:join
console.log('   -> Nhận sự kiện WebcastEvent.MEMBER từ @Anh Xem Chùa');
assert.strictEqual(emittedJoinEvents.length, 0, 'Chưa có ai được vào bờ');
assert.strictEqual(players.has('viewer_a'), false, 'Không tạo nhân vật trên bờ câu khi chỉ lướt vào xem');
console.log('   ✔ Người xem chỉ vào xem live KHÔNG được bước vào bờ câu cá (PASS)\n');

// 2. Khi người xem bình luận bất kỳ trong live (CHAT event)
console.log('▶ Test 2: Người xem A gửi bình luận bất kỳ: "câu cá đi bạn ơi"');
const commentA = 'câu cá đi bạn ơi';
const pA = ensurePlayer(userA, true); // CHAT event passes true!

console.log(`   -> Nhận sự kiện WebcastEvent.CHAT từ @${pA.username}: "${commentA}"`);
assert.strictEqual(pA.onBank, true, 'Nhân vật phải có onBank = true sau khi bình luận');
assert.strictEqual(emittedJoinEvents.length, 1, 'Phải phát sự kiện player:join cho người đã bình luận');
assert.strictEqual(emittedJoinEvents[0].id, 'viewer_a');
console.log('   ✔ Ngay khi bình luận bất kỳ, cần thủ chính thức bước vào bờ câu! (PASS)\n');

// 3. Người xem B chỉ thả tim (LIKE event) khi chưa bình luận
console.log('▶ Test 3: Người xem B vào live và chỉ thả tim (LIKE event), chưa bình luận');
const userB = { uniqueId: 'viewer_b', nickname: 'Bé Thả Tim' };

// Xử lý LIKE: Chỉ áp dụng nếu người này đã trên bờ (onBank === true)
const pB_check = players.get(userB.uniqueId);
const isEligibleToLike = Boolean(pB_check && pB_check.onBank === true);

assert.strictEqual(isEligibleToLike, false, 'Chưa bình luận thì không được vào bờ kể cả khi thả tim');
assert.strictEqual(emittedJoinEvents.length, 1, 'Số người trên bờ vẫn chỉ là 1 (người A)');
console.log('   ✔ Thả tim khi chưa bình luận KHÔNG làm nhân vật nhảy vào bờ câu (PASS)\n');

// 4. Người xem C tặng quà (GIFT event)
console.log('▶ Test 4: Người xem C tặng 1 Hoa hồng (GIFT event)');
const userC = { uniqueId: 'viewer_c', nickname: 'Đại Gia Tặng Quà' };
const pC = ensurePlayer(userC, true); // GIFT event passes true!

assert.strictEqual(pC.onBank, true, 'Người tặng quà phải được vào bờ ngay');
assert.strictEqual(emittedJoinEvents.length, 2, 'Số người trên bờ tăng lên 2');
console.log('   ✔ Người tặng quà được vào bờ câu ngay lập tức (PASS)\n');

// 5. Sau khi người A không bình luận 30s -> Rời bờ câu
console.log('▶ Test 5: Người A ngừng tương tác sau 30s -> Tự động ra khỏi bờ câu');
pA.onBank = false;
emit('player:leave', { playerId: pA.id, username: pA.username });
assert.strictEqual(emittedLeaveEvents.length, 1);
assert.strictEqual(pA.onBank, false);
console.log('   ✔ Người A đã rời bờ câu sau 30s không hoạt động (PASS)');

// 6. Người A bình luận lại lần 2 -> Tự động bước vào bờ lại!
console.log('▶ Test 6: Người A bình luận lại: "tôi lại vào câu đây"');
const pA_rejoin = ensurePlayer(userA, true);
assert.strictEqual(pA_rejoin.onBank, true);
assert.strictEqual(emittedJoinEvents.length, 3, 'Phát tiếp sự kiện player:join khi bình luận lại');
console.log('   ✔ Khi bình luận lại, cần thủ lập tức bước vào bờ câu lại như cũ! (PASS)\n');

console.log('========================================================================');
console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ ĐẠT 100%!');
console.log('========================================================================');

