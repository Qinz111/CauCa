const assert = require('assert');

const GIFT_TIER_LARGE = 100;
const GIFT_TIER_MEDIUM = 10;
const APPROACH_TIMEOUT_MS = 6500;
const ZOOM_GAP = 320;
const ZOOM_HOLD_AFTER = 1200;

const W = 400, H = 700;
const lerp = (a, b, t) => a + (b - a) * t;

let players = [];
const approachingCatches = new Map();
const activeCatches = new Map();
const zoomQueue = [];
let currentZoomTarget = null;
let lastZoomEndTime = 0;
let lastSpotlightAnglerPos = null;
let spotlightDarkAlpha = 0;
let lastActivityTime = 0;
let isDragging = false;

const camera = {
  x: 0, y: 0, z: 0.85,
  targetX: 0, targetY: 0, targetZ: 0.85,
  minZ: 0.22, maxZ: 2.2
};

const lay = {};
function mockLayout() {
  return players.map((p, idx) => {
    const l = { p, ax: 60 + idx * 80, ay: 500, bx: 80 + idx * 80, by: 420 };
    lay[p.id] = l;
    return l;
  });
}

function getGiftTier(coins) {
  if (coins >= GIFT_TIER_LARGE) return 'large';
  if (coins >= GIFT_TIER_MEDIUM) return 'medium';
  return 'small';
}

function getZoomDuration(tier) {
  if (tier === 'large') return 3400;
  if (tier === 'medium') return 2800;
  return 2200;
}

function getZoomScale(tier) {
  if (tier === 'large') return 1.45;
  if (tier === 'medium') return 1.28;
  return 1.15;
}

function requestZoom(e, coins, now) {
  const playerId = e.playerId;
  if (!playerId) return;
  const tier = getGiftTier(coins);
  const duration = getZoomDuration(tier);

  const item = {
    playerId,
    username: e.username,
    coins,
    tier,
    giftName: e.giftName,
    addedAt: now
  };

  if (currentZoomTarget && currentZoomTarget.playerId === playerId) {
    if (coins > currentZoomTarget.coins) {
      currentZoomTarget.coins = coins;
      currentZoomTarget.tier = tier;
    }
    currentZoomTarget.minEndTime = Math.max(currentZoomTarget.minEndTime, now + duration);
    return;
  }

  if (!currentZoomTarget && now >= (lastZoomEndTime + ZOOM_GAP)) {
    startZoom(item, now);
    return;
  }

  const existingIdx = zoomQueue.findIndex(q => q.playerId === playerId);
  if (existingIdx !== -1) {
    if (coins > zoomQueue[existingIdx].coins) {
      zoomQueue[existingIdx].coins = coins;
      zoomQueue[existingIdx].tier = tier;
    }
  } else {
    zoomQueue.push(item);
  }

  zoomQueue.sort((a, b) => (b.coins - a.coins) || (a.addedAt - b.addedAt));
}

function startZoom(item, now) {
  const duration = getZoomDuration(item.tier);
  currentZoomTarget = {
    ...item,
    startTime: now,
    minEndTime: now + duration
  };
}

function updateSpotlightAndCamera(t, now) {
  approachingCatches.forEach((ap, pid) => {
    if (now - ap.start > APPROACH_TIMEOUT_MS || !players.some(p => p.id === pid)) {
      approachingCatches.delete(pid);
    }
  });
  activeCatches.forEach((c, pid) => {
    if (now - c.start > 2600 || !players.some(p => p.id === pid)) {
      activeCatches.delete(pid);
    }
  });
  for (let i = zoomQueue.length - 1; i >= 0; i--) {
    if (!players.some(p => p.id === zoomQueue[i].playerId)) {
      zoomQueue.splice(i, 1);
    }
  }

  if (currentZoomTarget) {
    const stillInPlayers = players.some(p => p.id === currentZoomTarget.playerId);
    const hasActiveEvent = approachingCatches.has(currentZoomTarget.playerId) || activeCatches.has(currentZoomTarget.playerId);
    const minTimePassed = now >= currentZoomTarget.minEndTime;
    const maxTimePassed = now >= (currentZoomTarget.startTime + getZoomDuration(currentZoomTarget.tier) + 1800);

    if (!stillInPlayers || (minTimePassed && !hasActiveEvent) || maxTimePassed) {
      currentZoomTarget = null;
      lastZoomEndTime = now;
    }
  } else if (zoomQueue.length > 0 && now >= (lastZoomEndTime + ZOOM_GAP)) {
    const nextItem = zoomQueue.shift();
    if (players.some(p => p.id === nextItem.playerId)) {
      startZoom(nextItem, now);
    }
  }

  spotlightDarkAlpha = 0;

  if (isDragging) return;

  if (currentZoomTarget) {
    const L = lay[currentZoomTarget.playerId];
    if (L) {
      camera.targetX = (W / 2 - L.ax);
      camera.targetY = -H * 0.05;
      camera.targetZ = getZoomScale(currentZoomTarget.tier);
      lastActivityTime = now;
      return;
    }
  }

  if (now < (lastZoomEndTime + ZOOM_HOLD_AFTER)) {
    lastActivityTime = now;
    return;
  }

  // TH 3: Hết sự kiện và hàng chờ trống -> Mở góc quay rộng và từ từ di chuyển camera bao quát các nhân vật
  if (now - lastActivityTime >= 1000) {
    camera.targetZ = 0.85;

    const activeList = players;
    if (activeList.length <= 1) {
      camera.targetX = 0;
      camera.targetY = -H * 0.035;
    } else {
      let minAx = Infinity, maxAx = -Infinity;
      activeList.forEach(p => {
        const ax = lay[p.id] ? lay[p.id].ax : W * 0.5;
        if (ax < minAx) minAx = ax;
        if (ax > maxAx) maxAx = ax;
      });

      const midAx = (minAx + maxAx) / 2;
      const spanAx = maxAx - minAx;
      const maxWander = Math.min(spanAx * 0.38, Math.max(W * 0.28, 140));

      const idlePhase = (now - lastActivityTime - 1000) * (2 * Math.PI / 14000);
      const idleOffset = Math.sin(idlePhase) * maxWander;

      camera.targetX = (W * 0.5 - midAx) + idleOffset;
      camera.targetY = -H * 0.035 + Math.sin(idlePhase * 0.5) * (H * 0.012);
    }
  }
}

// SETUP PLAYERS
console.log('\n======================================================');
console.log('🏁 BẮT ĐẦU KIỂM THỬ HỆ THỐNG ZOOM ƯU TIÊN VÀ HÀNG CHỜ');
console.log('======================================================\n');

for (let i = 1; i <= 5; i++) {
  players.push({ id: `p-${i}`, username: `Cần thủ ${i}` });
}
mockLayout();

let now = 1000;

// Test 1: Cần thủ 1 câu cá (quà nhỏ 1 xu) -> Camera ZOOM VÀO ngay!
console.log('▶ Test 1: Cần thủ 1 câu cá (quà nhỏ 1 xu)');
requestZoom({ playerId: 'p-1', username: 'Cần thủ 1', giftName: 'Hoa hồng' }, 1, now);
updateSpotlightAndCamera(now, now);

console.log(`   -> Current Zoom: ${currentZoomTarget.username}`);
console.log(`   -> TargetZ: ${camera.targetZ} (Zoom vào: 1.15), TargetX: ${camera.targetX}`);
assert.strictEqual(currentZoomTarget.playerId, 'p-1');
assert.strictEqual(camera.targetZ, 1.15, 'Phải zoom vào 1.15 khi có quà nhỏ');
assert.strictEqual(camera.targetX, W / 2 - lay['p-1'].ax, 'Đưa cần thủ 1 vào giữa màn hình');
console.log('   ✔ Test 1: ĐẠT CHUẨN!\n');

// Test 2: Trong lúc Cần thủ 1 đang được zoom, Cần thủ 2 gửi quà vừa (10 xu), Cần thủ 3 gửi quà lớn (500 xu)
console.log('▶ Test 2: Cần thủ 1 đang lên hình, nhận quà từ Cần thủ 2 (10 xu) và Cần thủ 3 (500 xu)');
now += 500;
requestZoom({ playerId: 'p-2', username: 'Cần thủ 2', giftName: 'Cua' }, 10, now);
requestZoom({ playerId: 'p-3', username: 'Cần thủ 3', giftName: 'Rồng Vàng' }, 500, now);
updateSpotlightAndCamera(now, now);

console.log(`   -> Người đang zoom (giữ nguyên): ${currentZoomTarget.username}`);
console.log(`   -> Số người trong hàng chờ (zoomQueue): ${zoomQueue.length}`);
console.log(`   -> Vị trí 1 trong hàng chờ: ${zoomQueue[0].username} (${zoomQueue[0].coins} xu)`);
console.log(`   -> Vị trí 2 trong hàng chờ: ${zoomQueue[1].username} (${zoomQueue[1].coins} xu)`);

assert.strictEqual(currentZoomTarget.playerId, 'p-1', 'Người đang zoom phải giữ nguyên, không bị ngắt');
assert.strictEqual(zoomQueue.length, 2, 'Có 2 người trong hàng chờ');
assert.strictEqual(zoomQueue[0].playerId, 'p-3', 'Cần thủ 3 (500 xu) được ưu tiên xếp lên vị trí số 1 trong hàng chờ!');
assert.strictEqual(zoomQueue[1].playerId, 'p-2', 'Cần thủ 2 (10 xu) xếp ở vị trí số 2');
console.log('   ✔ Test 2: ĐẠT CHUẨN!\n');

// Test 3: Cần thủ 1 hết thời gian -> Camera tiếp tục zoom vào Cần thủ 3 (500 xu)
console.log('▶ Test 3: Cần thủ 1 hết lượt -> Chuyển zoom sang Cần thủ 3 (quà lớn 500 xu)');
now = currentZoomTarget.minEndTime + 10;
updateSpotlightAndCamera(now, now);
assert.strictEqual(currentZoomTarget, null, 'Cần thủ 1 xong');

now += ZOOM_GAP + 10;
updateSpotlightAndCamera(now, now);
console.log(`   -> Người tiếp tục được zoom: ${currentZoomTarget.username} (${currentZoomTarget.coins} xu)`);
console.log(`   -> TargetZ: ${camera.targetZ} (Cận cảnh quà lớn: 1.45), TargetX: ${camera.targetX}`);
assert.strictEqual(currentZoomTarget.playerId, 'p-3', 'Phải zoom vào Cần thủ 3 (quà lớn hơn)');
assert.strictEqual(camera.targetZ, 1.45, 'Quà lớn zoom cận cảnh 1.45');
assert.strictEqual(camera.targetX, W / 2 - lay['p-3'].ax, 'Đưa Cần thủ 3 vào giữa');
assert.strictEqual(zoomQueue.length, 1, 'Hàng chờ còn lại 1 người (Cần thủ 2)');
console.log('   ✔ Test 3: ĐẠT CHUẨN!\n');

// Test 4: Cần thủ 3 hết thời gian -> Camera tiếp tục zoom vào Cần thủ 2 (quà vừa 10 xu)
console.log('▶ Test 4: Cần thủ 3 hết lượt -> Chuyển zoom sang Cần thủ 2 (quà vừa 10 xu)');
now = currentZoomTarget.minEndTime + 10;
updateSpotlightAndCamera(now, now);
now += ZOOM_GAP + 10;
updateSpotlightAndCamera(now, now);

console.log(`   -> Người tiếp tục được zoom: ${currentZoomTarget.username} (${currentZoomTarget.coins} xu)`);
console.log(`   -> TargetZ: ${camera.targetZ} (Zoom quà vừa: 1.28), TargetX: ${camera.targetX}`);
assert.strictEqual(currentZoomTarget.playerId, 'p-2', 'Phải zoom vào Cần thủ 2');
assert.strictEqual(camera.targetZ, 1.28, 'Quà vừa zoom 1.28');
assert.strictEqual(zoomQueue.length, 0, 'Hàng chờ đã hết');
console.log('   ✔ Test 4: ĐẠT CHUẨN!\n');

// Test 5: Tất cả kết thúc -> Camera giữ một lúc rồi từ từ lui về góc rộng toàn cảnh và di chuyển tuần tra ngắm các nhân vật
console.log('▶ Test 5: Hết sự kiện và hàng chờ -> Camera giữ 1.2s rồi về góc rộng & di chuyển ngắm các nhân vật');
now = currentZoomTarget.minEndTime + 10;
updateSpotlightAndCamera(now, now);
assert.strictEqual(currentZoomTarget, null);

// Trong thời gian giữ (ZOOM_HOLD_AFTER = 1200ms)
now += 800;
updateSpotlightAndCamera(now, now);
assert.notStrictEqual(camera.targetX, 0, 'Đang giữ vị trí trước khi lui về góc rộng');

// Sau khi hết thời gian giữ (bắt đầu chế độ góc rộng & di chuyển tuần tra ngắm các nhân vật)
now += 1500;
updateSpotlightAndCamera(now, now);
console.log(`   -> Target Camera: TargetZ = ${camera.targetZ}, TargetX = ${camera.targetX.toFixed(2)}`);
assert.strictEqual(camera.targetZ, 0.85, 'Đã trở về góc rộng (0.85)');
assert.ok(Number.isFinite(camera.targetX), 'Camera targetX đang di chuyển mượt mà ngắm các nhân vật');
console.log('   ✔ Test 5: ĐẠT CHUẨN!\n');

console.log('========================================================');
console.log('🎉 TẤT CẢ CÁC TEST ZOOM ƯU TIÊN & HÀNG CHỜ ĐÃ VƯỢT QUA 100%!');
console.log('========================================================\n');
