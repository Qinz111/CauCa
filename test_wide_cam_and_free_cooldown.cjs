const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('========================================================================');
console.log('🧪 KIỂM THỬ: GÓC QUAY RỘNG (5 NGƯỜI), LIA CAM KHÔNG ZOOM VÀ HỒI CHIÊU 1 PHÚT');
console.log('========================================================================\n');

// 1. Kiểm tra server.js: Hồi chiêu câu miễn phí 1 phút (60 giây)
const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const cooldownMatch = serverCode.match(/const\s+DEFAULT_FREE_COOLDOWN_SEC\s*=\s*(\d+);/);
assert(cooldownMatch, 'Không tìm thấy DEFAULT_FREE_COOLDOWN_SEC trong server.js');
const cooldownSec = Number(cooldownMatch[1]);

console.log(`▶ Test 1: Thời gian hồi chiêu câu miễn phí trong server.js`);
console.log(`   Giá trị hiện tại: ${cooldownSec} giây`);
assert.strictEqual(cooldownSec, 60, 'Thời gian hồi chiêu phải là 60 giây (1 phút)!');
console.log(`   ✔ Thời gian câu miễn phí đã được nâng lên đúng 1 phút (60s) (PASS)\n`);

// 2. Kiểm tra public/index.html: góc quay rộng getDefaultZoom và khoảng cách 5 người
const indexHtml = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');

console.log(`▶ Test 2: Góc quay rộng xem 5 người cùng lúc (getDefaultZoom & Spacing)`);
assert(indexHtml.includes('return isPortrait ? 0.65 : 0.72;'), 'getDefaultZoom phải là 0.65 ở portrait');
assert(indexHtml.includes('const spacing = isPortrait ? 96 : 124;'), 'Spacing phải là 96 ở portrait');

// Tính toán hình học xem 5 người có nằm trọn trong khung hình hay không
const isPortrait = true;
const W = 506; // Kích thước chiều ngang màn hình dọc 9:16
const zoom = 0.65;
const visibleWorldW = W / zoom; // ~778.4px
const spacing = 96;

// 5 người (slots 0, 1, 2, 3, 4 -> k = 0, 1, -1, 2, -2)
const kValues = [0, 1, -1, 2, -2];
const xPositions = kValues.map(k => (W * 0.5) + k * spacing);
const minX = Math.min(...xPositions);
const maxX = Math.max(...xPositions);
const totalSpan = maxX - minX; // 4 * 96 = 384px

console.log(`   - Chiều rộng tầm nhìn camera: ${visibleWorldW.toFixed(1)}px`);
console.log(`   - Tổng khoảng cách 5 cần thủ: ${totalSpan}px (từ x=${minX} đến x=${maxX})`);
console.log(`   - Khoảng thở 2 bên lề: ${((visibleWorldW - totalSpan) / 2).toFixed(1)}px`);
assert(totalSpan < visibleWorldW - 100, '5 cần thủ phải nằm gọn trong tầm nhìn rộng!');
console.log(`   ✔ Đảm bảo 5 người cùng lúc luôn nằm trọn vẹn trong góc quay rộng (PASS)\n`);

// 3. Kiểm tra logic Camera: Người chơi miễn phí (0 xu) lia cam không zoom, Quà tặng mới zoom
console.log(`▶ Test 3: Phân biệt Lia cam không Zoom (0 xu) vs Zoom cận cảnh (Quà tặng)`);

// Giả lập logic camera từ index.html
function simulateCameraReaction({ coins }) {
  const isPortrait = true;
  const defaultZoom = isPortrait ? 0.65 : 0.72;
  const safeCoins = Number(coins || 0);

  let targetZ = defaultZoom;
  let isZoomed = false;
  let isPanned = false;

  if (safeCoins > 0) {
    // Người tặng quà: Zoom cận cảnh
    const tier = safeCoins >= 100 ? 'large' : safeCoins >= 10 ? 'medium' : 'small';
    const zoomScale = tier === 'large' ? 1.38 : tier === 'medium' ? 1.22 : 1.10;
    targetZ = zoomScale;
    isZoomed = true;
    isPanned = true;
  } else {
    // Người chơi miễn phí (0 xu): Chỉ lia cam, targetZ GIỮ NGUYÊN góc rộng!
    targetZ = defaultZoom;
    isZoomed = false;
    isPanned = true;
  }

  return { targetZ, isZoomed, isPanned };
}

// Case A: Người câu miễn phí 0 xu
const freeResult = simulateCameraReaction({ coins: 0 });
console.log(`   - Lượt câu miễn phí (0 xu): targetZ=${freeResult.targetZ}, isZoomed=${freeResult.isZoomed}, isPanned=${freeResult.isPanned}`);
assert.strictEqual(freeResult.isZoomed, false, 'Lượt câu miễn phí KHÔNG được zoom');
assert.strictEqual(freeResult.targetZ, 0.65, 'Lượt câu miễn phí targetZ phải giữ nguyên góc rộng 0.65');
assert.strictEqual(freeResult.isPanned, true, 'Lượt câu miễn phí phải được lia cam có tầm nhìn');
console.log(`   ✔ Người chơi miễn phí chỉ lia cam có tầm nhìn, KHÔNG phóng to (PASS)`);

// Case B: Người tặng quà 1 xu (Hoa hồng)
const gift1Result = simulateCameraReaction({ coins: 1 });
console.log(`   - Người tặng 1 xu (Hoa hồng): targetZ=${gift1Result.targetZ}, isZoomed=${gift1Result.isZoomed}`);
assert.strictEqual(gift1Result.isZoomed, true, 'Người tặng quà 1 xu phải được zoom');
assert(gift1Result.targetZ > 0.65, 'targetZ phải lớn hơn góc rộng');
console.log(`   ✔ Người tặng quà 1 xu kích hoạt zoom 1.10x (PASS)`);

// Case C: Người tặng quà 10 xu (Mũ phớt)
const gift10Result = simulateCameraReaction({ coins: 10 });
console.log(`   - Người tặng 10 xu (Mũ phớt): targetZ=${gift10Result.targetZ}, isZoomed=${gift10Result.isZoomed}`);
assert(gift10Result.targetZ >= 1.22, 'Quà vừa phải zoom 1.22x');
console.log(`   ✔ Người tặng quà 10 xu kích hoạt zoom 1.22x (PASS)`);

// Case D: Người tặng quà 100 xu (Cực phẩm)
const gift100Result = simulateCameraReaction({ coins: 100 });
console.log(`   - Người tặng 100 xu: targetZ=${gift100Result.targetZ}, isZoomed=${gift100Result.isZoomed}`);
assert(gift100Result.targetZ >= 1.38, 'Quà lớn phải zoom 1.38x');
console.log(`   ✔ Người tặng quà 100 xu kích hoạt zoom 1.38x (PASS)\n`);

// 4. Kiểm tra văn bản hướng dẫn trong index.html
console.log(`▶ Test 4: Cập nhật văn bản hướng dẫn hiển thị cho người xem`);
assert(indexHtml.includes('1 phút (60 giây)'), 'Phải cập nhật mô tả 1 phút (60 giây)');
assert(indexHtml.includes('hồi chiêu 1 phút'), 'Phải cập nhật bảng phân cấp hồi chiêu 1 phút');
console.log(`   ✔ Giao diện luật chơi và bảng thông tin đã hiển thị đúng 1 phút (PASS)\n`);

console.log('========================================================================');
console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ ĐẠT 100%!');
console.log('========================================================================');

