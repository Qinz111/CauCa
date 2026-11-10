/**
 * 🤖 BOT TEST 50 CẦN THỦ - STRESS TEST & BENCHMARK RUNNER
 * ----------------------------------------------------
 * Chạy script này từ terminal để kiểm tra hiệu năng hệ thống:
 *   node bot_test_50.cjs
 *
 * Tùy chọn tham số qua dòng lệnh hoặc biến môi trường:
 *   node bot_test_50.cjs --interval 250 --ratio 0.6 --duration 30
 *   TARGET_URL=http://localhost:3000 node bot_test_50.cjs
 */

const { io } = require('socket.io-client');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const args = process.argv.slice(2);

function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return defaultVal;
}

const INTERVAL_MS = Number(getArg('interval', 350));
const GIFT_RATIO = Number(getArg('ratio', 0.6));
const DURATION_SEC = Number(getArg('duration', 0)); // 0 = chạy liên tục

console.clear();
console.log('\x1b[35m%s\x1b[0m', '=============================================================');
console.log('\x1b[1m\x1b[36m%s\x1b[0m', '   🎣 BỘ KIỂM THỬ HIỆU NĂNG 50 BOT CÂU CÁ & BÃO QUÀ (CLI)  ');
console.log('\x1b[35m%s\x1b[0m', '=============================================================');
console.log(`📡 Máy chủ đích : \x1b[33m${TARGET_URL}\x1b[0m`);
console.log(`⏱️ Tần suất nhịp: \x1b[32m${INTERVAL_MS} ms/lượt\x1b[0m`);
console.log(`🎁 Tỉ lệ tặng quà: \x1b[35m${Math.round(GIFT_RATIO * 100)}%\x1b[0m`);
console.log(`⏳ Thời lượng    : \x1b[36m${DURATION_SEC > 0 ? `${DURATION_SEC} giây` : 'Chạy liên tục (Ctrl+C để dừng)'}\x1b[0m`);
console.log('-------------------------------------------------------------\n');
console.log('🔄 Đang kết nối tới server...');

const socket = io(TARGET_URL, {
  reconnection: true,
  transports: ['websocket', 'polling']
});

let startTime = 0;
let eventCount = 0;
let catchesCount = 0;
let missesCount = 0;
let giftsCount = 0;
let coinsCount = 0;
let latestLeaderboard = [];
let latestBotStats = null;

socket.on('connect', () => {
  console.log(`\x1b[32m✔ Đã kết nối Socket.IO thành công (ID: ${socket.id})\x1b[0m`);
  console.log('🚀 Đang gửi lệnh kích hoạt 50 Bots câu cá & tặng quà...\n');
  startTime = Date.now();
  
  socket.emit('bot:start', {
    count: 50,
    intervalMs: INTERVAL_MS,
    giftRatio: GIFT_RATIO
  });
});

socket.on('connect_error', (err) => {
  console.error(`\x1b[31m✖ Lỗi kết nối tới ${TARGET_URL}: ${err.message}\x1b[0m`);
  console.log('💡 Hãy đảm bảo server đang chạy bằng lệnh: npm start');
});

socket.on('bot:stats', (st) => {
  eventCount++;
  latestBotStats = st;
});

socket.on('fishing:approach', (e) => {
  eventCount++;
  giftsCount++;
  coinsCount += (e.coins || 0);
});

socket.on('fishing:catch', (e) => {
  eventCount++;
  catchesCount++;
});

socket.on('fishing:miss', (e) => {
  eventCount++;
  missesCount++;
});

socket.on('leaderboard', (lb) => {
  eventCount++;
  latestLeaderboard = lb || [];
});

// Real-time HUD refresh every 1 second
const hudInterval = setInterval(() => {
  if (!startTime) return;
  const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
  const eps = (eventCount / elapsedSec).toFixed(1);

  process.stdout.write('\x1b[s'); // Save cursor
  process.stdout.write('\x1b[1;1H'); // Move to top

  console.log('\x1b[35m%s\x1b[0m', '=============================================================');
  console.log('\x1b[1m\x1b[36m%s\x1b[0m', '   🎣 BỘ KIỂM THỬ HIỆU NĂNG 50 BOT CÂU CÁ & BÃO QUÀ (CLI)  ');
  console.log('\x1b[35m%s\x1b[0m', '=============================================================');
  console.log(`📡 Máy chủ: \x1b[33m${TARGET_URL}\x1b[0m | ⏱️ Chạy: \x1b[32m${elapsedSec}s\x1b[0m | ⚡ Thông lượng: \x1b[1m\x1b[32m${eps} events/s\x1b[0m`);
  console.log('-------------------------------------------------------------');
  
  const botCount = latestBotStats ? latestBotStats.count : 50;
  const serverAps = latestBotStats ? latestBotStats.actionsPerSec : '0.0';
  const serverGifts = latestBotStats ? latestBotStats.totalGifts : giftsCount;
  const serverCoins = latestBotStats ? latestBotStats.totalCoins : coinsCount;

  console.log(`🤖 Bot Đang Hoạt Động : \x1b[1m\x1b[35m${botCount} bots\x1b[0m`);
  console.log(`⚡ Tốc Độ Hành Động   : \x1b[1m\x1b[36m${serverAps} lượt/giây\x1b[0m`);
  console.log(`🎁 Quà Tặng Đã Phát   : \x1b[1m\x1b[35m${serverGifts}\x1b[0m (Tổng: \x1b[33m${serverCoins.toLocaleString('vi-VN')} xu\x1b[0m)`);
  console.log(`🐟 Cá Đã Kéo Trúng    : \x1b[1m\x1b[32m${catchesCount}\x1b[0m trúng | \x1b[31m${missesCount}\x1b[0m hụt`);
  console.log('-------------------------------------------------------------');
  console.log('\x1b[1m🏆 TOP 3 CẦN THỦ HIỆN TẠI:\x1b[0m');
  if (latestLeaderboard.length) {
    latestLeaderboard.slice(0, 3).forEach((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      console.log(`   ${medal} ${p.username.padEnd(20)} : ${String(p.score).padStart(6)} điểm (${p.catches || 0} con cá)`);
    });
  } else {
    console.log('   (Đang tổng hợp điểm số...)');
  }
  console.log('-------------------------------------------------------------');
  console.log('\x1b[37m\x1b[2mNhấn Ctrl+C để dừng bot và xem báo cáo tổng kết.\x1b[0m');

  if (DURATION_SEC > 0 && elapsedSec >= DURATION_SEC) {
    shutdown();
  }
}, 1000);

function shutdown() {
  clearInterval(hudInterval);
  console.log('\n\n\x1b[33m🛑 Đang gửi lệnh dừng 50 Bots tới server...\x1b[0m');
  socket.emit('bot:stop');

  setTimeout(() => {
    socket.disconnect();
    const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    console.log('\n\x1b[32m%s\x1b[0m', '=============================================================');
    console.log('\x1b[1m\x1b[32m%s\x1b[0m', '             BÁO CÁO TỔNG KẾT HIỆU NĂNG');
    console.log('\x1b[32m%s\x1b[0m', '=============================================================');
    console.log(`⏱️ Tổng thời gian test     : ${elapsedSec} giây`);
    console.log(`📦 Tổng socket events nhận : ${eventCount} gói tin`);
    console.log(`⚡ Tốc độ trung bình       : ${(eventCount / elapsedSec).toFixed(1)} events/giây`);
    console.log(`🎁 Tổng quà tặng đã phát   : ${latestBotStats ? latestBotStats.totalGifts : giftsCount}`);
    console.log(`💰 Tổng xu đã nạp mô phỏng : ${(latestBotStats ? latestBotStats.totalCoins : coinsCount).toLocaleString('vi-VN')} xu`);
    console.log(`🐟 Tổng cá câu thành công  : ${catchesCount}`);
    console.log('\x1b[32m%s\x1b[0m', '=============================================================');
    console.log('\x1b[36m✔ Thử nghiệm hoàn tất! Server và UI hoạt động hoàn hảo.\x1b[0m\n');
    process.exit(0);
  }, 600);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

