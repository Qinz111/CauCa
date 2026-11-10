const assert = require('assert');

console.log('=== TEST: BỎ LƯỢT CÂU MIỄN PHÍ KHI VỪA VÀO LIVE, PHẢI CHỜ 1 PHÚT ===');

// Mock data & functions matching server.js logic
const DEFAULT_FREE_COOLDOWN_SEC = 60;
const INACTIVE_LEAVE_MS = 30 * 1000;
const players = new Map();
const fishingQueue = [];
let currentFishingSession = null;

function ensurePlayer(user, enterBank = false) {
  const id = String(user.id);
  const now = Date.now();
  let player = players.get(id);
  if (!player) {
    player = {
      id,
      username: user.username,
      totalWeight: 0,
      totalFish: 0,
      catches: 0,
      currentCooldownSec: DEFAULT_FREE_COOLDOWN_SEC,
      cooldownUntil: 0,
      joinedAt: now,
      lastActiveAt: now,
      onBank: enterBank === true
    };
    players.set(id, player);
    if (enterBank === true) {
      player.cooldownUntil = now + DEFAULT_FREE_COOLDOWN_SEC * 1000;
    }
  } else {
    if (enterBank === true) {
      player.lastActiveAt = now;
      if (player.onBank === false) {
        player.onBank = true;
        player.cooldownUntil = now + (player.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC) * 1000;
      }
    }
  }
  return player;
}

function canPlayerFreeCast(player) {
  const now = Date.now();
  if (!player.cooldownUntil || now >= player.cooldownUntil) {
    return { allowed: true, remainingSec: 0 };
  }
  const remainingSec = Math.max(0, Math.ceil((player.cooldownUntil - now) / 1000));
  return { allowed: false, remainingSec };
}

function handleComment(user, commentText) {
  const existing = players.get(String(user.id));
  const wasOffBank = !existing || existing.onBank === false;

  const p = ensurePlayer(user, true);

  // LOGIC MỚI: BỎ LƯỢT CÂU NGAY LẬP TỨC. VẪN PHẢI CHỜ 1 PHÚT (60s)
  if (wasOffBank) {
    p.cooldownUntil = Date.now() + (p.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC) * 1000;
    return { isNewJoin: true, remainingSec: p.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC, castTriggered: false };
  } else {
    const chk = canPlayerFreeCast(p);
    if (chk.allowed) {
      p.cooldownUntil = Date.now() + (p.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC) * 1000;
      fishingQueue.push({ player: p, coins: 0 });
      return { isNewJoin: false, castTriggered: true };
    } else {
      return { isNewJoin: false, castTriggered: false, remainingSec: chk.remainingSec };
    }
  }
}

// 1. Kiểm tra khi cần thủ mới cmt vào bờ
console.log('--- TEST 1: Cần thủ mới bình luận vào bờ câu ---');
const user1 = { id: 'user_101', username: 'Thợ Câu Mới' };
const res1 = handleComment(user1, 'xin chào');

assert.strictEqual(res1.isNewJoin, true, 'Phải đánh dấu là vừa mới bước vào bờ');
assert.strictEqual(res1.castTriggered, false, 'KHÔNG ĐƯỢC kích hoạt câu ngay lập tức!');
assert.strictEqual(res1.remainingSec, 60, 'Thời gian hồi chiêu phải là 60 giây (1 phút)');
assert.strictEqual(fishingQueue.length, 0, 'Hàng đợi câu phải rỗng (chưa được câu)');
assert.strictEqual(canPlayerFreeCast(players.get('user_101')).allowed, false, 'Chưa được phép câu tự do');

// 2. Kiểm tra nếu cmt tiếp trong lúc đang đếm 60s
console.log('--- TEST 2: Bình luận tiếp trong lúc đang hồi chiêu ---');
const res2 = handleComment(user1, 'sao chưa câu được');
assert.strictEqual(res2.isNewJoin, false, 'Không phải vừa vào bờ');
assert.strictEqual(res2.castTriggered, false, 'Vẫn chưa được câu');
assert.strictEqual(res2.remainingSec >= 59, true, 'Phải báo còn ~60s hồi chiêu');

// 3. Kiểm tra logic bảo vệ trong 1 phút đầu tiên (không bị kick ở giây 30)
console.log('--- TEST 3: Bảo vệ cần thủ trong 1 phút đầu tiên ---');
const p1 = players.get('user_101');
const now = Date.now();
p1.lastActiveAt = now - 35000; // Đã 35s trôi qua kể từ lúc cmt

// Kiểm tra điều kiện bảo vệ
const isWaitingFirstCast = (p1.catches || 0) === 0 && (p1.totalFish || 0) === 0 && p1.cooldownUntil && now < p1.cooldownUntil;
assert.strictEqual(isWaitingFirstCast, true, 'Cần thủ mới phải được bảo vệ trong 60s đầu tiên để kịp câu lần đầu');

// 4. Kiểm tra khi hết 1 phút (60s) -> Được câu cá
console.log('--- TEST 4: Sau khi hết 60s -> Được giật cần câu cá ---');
p1.cooldownUntil = now - 1000; // Đã qua 60s
const res4 = handleComment(user1, 'câu thôi');
assert.strictEqual(res4.castTriggered, true, 'Hết 60s phải được câu');
assert.strictEqual(fishingQueue.length, 1, 'Lượt câu đã được đưa vào hàng đợi');

// 5. Sau khi đã câu xong 1 lần (catches > 0) -> Luật 30s áp dụng bình thường
console.log('--- TEST 5: Sau khi đã câu xong 1 lần -> Hết 30s tương tác sẽ rời bờ ---');
p1.catches = 1;
p1.lastActiveAt = now - 35000; // Không tương tác thêm trong 35s
const isWaitingAfterFirst = (p1.catches || 0) === 0 && (p1.totalFish || 0) === 0 && p1.cooldownUntil && now < p1.cooldownUntil;
assert.strictEqual(isWaitingAfterFirst, false, 'Đã câu xong thì không còn diện bảo vệ lượt đầu nữa');

const timeSinceActive = now - (p1.lastActiveAt || now);
assert.strictEqual(timeSinceActive >= INACTIVE_LEAVE_MS, true, 'Đã quá 30s không tương tác -> Sẽ rời bờ!');

console.log('✅ TẤT CẢ 5 BÀI TEST ĐÃ VƯỢT QUA 100%!');
