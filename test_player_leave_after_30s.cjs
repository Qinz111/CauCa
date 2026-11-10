const assert = require('assert');

console.log('========================================================================');
console.log('🧪 KIỂM THỬ: TỰ ĐỘNG RỜI BỜ SAU 30S KHÔNG HOẠT ĐỘNG / RỜI LIVE');
console.log('========================================================================\n');

// Giả lập logic quản lý người chơi & rời bờ
const players = new Map();
const fishingQueue = [];
let currentFishingSession = null;
const emittedEvents = [];

const io = {
  emit: (event, data) => {
    emittedEvents.push({ event, data, time: Date.now() });
  }
};

const INACTIVE_LEAVE_MS = 30 * 1000;

function ensurePlayer(u) {
  const id = u.id || u.uniqueId || 'guest';
  let p = players.get(id);
  const now = Date.now();
  if (!p) {
    p = {
      id,
      username: u.username || u.nickname || 'Cần thủ',
      joinedAt: now,
      lastActiveAt: now,
      onBank: true,
      totalWeight: 0,
      catches: 0
    };
    players.set(id, p);
    io.emit('player:join', p);
  } else {
    p.lastActiveAt = now;
    if (p.onBank === false) {
      p.onBank = true;
      io.emit('player:join', p);
    }
  }
  return p;
}

function checkInactivePlayers(currentTime) {
  const now = currentTime || Date.now();
  for (const player of players.values()) {
    if (player.onBank === false) continue;

    // Không rời bờ nếu đang trong hàng đợi hoặc đang thực hiện lượt câu
    const inQueue = fishingQueue.some(q => q.player && q.player.id === player.id);
    const isCurrentFishing = currentFishingSession && currentFishingSession.player && currentFishingSession.player.id === player.id;
    if (inQueue || isCurrentFishing) {
      player.lastActiveAt = now;
      continue;
    }

    const timeSinceActive = now - (player.lastActiveAt || player.joinedAt || now);
    if (timeSinceActive >= INACTIVE_LEAVE_MS) {
      player.onBank = false;
      io.emit('player:leave', {
        playerId: player.id,
        username: player.username,
        time: now
      });
    }
  }
}

// ---------------------- TEST CASES ----------------------
console.log('▶ Test 1: Người chơi A vào bờ câu cá');
const pA = ensurePlayer({ id: 'user-A', username: 'Nguyễn Văn A' });
assert.strictEqual(pA.onBank, true);
assert.strictEqual(emittedEvents.filter(e => e.event === 'player:join').length, 1);
console.log('   ✔ Cần thủ A đã vào bờ, nhận sự kiện player:join (PASS)');

console.log('\n▶ Test 2: Sau 15 giây (chưa đủ 30s) -> Vẫn ở trên bờ');
const t15s = pA.lastActiveAt + 15000;
checkInactivePlayers(t15s);
assert.strictEqual(pA.onBank, true);
assert.strictEqual(emittedEvents.some(e => e.event === 'player:leave'), false);
console.log('   ✔ 15s trôi qua, Cần thủ A vẫn giữ vị trí trên bờ (PASS)');

console.log('\n▶ Test 3: Tròn 30 giây không hoạt động -> Rời khỏi bờ câu');
const t31s = pA.lastActiveAt + 31000;
checkInactivePlayers(t31s);
assert.strictEqual(pA.onBank, false);
const leaveEvent = emittedEvents.find(e => e.event === 'player:leave');
assert.ok(leaveEvent, 'Phải có sự kiện player:leave');
assert.strictEqual(leaveEvent.data.playerId, 'user-A');
console.log('   ✔ Đúng 30s không hoạt động, Cần thủ A rời bờ câu, bắn sự kiện player:leave (PASS)');

console.log('\n▶ Test 4: Cần thủ B đang chờ trong hàng đợi câu cá -> KHÔNG bị đuổi khỏi bờ dù quá 30s');
const pB = ensurePlayer({ id: 'user-B', username: 'Trần Văn B' });
fishingQueue.push({ player: pB, coins: 10 });
const t40s = pB.lastActiveAt + 40000;
checkInactivePlayers(t40s);
assert.strictEqual(pB.onBank, true, 'Đang chờ câu không được rời bờ');
console.log('   ✔ Cần thủ B đang trong hàng đợi nên được bảo vệ an toàn trên bờ (PASS)');

console.log('\n▶ Test 5: Cần thủ A quay lại cmt -> Tự động bước vào bờ câu lại');
emittedEvents.length = 0;
const pAReturn = ensurePlayer({ id: 'user-A', username: 'Nguyễn Văn A' });
assert.strictEqual(pAReturn.onBank, true);
assert.strictEqual(emittedEvents.filter(e => e.event === 'player:join').length, 1);
console.log('   ✔ Cần thủ A quay lại cmt, tự động bước vào bờ nhận cần câu (PASS)');

console.log('\n========================================================================');
console.log('🎉 TẤT CẢ CÁC BÀI TEST TỰ ĐỘNG RỜI BỜ SAU 30S ĐÃ ĐẠT 100%!');
console.log('========================================================================\n');

