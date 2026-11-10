const assert = require('assert');

console.log('========================================================================');
console.log('🧪 KIỂM THỬ: ƯU TIÊN GIẬT CẦN & XỬ LÝ QUÀ TẶNG (TIKTOK GIFTS)');
console.log('========================================================================\n');

// 1. Kiểm thử resolveGiftCost
const giftCatalog = {
  5655: { name: 'Hoa hồng', coins: 1 }
};

function resolveGiftCost(data) {
  if (!data) return { giftId: 0, giftName: 'Quà', repeatCount: 1, diamondCount: 0, unitCoins: 0, coinCost: 0, isUnknown: true };

  const giftId = Number(data.giftId || data.gift?.id || data.extendedGiftInfo?.id || data.id || 0);
  const giftName = data.gift?.name || data.extendedGiftInfo?.name || data.giftDetails?.giftName || data.giftName || data.describe || 'Quà TikTok';
  const repeatCount = Math.max(1, Number(data.repeatCount || data.repeat_count || 1));
  const diamondCount = Number(
    data.diamondCount ??
    data.diamond_count ??
    data.gift?.diamondCount ??
    data.extendedGiftInfo?.diamondCount ??
    data.giftDetails?.diamondCount ??
    data.gift?.diamond_count ??
    data.coins ??
    0
  );

  let unitCoins = 0;
  if (giftId && giftCatalog[giftId] && giftCatalog[giftId].coins > 0) {
    unitCoins = giftCatalog[giftId].coins;
  } else if (diamondCount > 0) {
    unitCoins = diamondCount;
  } else if (data.gift?.coinCount != null && Number(data.gift.coinCount) > 0) {
    unitCoins = Number(data.gift.coinCount);
  } else {
    unitCoins = 1;
  }

  const coinCost = unitCoins * repeatCount;
  return {
    giftId,
    giftName,
    repeatCount,
    diamondCount: diamondCount || unitCoins,
    unitCoins,
    coinCost,
    isUnknown: false
  };
}

console.log('▶ Test 1: Quà chưa có trong Catalog nhưng có diamondCount (vd: Bánh Donut 30 diamonds x 2)');
const res1 = resolveGiftCost({ giftId: 9999, giftName: 'Bánh Donut', repeatCount: 2, diamondCount: 30 });
assert.strictEqual(res1.isUnknown, false);
assert.strictEqual(res1.coinCost, 60);
console.log('   ✔ Tự động quy đổi diamondCount -> 60 xu chính xác (PASS)');

console.log('\n▶ Test 2: Quà lạ hoàn toàn không có thông tin xu -> Tối thiểu 1 xu, không bao giờ bị huỷ bỏ');
const res2 = resolveGiftCost({ giftId: 8888, giftName: 'Quà lạ TikTok' });
assert.strictEqual(res2.isUnknown, false);
assert.strictEqual(res2.coinCost, 1);
console.log('   ✔ Tự động gán 1 xu bảo đảm lượt giật cần cho người tặng (PASS)');

// 2. Kiểm thử Hàng đợi ưu tiên giật cần (VIP Fast-Pass)
const fishingQueue = [];
let currentFishingSession = null;
let currentBiteTimer = null;
let currentAnimTimer = null;
const eventLog = [];

function sortFishingQueue() {
  fishingQueue.sort((a, b) => (b.coins - a.coins) || (a.enqueuedAt - b.enqueuedAt));
}

function enqueueFishing(player, { giftName = '', coins = 0 } = {}) {
  const safeCoins = Math.max(0, Number(coins) || 0);
  fishingQueue.push({
    player,
    giftName,
    coins: safeCoins,
    enqueuedAt: Date.now(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  });

  sortFishingQueue();

  if (safeCoins > 0 && currentFishingSession && currentFishingSession.coins === 0) {
    if (typeof currentFishingSession.fastForward === 'function') {
      currentFishingSession.fastForward();
      return;
    }
  }

  processNextInQueue();
}

function processNextInQueue() {
  if (currentFishingSession) return;
  if (!fishingQueue.length) return;

  const item = fishingQueue.shift();
  sortFishingQueue();

  eventLog.push({ type: 'start_fish', player: item.player.username, coins: item.coins });

  currentFishingSession = {
    ...item,
    fastForward: () => {
      eventLog.push({ type: 'fast_forward', player: item.player.username });
      currentFishingSession = null;
      processNextInQueue();
    }
  };
}

console.log('\n▶ Test 3: Cần thủ A đang câu miễn phí (0 xu) -> Người B tặng quà (100 xu) -> Fast-Forward giật cần ngay lập tức');
eventLog.length = 0;
currentFishingSession = null;
fishingQueue.length = 0;

// Người A câu 0 xu
enqueueFishing({ id: 'A', username: 'Cần thủ A' }, { giftName: 'Câu thường', coins: 0 });
assert.strictEqual(currentFishingSession.player.username, 'Cần thủ A');
assert.strictEqual(currentFishingSession.coins, 0);

// Người B tặng quà 100 xu
enqueueFishing({ id: 'B', username: 'Cần thủ B VIP' }, { giftName: 'Pháo hoa', coins: 100 });

// Xác nhận Người B đã giật cần ngay!
assert.strictEqual(currentFishingSession.player.username, 'Cần thủ B VIP');
assert.strictEqual(currentFishingSession.coins, 100);
console.log('   ✔ Cần thủ B tặng quà 100 xu đã cắt hàng giật cần NGAY LẬP TỨC! (PASS)');

console.log('\n▶ Test 4: Xếp hàng nhiều mức quà: 500 xu > 50 xu > 1 xu > 0 xu');
currentFishingSession = { player: { username: 'Đang câu' }, coins: 5000 }; // Đang bận
fishingQueue.length = 0;

enqueueFishing({ id: 'free1', username: 'Khách 1' }, { coins: 0 });
enqueueFishing({ id: 'free2', username: 'Khách 2' }, { coins: 0 });
enqueueFishing({ id: 'rose', username: 'Khách Tặng Hoa' }, { coins: 1 });
enqueueFishing({ id: 'super', username: 'Đại Gia Thần Rồng' }, { coins: 500 });
enqueueFishing({ id: 'boat', username: 'Khách Du Thuyền' }, { coins: 50 });

assert.strictEqual(fishingQueue[0].coins, 500);
assert.strictEqual(fishingQueue[1].coins, 50);
assert.strictEqual(fishingQueue[2].coins, 1);
assert.strictEqual(fishingQueue[3].coins, 0);
assert.strictEqual(fishingQueue[4].coins, 0);
console.log('   ✔ Thứ tự xếp hàng chuẩn tuyệt đối: 500 xu -> 50 xu -> 1 xu -> 0 xu (PASS)');

// 3. Kiểm thử getCatchPriority trong Frontend
function getCatchPriority(e) {
  const weightVal = Number(e.fish?.weight || 0);
  const coins = Number(e.coins || 0);
  if (coins >= 5000 || weightVal >= 200) return 5;
  if (coins >= 1000 || weightVal >= 50) return 4;
  if (coins >= 100 || weightVal >= 5) return 3;
  if (coins >= 1 || weightVal >= 1) return 2;
  return 1;
}

console.log('\n▶ Test 5: Ưu tiên bảng thông báo & giọng đọc cho quà 1 xu (Hoa hồng, Trái tim)');
const pRose = getCatchPriority({ coins: 1, fish: { weight: 0.5 } });
const pFree = getCatchPriority({ coins: 0, fish: { weight: 0.5 } });
assert.strictEqual(pRose, 2);
assert.strictEqual(pFree, 1);
assert.ok(pRose > pFree, 'Quà 1 xu phải có độ ưu tiên cao hơn câu thường 0 xu');
console.log('   ✔ Quà 1 xu (Priority 2) luôn được ưu tiên đọc & hiện trước câu miễn phí 0 xu (Priority 1) (PASS)');

console.log('\n========================================================================');
console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ƯU TIÊN GIẬT CẦN ĐÃ ĐẠT 100%!');
console.log('========================================================================\n');

