const assert = require('assert');

// Mock Data & Config
const CAST_DURATION_MS = 2900;
const BASE_CATCH_CHANCE = 0.08;
const GIFT_TIER_LARGE = 100;

const fishingQueue = [];
let currentFishingSession = null;
const eventLog = [];

function clearFishingQueue() {
  fishingQueue.length = 0;
  currentFishingSession = null;
}

function enqueueFishing(player, { giftName = '', coins = 0 } = {}) {
  const safeCoins = Math.max(0, Number(coins) || 0);

  const existingIdx = fishingQueue.findIndex(item => item.player.id === player.id);
  if (existingIdx !== -1) {
    if (safeCoins > fishingQueue[existingIdx].coins) {
      fishingQueue[existingIdx].coins = safeCoins;
      fishingQueue[existingIdx].giftName = giftName || fishingQueue[existingIdx].giftName;
    }
  } else {
    fishingQueue.push({
      player,
      giftName: giftName || (safeCoins > 0 ? 'Quà' : 'Câu thường'),
      coins: safeCoins,
      enqueuedAt: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    });
  }

  sortFishingQueue();
  processNextInQueue();
}

function sortFishingQueue() {
  fishingQueue.sort((a, b) => (b.coins - a.coins) || (a.enqueuedAt - b.enqueuedAt));
}

function processNextInQueue() {
  if (currentFishingSession) return;
  if (!fishingQueue.length) return;

  const item = fishingQueue.shift();
  sortFishingQueue();

  currentFishingSession = {
    ...item,
    startedAt: Date.now()
  };

  eventLog.push({
    type: 'START_FISHING',
    username: item.player.username,
    coins: item.coins,
    giftName: item.giftName
  });
}

function finishCurrentFishing() {
  if (!currentFishingSession) return;
  eventLog.push({
    type: 'FINISH_FISHING',
    username: currentFishingSession.player.username,
    coins: currentFishingSession.coins
  });
  currentFishingSession = null;
  processNextInQueue();
}

console.log('\n================================================================');
console.log('🏁 KIỂM THỬ: HÀNG ĐỢI CÂU CÁ TUẦN TỰ & ƯU TIÊN THEO SỐ XU');
console.log('================================================================\n');

// Kịch bản của người dùng:
// "người tặng 1 xu đang câu thì có người tặng 10xu, như vậy khi người 1 xu câu xong
//  thì dù cho còn nhiều người tặng 1 xu đang xếp hàng thì người 10xu sẽ được thực hiện tiếp theo"

const p1 = { id: 'p1', username: 'Cần thủ 1 (1 xu)' };
const p2 = { id: 'p2', username: 'Cần thủ 2 (1 xu)' };
const p3 = { id: 'p3', username: 'Cần thủ 3 (1 xu)' };
const p4 = { id: 'p4', username: 'Cần thủ 4 (10 xu VIP)' };
const p5 = { id: 'p5', username: 'Cần thủ 5 (500 xu VIP Rồng)' };

// Bước 1: Cần thủ 1 tặng 1 xu -> Bắt đầu câu ngay
console.log('▶ Bước 1: Cần thủ 1 tặng 1 xu -> Bắt đầu câu ngay lập tức');
enqueueFishing(p1, { giftName: 'Hoa hồng', coins: 1 });

assert.strictEqual(currentFishingSession.player.id, 'p1', 'Cần thủ 1 đang là người duy nhất câu');
assert.strictEqual(fishingQueue.length, 0, 'Hàng đợi đang trống');
console.log(`   ✔ Người đang câu duy nhất: ${currentFishingSession.player.username}`);

// Bước 2: Trong lúc Cần thủ 1 đang câu, Cần thủ 2 và Cần thủ 3 lần lượt gửi 1 xu
console.log('\n▶ Bước 2: Cần thủ 2 và 3 cùng gửi 1 xu -> Xếp hàng đợi');
enqueueFishing(p2, { giftName: 'Hoa hồng', coins: 1 });
enqueueFishing(p3, { giftName: 'Kem ốc quế', coins: 1 });

assert.strictEqual(currentFishingSession.player.id, 'p1', 'Cần thủ 1 vẫn đang giữ cần câu trọn vẹn');
assert.strictEqual(fishingQueue.length, 2, 'Có 2 người xếp hàng');
assert.strictEqual(fishingQueue[0].player.id, 'p2', 'Vị trí 1 là Cần thủ 2');
assert.strictEqual(fishingQueue[1].player.id, 'p3', 'Vị trí 2 là Cần thủ 3');
console.log(`   ✔ Hàng đợi hiện tại: [${fishingQueue.map(q => q.player.username).join(', ')}]`);

// Bước 3: Cần thủ 4 bất ngờ tặng 10 xu!
console.log('\n▶ Bước 3: Cần thủ 4 tặng 10 xu -> Được ưu tiên đẩy lên đầu hàng đợi!');
enqueueFishing(p4, { giftName: 'Mũ phớt', coins: 10 });

assert.strictEqual(currentFishingSession.player.id, 'p1', 'Cần thủ 1 vẫn câu, không bị ngắt quãng');
assert.strictEqual(fishingQueue.length, 3, 'Hàng đợi có 3 người');
assert.strictEqual(fishingQueue[0].player.id, 'p4', 'Cần thủ 4 (10 xu) đã vượt qua Cần thủ 2 và 3 để lên vị trí số 1!');
console.log(`   ✔ Hàng đợi sau khi Cần thủ 4 tặng 10 xu:`);
fishingQueue.forEach((q, idx) => console.log(`      [#${idx + 1}] ${q.player.username} (${q.coins} xu)`));

// Bước 4: Cần thủ 1 câu xong -> Cần thủ 4 (10 xu) được thực hiện tiếp theo!
console.log('\n▶ Bước 4: Cần thủ 1 câu xong -> Cần thủ 4 (10 xu) thực hiện tiếp theo!');
finishCurrentFishing();

assert.strictEqual(currentFishingSession.player.id, 'p4', 'Cần thủ 4 (10 xu) được thực hiện tiếp theo đúng như yêu cầu!');
assert.strictEqual(fishingQueue.length, 2, 'Hàng đợi còn 2 người (Cần thủ 2 và 3)');
console.log(`   ✔ Người đang câu hiện tại: ${currentFishingSession.player.username}`);
console.log(`   ✔ Hàng đợi còn lại: [${fishingQueue.map(q => q.player.username).join(', ')}]`);

// Bước 5: Trong lúc Cần thủ 4 đang câu, Cần thủ 5 gửi 500 xu (Cực phẩm)!
console.log('\n▶ Bước 5: Cần thủ 5 tặng 500 xu -> Vượt lên đầu hàng đợi trước Cần thủ 2 và 3!');
enqueueFishing(p5, { giftName: 'Rồng Thần', coins: 500 });
assert.strictEqual(fishingQueue[0].player.id, 'p5', 'Cần thủ 5 (500 xu) chiếm vị trí số 1 trong hàng đợi');

// Bước 6: Cần thủ 4 xong -> Cần thủ 5 (500 xu) thực hiện
finishCurrentFishing();
assert.strictEqual(currentFishingSession.player.id, 'p5', 'Cần thủ 5 (500 xu) được câu tiếp theo');

// Bước 7: Cần thủ 5 xong -> Đến Cần thủ 2 (1 xu) -> Đến Cần thủ 3 (1 xu)
finishCurrentFishing();
assert.strictEqual(currentFishingSession.player.id, 'p2', 'Cần thủ 2 được câu');
finishCurrentFishing();
assert.strictEqual(currentFishingSession.player.id, 'p3', 'Cần thủ 3 được câu');
finishCurrentFishing();
assert.strictEqual(currentFishingSession, null, 'Tất cả đã hoàn thành');
assert.strictEqual(fishingQueue.length, 0, 'Hàng đợi trống');

console.log('\n================================================================');
console.log('🎉 TẤT CẢ CÁC BƯỚC KIỂM THỬ HÀNG ĐỢI ƯU TIÊN ĐÃ ĐẠT CHUẨN 100%!');
console.log('================================================================\n');

