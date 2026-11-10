/**
 * BỘ KIỂM THỬ TOÀN DIỆN: HỆ THỐNG TRỌNG LƯỢNG CÁ, BẢNG XẾP HẠNG & HỒI CHIÊU THẢ TIM
 */
const assert = require('assert');

// 1. Cấu hình Weight Tiers
const DEFAULT_WEIGHT_TIERS = [
  { minCoins: 0, maxCoins: 0, minKg: 0.1, maxKg: 0.5, name: 'Cá nhỏ', fishNames: ['Cá nhỏ', 'Cá rô đồng', 'Cá lòng tong', 'Cá bống'], color: '#72e6cf', rarity: 'common' },
  { minCoins: 1, maxCoins: 9, minKg: 0.5, maxKg: 1.0, name: 'Cá vừa', fishNames: ['Cá vừa', 'Cá diếc', 'Cá rô phi', 'Cá mè hoa'], color: '#7fc8ff', rarity: 'uncommon' },
  { minCoins: 10, maxCoins: 49, minKg: 1.0, maxKg: 3.0, name: 'Cá chép', fishNames: ['Cá chép', 'Cá chép Koi', 'Cá mè', 'Cá trôi'], color: '#93c5fd', rarity: 'uncommon' },
  { minCoins: 50, maxCoins: 99, minKg: 3.0, maxKg: 5.0, name: 'Cá trắm đen', fishNames: ['Cá trắm đen', 'Cá trắm cỏ', 'Cá lóc đồng', 'Cá bống tượng'], color: '#a78bfa', rarity: 'rare' },
  { minCoins: 100, maxCoins: 199, minKg: 5.0, maxKg: 10.0, name: 'Cá tra khổng lồ', fishNames: ['Cá tra khổng lồ', 'Cá trê khổng lồ', 'Cá chình sông', 'Cá basa khổng lồ'], color: '#f472b6', rarity: 'rare' },
  { minCoins: 200, maxCoins: 499, minKg: 10.0, maxKg: 25.0, name: 'Cá hô hoàng gia', fishNames: ['Cá hô hoàng gia', 'Cá chiên sông', 'Cá lăng hoàng kim', 'Cá bông lau'], color: '#fbbf24', rarity: 'epic' },
  { minCoins: 500, maxCoins: 999, minKg: 25.0, maxKg: 50.0, name: 'Cá ngừ đại dương', fishNames: ['Cá ngừ đại dương', 'Cá cờ kiếm', 'Cá mú vàng khổng lồ'], color: '#f59e0b', rarity: 'epic' },
  { minCoins: 1000, maxCoins: 2499, minKg: 50.0, maxKg: 100.0, name: 'Cá voi sát thủ', fishNames: ['Cá voi sát thủ', 'Cá mập trắng', 'Cá đuối manta khổng lồ', 'Cá nhám búa'], color: '#ef4444', rarity: 'legendary' },
  { minCoins: 2500, maxCoins: 4999, minKg: 100.0, maxKg: 200.0, name: 'Thủy quái Kraken', fishNames: ['Thủy quái Kraken', 'Mực khổng lồ ma', 'Cá câu biển sâu', 'Bạch tuộc Hắc Ám'], color: '#ec4899', rarity: 'legendary' },
  { minCoins: 5000, maxCoins: 9999, minKg: 200.0, maxKg: 350.0, name: 'Hải Long Thần', fishNames: ['Hải Long Thần', 'Băng Long', 'Hắc Hải Xà Leviathan', 'Long Vương Biển Cả'], color: '#8b5cf6', rarity: 'mythic' },
  { minCoins: 10000, maxCoins: Infinity, minKg: 350.0, maxKg: 500.0, name: 'Rồng Thần Tối Thượng', fishNames: ['Rồng Thần Tối Thượng', 'Hoàng Kim Long', 'Hư Không Long', 'Thiên Long Vĩnh Hằng'], color: '#eab308', rarity: 'divine' }
];

function getWeightTierIndex(coins = 0) {
  const c = Math.max(0, Number(coins) || 0);
  for (let i = DEFAULT_WEIGHT_TIERS.length - 1; i >= 0; i--) {
    if (c >= DEFAULT_WEIGHT_TIERS[i].minCoins) {
      return i;
    }
  }
  return 0;
}

function getWeightTier(coins = 0) {
  const idx = getWeightTierIndex(coins);
  return DEFAULT_WEIGHT_TIERS[idx] || DEFAULT_WEIGHT_TIERS[0];
}

function selectCatchTier(coins = 0) {
  const baseIdx = getWeightTierIndex(coins);
  const maxIdx = DEFAULT_WEIGHT_TIERS.length - 1;
  const baseTier = DEFAULT_WEIGHT_TIERS[baseIdx] || DEFAULT_WEIGHT_TIERS[0];

  if (baseIdx >= maxIdx) {
    return { tier: baseTier, baseTier, tierJump: 0, isLuckyBonus: false };
  }

  const maxJump = Math.min(2, maxIdx - baseIdx);
  const tierFactor = Math.max(0.65, 1 - (baseIdx / maxIdx) * 0.35);

  const probPlus2 = maxJump >= 2 ? (0.08 * tierFactor) : 0;
  const probPlus1 = maxJump >= 1 ? (0.24 * tierFactor) : 0;

  const rand = Math.random();
  let jump = 0;
  if (rand < probPlus2) {
    jump = 2;
  } else if (rand < probPlus2 + probPlus1) {
    jump = 1;
  } else {
    jump = 0;
  }

  const finalIdx = Math.min(baseIdx + jump, maxIdx);
  const awardedTier = DEFAULT_WEIGHT_TIERS[finalIdx] || baseTier;

  return {
    tier: awardedTier,
    baseTier,
    tierJump: finalIdx - baseIdx,
    isLuckyBonus: finalIdx > baseIdx
  };
}

function generateCatchResult(coins = 0) {
  const selection = selectCatchTier(coins);
  const tier = selection.tier;
  const range = tier.maxKg - tier.minKg;
  const weight = Math.round((tier.minKg + Math.random() * range) * 100) / 100;
  const names = Array.isArray(tier.fishNames) && tier.fishNames.length > 0 ? tier.fishNames : [tier.name];
  const chosenName = names[Math.floor(Math.random() * names.length)];
  return {
    tier,
    baseTier: selection.baseTier,
    tierJump: selection.tierJump,
    isLuckyBonus: selection.isLuckyBonus,
    weight,
    name: chosenName
  };
}

// 2. Logic Cooldown & Like
const DEFAULT_FREE_COOLDOWN_SEC = 45;
const MIN_FREE_COOLDOWN_SEC = 5;

function handlePlayerLike(player, count = 1) {
  if (!player || count <= 0) return { reducedSec: 0, currentCooldownSec: DEFAULT_FREE_COOLDOWN_SEC };
  player.totalLikes = (player.totalLikes || 0) + count;
  player.pendingLikes = (player.pendingLikes || 0) + count;
  const reducedSec = Math.floor(player.pendingLikes / 100);
  if (reducedSec > 0) {
    player.pendingLikes = player.pendingLikes % 100;
    const oldCooldown = player.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC;
    const newCooldown = Math.max(MIN_FREE_COOLDOWN_SEC, oldCooldown - reducedSec);
    player.currentCooldownSec = newCooldown;
    return { reducedSec, currentCooldownSec: newCooldown };
  }
  return { reducedSec: 0, currentCooldownSec: player.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC };
}

// 3. Logic Xếp hạng
function rankPlayers(playersList) {
  return [...playersList].sort((a, b) => {
    const diffW = (b.totalWeight || 0) - (a.totalWeight || 0);
    if (Math.abs(diffW) > 0.0001) return diffW;
    const diffH = (b.heaviestFish || 0) - (a.heaviestFish || 0);
    if (Math.abs(diffH) > 0.0001) return diffH;
    return a.joinedAt - b.joinedAt;
  });
}

// 4. Logic Gift Catalog
const catalog = {
  5655: { name: 'Hoa hồng', coins: 1 },
  5509: { name: 'Mũ phớt', coins: 10 },
  5881: { name: 'Rồng Vàng', coins: 500 }
};

function resolveGift(data) {
  const gid = data.giftId || data.gift?.id;
  const repeatCount = Math.max(1, Number(data.repeatCount || 1));
  if (gid && catalog[gid]) {
    return { isUnknown: false, coinCost: catalog[gid].coins * repeatCount };
  }
  return { isUnknown: true, coinCost: 0 };
}

console.log('===============================================================');
console.log('🏁 BẮT ĐẦU KIỂM THỬ: HỆ THỐNG TRỌNG LƯỢNG, BXH & HỒI CHIÊU LIKE');
console.log('===============================================================');

// TEST 1: Phân cấp trọng lượng 11 bậc xu & Cơ chế may mắn nổ cá bậc cao hơn (tối đa 2 bậc, tỉ lệ <= 40%)
console.log('\n▶ Test 1: Kiểm thử Phân Cấp Trọng Lượng & Cơ Chế May Mắn Nổ Cá Bậc Cao');
const testCoins = [0, 5, 20, 80, 150, 350, 800, 1500, 3000, 7000, 15000];
testCoins.forEach(coin => {
  const baseIdx = getWeightTierIndex(coin);
  const baseTier = DEFAULT_WEIGHT_TIERS[baseIdx];
  const pickedNames = new Set();
  let upgrades = 0;
  let jumps = { 0: 0, 1: 0, 2: 0 };
  const SAMPLES = 500;

  for (let k = 0; k < SAMPLES; k++) {
    const res = generateCatchResult(coin);
    assert(res.weight >= res.tier.minKg && res.weight <= res.tier.maxKg,
      `Lỗi trọng lượng ${res.weight} không nằm trong [${res.tier.minKg}, ${res.tier.maxKg}] cho tier trúng thưởng`);
    assert(res.tier.fishNames.includes(res.name),
      `Lỗi tên cá "${res.name}" không thuộc danh sách tier: [${res.tier.fishNames.join(', ')}]`);
    assert(res.tierJump <= 2 && res.tierJump >= 0,
      `Lỗi tierJump (${res.tierJump}) vượt quá giới hạn 2 bậc so với bậc gốc`);
    pickedNames.add(res.name);
    jumps[res.tierJump] = (jumps[res.tierJump] || 0) + 1;
    if (res.isLuckyBonus) upgrades++;
  }

  const upgradeRate = (upgrades / SAMPLES) * 100;
  assert(upgradeRate <= 40, `Tỉ lệ nổ cá bậc cao (${upgradeRate}%) vượt quá 40%`);
  if (baseIdx <= DEFAULT_WEIGHT_TIERS.length - 3) {
    assert(jumps[2] <= jumps[1], `Tỉ lệ nhảy +2 bậc (${jumps[2]}) phải thấp hơn hoặc bằng +1 bậc (${jumps[1]})`);
  }
  console.log(`   ✔ ${coin} xu (Gốc: ${baseTier.name}) -> Nổ cá bậc cao: ${upgradeRate.toFixed(1)}% (<= 40%), Nhảy +1: ${jumps[1]}, Nhảy +2: ${jumps[2]} (PASS)`);
});

// TEST 2: Bảng Xếp Hạng theo totalWeight & tie-break bằng heaviestFish
console.log('\n▶ Test 2: Kiểm thử Bảng Xếp Hạng theo Trọng Lượng (kg) & Cá Nặng Nhất');
const mockPlayers = [
  { id: '1', username: 'Cần thủ A', totalWeight: 15.5, heaviestFish: 4.2, joinedAt: 1000 },
  { id: '2', username: 'Cần thủ B (Bằng kg nhưng cá nặng nhất to hơn)', totalWeight: 20.0, heaviestFish: 8.5, joinedAt: 2000 },
  { id: '3', username: 'Cần thủ C (Bằng kg nhưng cá nặng nhất nhỏ hơn)', totalWeight: 20.0, heaviestFish: 6.0, joinedAt: 1500 },
  { id: '4', username: 'Cần thủ D', totalWeight: 5.2, heaviestFish: 2.1, joinedAt: 3000 }
];

const ranked = rankPlayers(mockPlayers);
assert.strictEqual(ranked[0].username, 'Cần thủ B (Bằng kg nhưng cá nặng nhất to hơn)');
assert.strictEqual(ranked[1].username, 'Cần thủ C (Bằng kg nhưng cá nặng nhất nhỏ hơn)');
assert.strictEqual(ranked[2].username, 'Cần thủ A');
assert.strictEqual(ranked[3].username, 'Cần thủ D');
console.log('   ✔ Top 1: ' + ranked[0].username + ' (Total: ' + ranked[0].totalWeight + 'kg, Max: ' + ranked[0].heaviestFish + 'kg)');
console.log('   ✔ Top 2: ' + ranked[1].username + ' (Total: ' + ranked[1].totalWeight + 'kg, Max: ' + ranked[1].heaviestFish + 'kg)');
console.log('   ✔ Tie-break hoạt động chính xác 100%!');

// TEST 3: Thả Tim Giảm Hồi Chiêu
console.log('\n▶ Test 3: Kiểm thử Thả Tim Giảm Hồi Chiêu (100 tim = -1s, tối thiểu 5s)');
let p = { totalLikes: 0, pendingLikes: 0, currentCooldownSec: 45 };

// 100 tim -> 44s
let r = handlePlayerLike(p, 100);
assert.strictEqual(r.currentCooldownSec, 44);
assert.strictEqual(p.pendingLikes, 0);
console.log('   ✔ 100 tim -> Hồi chiêu: 44s (PASS)');

// Thêm 50 tim -> dư 50 tim, chưa giảm
r = handlePlayerLike(p, 50);
assert.strictEqual(r.reducedSec, 0);
assert.strictEqual(r.currentCooldownSec, 44);
assert.strictEqual(p.pendingLikes, 50);
console.log('   ✔ Thêm 50 tim -> Chưa đủ 100 tim, giữ lại 50 tim dư (PASS)');

// Thêm 50 tim nữa -> đủ 100 tim -> giảm còn 43s
r = handlePlayerLike(p, 50);
assert.strictEqual(r.reducedSec, 1);
assert.strictEqual(r.currentCooldownSec, 43);
assert.strictEqual(p.pendingLikes, 0);
console.log('   ✔ Thêm tiếp 50 tim -> Đủ 100 tim -> Hồi chiêu: 43s (PASS)');

// Thả thêm 3800 tim -> giảm 38s -> còn 5s (chạm sàn tối thiểu)
r = handlePlayerLike(p, 3800);
assert.strictEqual(r.currentCooldownSec, 5);
console.log('   ✔ Thả 3.800 tim -> Hồi chiêu giảm xuống mức tối thiểu: 5s (PASS)');

// Thả thêm 10.000 tim -> vẫn giữ 5s, không bao giờ bị âm!
r = handlePlayerLike(p, 10000);
assert.strictEqual(r.currentCooldownSec, 5);
console.log('   ✔ Thả 10.000 tim -> Chặn sàn tối thiểu 5s, không bị âm (PASS)');

// TEST 4: Gift Catalog & Unknown Gift Detection
console.log('\n▶ Test 4: Tra Cứu Gift Catalog & Phát Hiện Quà Chưa Xác Định');
const giftKnown = resolveGift({ giftId: 5881, repeatCount: 2 });
assert.strictEqual(giftKnown.isUnknown, false);
assert.strictEqual(giftKnown.coinCost, 1000);
console.log('   ✔ Quà đã có trong Catalog: ID 5881 x2 = 1.000 xu (PASS)');

const giftUnknown = resolveGift({ giftId: 999999 });
assert.strictEqual(giftUnknown.isUnknown, true);
assert.strictEqual(giftUnknown.coinCost, 0);
console.log('   ✔ Quà chưa có trong Catalog: Đánh dấu isUnknown = true, không kích hoạt sai quà (PASS)');

console.log('\n===============================================================');
console.log('🎉 TẤT CẢ 4 BỘ TEST TRỌNG LƯỢNG, BXH & LIKE COOLDOWN ĐÃ ĐẠT 100%!');
console.log('===============================================================');

