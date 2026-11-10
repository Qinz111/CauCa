const assert = require('assert');

// Mock helpers from index.html
function formatFishName(name) {
  if (!name) return 'Cá đồng';
  return String(name).trim();
}

function getCatchPriority(e) {
  const weightVal = Number(e.fish?.weight || 0);
  const coins = Number(e.coins || 0);
  const isLucky = Boolean(e.fish?.isLuckyBonus);
  const tierJump = Number(e.fish?.tierJump || 0);
  const rawFishName = String(e.fish?.name || '').toLowerCase();
  if (coins >= 5000 || weightVal >= 200 || (isLucky && tierJump >= 2) || rawFishName.includes('long') || rawFishName.includes('rồng') || rawFishName.includes('leviathan')) return 5;
  if (coins >= 1000 || weightVal >= 50 || rawFishName.includes('kraken') || rawFishName.includes('mập') || rawFishName.includes('voi')) return 4;
  if (coins >= 100 || weightVal >= 5 || (isLucky && tierJump >= 1)) return 3;
  if (coins >= 10 || weightVal >= 1) return 2;
  return 1;
}

function buildCatchSentence(e) {
  const username = e.username || 'Cần thủ';
  const rawFishName = e.fish?.name || 'Cá đồng';
  const fishName = formatFishName(rawFishName);
  const weightVal = Number(e.fish?.weight || 0);
  const isLucky = Boolean(e.fish?.isLuckyBonus);
  const tierJump = Number(e.fish?.tierJump || 0);
  const coins = Number(e.coins || 0);
  const n = String(rawFishName).toLowerCase();

  // 1. May mắn nổ cá vượt cấp
  if (isLucky && tierJump >= 2) {
    return `Oa đại may mắn! Cần thủ ${username} nổ được một bé ${fishName} nha!`;
  }
  if (isLucky && tierJump === 1) {
    return `Woa may mắn quá! Cần thủ ${username} giật trúng một bé ${fishName} nè!`;
  }

  // 2. Nhóm Rồng Thần Tối Thượng (Tier 10: 10000+ xu / 350-500kg)
  if (coins >= 10000 || weightVal >= 350 || ['rồng thần tối thượng', 'hoàng kim long', 'hư không long', 'thiên long vĩnh hằng'].some(k => n.includes(k))) {
    return `Trời đất ơi! Thần Long xuất thế! Chúc mừng cần thủ ${username} thu phục được ${fishName}! Đỉnh nóc kịch trần luôn nha!`;
  }

  // 3. Nhóm Hải Long Thần & Leviathan (Tier 9: 5000-9999 xu / 200-350kg)
  if (coins >= 5000 || weightVal >= 200 || ['hải long thần', 'băng long', 'leviathan', 'long vương biển cả', 'hắc hải xà'].some(k => n.includes(k))) {
    return `Oa chấn động đại dương! Cần thủ ${username} vừa săn được đại thần thú ${fishName} nè!`;
  }

  // 4. Nhóm Thủy Quái Kraken & Vực Sâu (Tier 8: 2500-4999 xu / 100-200kg)
  if (coins >= 2500 || weightVal >= 100 || ['thủy quái kraken', 'mực khổng lồ ma', 'cá câu biển sâu', 'bạch tuộc hắc ám'].some(k => n.includes(k))) {
    return `Kinh ngạc chưa kìa! Cần thủ ${username} vừa kéo tung nóc thủy quái ${fishName} từ biển sâu!`;
  }

  // 5. Nhóm Hung Thần Đại Dương (Tier 7: 1000-2499 xu / 50-100kg)
  if (coins >= 1000 || weightVal >= 50 || ['cá voi sát thủ', 'cá mập trắng', 'cá đuối manta khổng lồ', 'cá nhám búa'].some(k => n.includes(k))) {
    return `Đẳng cấp thật sự! Chúc mừng ${username} đã tóm gọn hung thần ${fishName} rồi nha!`;
  }

  // 6. Nhóm Cực Phẩm Đại Dương (Tier 6: 500-999 xu / 25-50kg)
  if (coins >= 500 || weightVal >= 25 || ['cá ngừ đại dương', 'cá cờ kiếm', 'cá mú vàng khổng lồ'].some(k => n.includes(k))) {
    return `Tuyệt vời quá đi! Chúc mừng ${username} giật trúng cực phẩm ${fishName} nha!`;
  }

  // 7. Nhóm Thủy Quái Sông & Cá Khủng (Tier 5 & 4: 100-499 xu / 5-25kg)
  if (coins >= 100 || weightVal >= 5 || ['cá hô hoàng gia', 'cá chiên sông', 'cá lăng hoàng kim', 'cá bông lau', 'cá tra khổng lồ', 'cá trê khổng lồ', 'cá chình sông', 'cá basa khổng lồ'].some(k => n.includes(k))) {
    return `Trời ơi đỉnh chóp! Chúc mừng cần thủ ${username} kéo được ${fishName} siêu khủng nè!`;
  }

  // 8. Nhóm Cá Quý & Cá Hiếm (Tier 3 & 2: 10-99 xu / 1-5kg)
  if (coins >= 10 || weightVal >= 1 || ['cá trắm đen', 'cá trắm cỏ', 'cá lóc đồng', 'cá bống tượng', 'cá chép', 'cá chép koi', 'cá mè', 'cá trôi'].some(k => n.includes(k))) {
    return `Xuất sắc quá! Chúc mừng ${username} câu dính ${fishName} nha!`;
  }

  // 9. Cá nhỏ / phổ thông
  return `Chúc mừng ${username} câu được một bé ${fishName} nha!`;
}

console.log('\n======================================================');
console.log('🧪 TEST BỘ CÂU THOẠI THÔNG BÁO: KHÔNG ĐỌC SỐ CÂN (KG)');
console.log('======================================================\n');

const testCases = [
  { desc: 'Cá nhỏ thường (0.85 kg)', e: { username: 'Minh', fish: { name: 'Cá rô phi', weight: 0.85 } } },
  { desc: 'Cá vừa (4.20 kg)', e: { username: 'Lan', fish: { name: 'Cá chép Koi', weight: 4.20 }, coins: 20 } },
  { desc: 'Cá khủng (15.50 kg, 200 xu)', e: { username: 'Tuấn', fish: { name: 'Cá tra khổng lồ', weight: 15.50 }, coins: 200 } },
  { desc: 'Cá voi sát thủ (85.00 kg, 1500 xu)', e: { username: 'Đạt', fish: { name: 'Cá voi sát thủ', weight: 85.00 }, coins: 1500 } },
  { desc: 'Thủy quái Kraken (150.00 kg, 3000 xu)', e: { username: 'Bảo', fish: { name: 'Thủy quái Kraken', weight: 150.00 }, coins: 3000 } },
  { desc: 'Bạch tuộc Hắc Ám (120.00 kg, 2600 xu)', e: { username: 'Phong', fish: { name: 'Bạch tuộc Hắc Ám', weight: 120.00 }, coins: 2600 } },
  { desc: 'Cá nhám búa (75.00 kg, 1200 xu)', e: { username: 'Huy', fish: { name: 'Cá nhám búa', weight: 75.00 }, coins: 1200 } },
  { desc: 'Hải Long Thần (280.00 kg, 6000 xu)', e: { username: 'Kiên', fish: { name: 'Hải Long Thần', weight: 280.00 }, coins: 6000 } },
  { desc: 'Rồng Thần Tối Thượng (450.00 kg, 12000 xu)', e: { username: 'Hoàng Kim', fish: { name: 'Rồng Thần Tối Thượng', weight: 450.00 }, coins: 12000 } },
  { desc: 'May mắn nổ cá +1 bậc', e: { username: 'Hồng', fish: { name: 'Cá cờ kiếm', weight: 8.30, isLuckyBonus: true, tierJump: 1 }, coins: 50 } },
  { desc: 'Đại may mắn nổ cá +2 bậc', e: { username: 'Hoàng', fish: { name: 'Thiên Long Vĩnh Hằng', weight: 58.00, isLuckyBonus: true, tierJump: 2 }, coins: 300 } },
];

testCases.forEach((tc, idx) => {
  const sentence = buildCatchSentence(tc.e);
  console.log(`▶ Test 1.${idx + 1}: ${tc.desc}`);
  console.log(`   -> Câu đọc: "${sentence}"`);

  assert.strictEqual(/nặng/i.test(sentence), false, 'Không được có từ "nặng"');
  assert.strictEqual(/kg/i.test(sentence), false, 'Không được có từ "kg"');
  assert.strictEqual(/ki-lô-gam/i.test(sentence), false, 'Không được có từ "ki-lô-gam"');
  assert.strictEqual(/\d+\s*(kg|cân)/i.test(sentence), false, 'Không được đọc số cân');
  console.log('   ✔ PASS: Câu thoại ngắn gọn, tươi vui, hoàn toàn không đọc số cân!\n');
});

console.log('========================================================================');
console.log('🧪 TEST: KHI CHUYỂN CẢNH QUA THÌ MỚI BẮT ĐẦU BƯỚC CẮN (BITE)');
console.log('========================================================================\n');

// Mock state
let currentZoomTarget = null;
let currentPresentingPlayerId = null;
let isPresentingCatch = false;
const catchPresentationQueue = [];
const approachingCatches = new Map();
const activeCatches = new Map();
const eventTimeline = [];

function startZoom(item) {
  currentZoomTarget = { ...item };
  eventTimeline.push(`[CAMERA] Chuyển cảnh camera zoom vào: ${item.username} (${item.playerId})`);
}

function onFishingApproachEvent(e) {
  const pid = e.playerId;
  if (isPresentingCatch) {
    // Đang có người khác được chiếu và đọc thông báo:
    // Đừng cắn câu ngoài khung hình!
    eventTimeline.push(`[BLOCKED BITE] Bỏ qua cắn câu ngoài khung hình cho: ${e.username} (${pid})`);
    return;
  }
  approachingCatches.set(pid, { ...e, start: Date.now() });
  eventTimeline.push(`[BITE] 🐟 ${e.username} (${pid}) BẮT ĐẦU BƯỚC CẮN (BITE)! Phao nhấp nhô gợn sóng!`);
}

function onFishingCatchEvent(e) {
  const pid = e.playerId;
  showCatchBoard(e);
}

function showCatchBoard(e) {
  const priority = getCatchPriority(e);
  const sentence = buildCatchSentence(e);
  const item = { e, sentence, priority, time: Date.now() };

  if (isPresentingCatch) {
    if (priority > 1) {
      const insertIdx = catchPresentationQueue.findIndex(q => q.priority < priority);
      if (insertIdx !== -1) {
        catchPresentationQueue.splice(insertIdx, 0, item);
      } else {
        catchPresentationQueue.push(item);
      }
    } else {
      catchPresentationQueue.push(item);
    }
    eventTimeline.push(`[QUEUE] Đưa vào hàng chờ: ${e.username} (${e.playerId}, Priority ${priority})`);
    return;
  }

  const pid = e.playerId;
  if (pid && approachingCatches.has(pid)) {
    presentCatchItem(item);
  } else {
    presentCatchItemWithBite(item);
  }
}

function presentCatchItemWithBite(item) {
  isPresentingCatch = true;
  const playerId = item.e.playerId;
  currentPresentingPlayerId = playerId;

  startZoom({ playerId, username: item.e.username });

  // 1. KHI CHUYỂN CẢNH QUA MỚI BẮT ĐẦU BƯỚC CẮN (BITE)!
  approachingCatches.set(playerId, { ...item.e, start: Date.now() });
  eventTimeline.push(`[BITE] 🐟 ${item.e.username} (${playerId}) BẮT ĐẦU BƯỚC CẮN (BITE)! Cần rung lắc, phao nhấp nhô gợn sóng!`);
}

function triggerCatchAfterBite(item) {
  // 2. Sau bước cắn câu -> Mới bắt đầu GIẬT CẦN (Catch)
  presentCatchItem(item);
}

function presentCatchItem(item) {
  isPresentingCatch = true;
  const playerId = item.e.playerId;
  currentPresentingPlayerId = playerId;
  approachingCatches.delete(playerId);
  activeCatches.set(playerId, { ...item.e, start: Date.now() });
  eventTimeline.push(`[ROD PULL] 🎣 ${item.e.username} (${playerId}) GIẬT CẦN! Cá bay vút lên từ mặt nước!`);
  eventTimeline.push(`[PRESENT] Hiện bảng thông báo & Đọc giọng nữ cho: ${item.e.username} - "${item.sentence}"`);
}

function mockFinishSpeakingAndTransition() {
  eventTimeline.push(`[VOICE] Đã đọc xong trọn vẹn thông báo cho: ${currentPresentingPlayerId}`);
  eventTimeline.push(`[CARD] Ẩn bảng thông báo của: ${currentPresentingPlayerId}`);

  isPresentingCatch = false;
  currentPresentingPlayerId = null;

  if (catchPresentationQueue.length > 0) {
    const nextItem = catchPresentationQueue.shift();
    const nextPid = nextItem.e.playerId;

    // 1. Chuyển cảnh camera sang người tiếp theo trước!
    if (nextPid) {
      startZoom({ playerId: nextPid, username: nextItem.e.username });
    }

    // 2. KHI CHUYỂN CẢNH QUA THÌ MỚI BẮT ĐẦU BƯỚC CẮN (BITE)!
    presentCatchItemWithBite(nextItem);
  } else {
    eventTimeline.push('[SYSTEM] Đã hoàn tất tất cả thông báo trong hàng chờ');
  }
}

// =================== KỊCH BẢN MÔ PHỎNG CHI TIẾT ===================

// Bước 1: Cần thủ A tiếp cận cá -> Bắt đầu cắn câu (Bite) -> Giật cần (Catch)
console.log('▶ Bước 1: Cần thủ A có cá cắn câu -> Giật cần');
onFishingApproachEvent({ playerId: 'p-A', username: 'Cần thủ A', coins: 1 });
assert.strictEqual(approachingCatches.has('p-A'), true, 'Cần thủ A đang cắn câu');

onFishingCatchEvent({ playerId: 'p-A', username: 'Cần thủ A', fish: { name: 'Cá rô phi', weight: 1.2 }, coins: 1 });
assert.strictEqual(activeCatches.has('p-A'), true, 'Cần thủ A giật cần kéo cá lên');
assert.strictEqual(currentPresentingPlayerId, 'p-A');
console.log('   ✔ Cần thủ A đang giật cần và được đọc thông báo');

// Bước 2: Khi Cần thủ A ĐANG ĐƯỢC ĐỌC, Cần thủ B và Cần thủ C phát sinh sự kiện câu cá
console.log('\n▶ Bước 2: Khi Cần thủ A ĐANG ĐƯỢC ĐỌC, Cần thủ B và C phát sinh sự kiện');
onFishingApproachEvent({ playerId: 'p-B', username: 'Cần thủ B', coins: 10 });
onFishingCatchEvent({ playerId: 'p-B', username: 'Cần thủ B', fish: { name: 'Cá trắm', weight: 4.5 }, coins: 10 });

onFishingApproachEvent({ playerId: 'p-C', username: 'Cần thủ C', coins: 500 });
onFishingCatchEvent({ playerId: 'p-C', username: 'Cần thủ C', fish: { name: 'Hải Long Thần', weight: 35.0, isLuckyBonus: true, tierJump: 2 }, coins: 500 });

// Cần thủ B và C TUYỆT ĐỐI CHƯA ĐƯỢC BẮT ĐẦU BƯỚC CẮN VÀ CHƯA ĐƯỢC GIẬT CẦN!
assert.strictEqual(approachingCatches.has('p-B'), false, 'Cần thủ B CHƯA BẮT ĐẦU CẮN CÂU ngoài khung hình!');
assert.strictEqual(approachingCatches.has('p-C'), false, 'Cần thủ C CHƯA BẮT ĐẦU CẮN CÂU ngoài khung hình!');
assert.strictEqual(activeCatches.has('p-B'), false, 'Cần thủ B CHƯA GIẬT CẦN!');
assert.strictEqual(activeCatches.has('p-C'), false, 'Cần thủ C CHƯA GIẬT CẦN!');
assert.strictEqual(currentPresentingPlayerId, 'p-A', 'Cần thủ A vẫn giữ nguyên');
console.log('   ✔ Chuẩn 100%: Cần thủ B và C vẫn bình tĩnh chờ, chưa cắn câu và chưa giật cần!');

// Bước 3: Cần thủ A đọc xong -> Chuyển cảnh sang Cần thủ C (Ưu tiên cá khủng) -> KHI CHUYỂN CẢNH QUA THÌ C MỚI BẮT ĐẦU BƯỚC CẮN (BITE)!
console.log('\n▶ Bước 3: Cần thủ A đọc xong -> Chuyển cảnh sang Cần thủ C -> C MỚI BẮT ĐẦU BƯỚC CẮN (BITE)!');
mockFinishSpeakingAndTransition();

assert.strictEqual(currentPresentingPlayerId, 'p-C');
assert.strictEqual(currentZoomTarget.playerId, 'p-C');
assert.strictEqual(approachingCatches.has('p-C'), true, 'Cần thủ C BẮT ĐẦU BƯỚC CẮN CÂU (BITE) khi camera đã lia tới!');
assert.strictEqual(activeCatches.has('p-C'), false, 'Cần thủ C CHƯA giật cần, đang ở bước Cắn!');
console.log('   ✔ Chuẩn: Camera đã chuyển qua C, C mới bắt đầu bước Cắn (Bite)!');

// Bước 3.5: Sau nhịp cắn câu (~1s) -> C mới giật cần (Catch)!
console.log('\n▶ Bước 3.5: Cần thủ C cắn câu xong -> Bắt đầu giật cần (Catch)');
triggerCatchAfterBite({ e: { playerId: 'p-C', username: 'Cần thủ C', fish: { name: 'Hải Long Thần', weight: 35.0 }, coins: 500 }, sentence: 'Oa, đại may mắn...' });

assert.strictEqual(approachingCatches.has('p-C'), false, 'Đã xong bước cắn câu');
assert.strictEqual(activeCatches.has('p-C'), true, 'Cần thủ C bắt đầu giật cần!');
console.log('   ✔ Chuẩn: Cần thủ C giật cần câu cá lên!');

// Bước 4: Cần thủ C đọc xong -> Chuyển cảnh sang Cần thủ B -> KHI CHUYỂN CẢNH QUA THÌ B MỚI BẮT ĐẦU BƯỚC CẮN (BITE)!
console.log('\n▶ Bước 4: Cần thủ C đọc xong -> Chuyển cảnh sang Cần thủ B -> B MỚI BẮT ĐẦU BƯỚC CẮN (BITE)!');
mockFinishSpeakingAndTransition();

assert.strictEqual(currentPresentingPlayerId, 'p-B');
assert.strictEqual(currentZoomTarget.playerId, 'p-B');
assert.strictEqual(approachingCatches.has('p-B'), true, 'Cần thủ B BẮT ĐẦU BƯỚC CẮN CÂU (BITE) khi camera đã lia tới!');
assert.strictEqual(activeCatches.has('p-B'), false, 'Cần thủ B CHƯA giật cần, đang ở bước Cắn!');
console.log('   ✔ Chuẩn: Camera đã chuyển qua B, B mới bắt đầu bước Cắn (Bite)!');

// Bước 4.5: Sau nhịp cắn câu (~1s) -> B mới giật cần (Catch)!
console.log('\n▶ Bước 4.5: Cần thủ B cắn câu xong -> Bắt đầu giật cần (Catch)');
triggerCatchAfterBite({ e: { playerId: 'p-B', username: 'Cần thủ B', fish: { name: 'Cá trắm', weight: 4.5 }, coins: 10 }, sentence: 'Xuất sắc quá...' });

assert.strictEqual(approachingCatches.has('p-B'), false, 'Đã xong bước cắn câu');
assert.strictEqual(activeCatches.has('p-B'), true, 'Cần thủ B bắt đầu giật cần!');
console.log('   ✔ Chuẩn: Cần thủ B giật cần câu cá lên!');

// Bước 5: Cần thủ B đọc xong -> Hoàn tất
console.log('\n▶ Bước 5: Cần thủ B đọc xong -> Kết thúc hàng chờ');
mockFinishSpeakingAndTransition();
assert.strictEqual(currentPresentingPlayerId, null);
assert.strictEqual(catchPresentationQueue.length, 0);

console.log('\n--- Nhật ký hoạt động toàn bộ quá trình (Timeline) ---');
eventTimeline.forEach(log => console.log('  ' + log));

console.log('\n========================================================================');
console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ: ĐẠT 100%! ĐÚNG CHUẨN KHI CHUYỂN CẢNH MỚI BẮT ĐẦU CẮN (BITE)!');
console.log('========================================================================\n');
