import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const PORT = Number(process.env.PORT || 3000);
const HOSTNAME = (process.env.TIKTOK_USERNAME || '').replace(/^@/, '').trim();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));
app.use(express.json());

// Routes:
// - http://localhost:3000/       -> Giao diện người xem (Stream/Viewer View)
// - http://localhost:3000/panel  -> Bảng điều khiển Streamer (Admin Control Panel)
app.get('/panel', (_req, res) => res.sendFile(path.resolve('public/panel.html')));
app.get('/control', (_req, res) => res.redirect('/panel'));
app.get('/admin', (_req, res) => res.redirect('/panel'));

app.get('/api/characters', (_req, res) => res.json({ characterIds: CHARACTER_IDS }));
app.get('/api/leaderboard', (_req, res) => res.json({
  topAnglers: getTopAnglers(10),
  topDonors: getTopDonors(10)
}));
app.get('/api/stream-stats', (_req, res) => res.json(getStreamStats()));
app.get('/api/weight-tiers', (_req, res) => res.json(weightTiers));
app.post('/api/weight-tiers', (req, res) => {
  if (Array.isArray(req.body) && req.body.length > 0) {
    weightTiers = req.body;
    io.emit('config:weight-tiers', weightTiers);
    return res.json({ ok: true, tiers: weightTiers });
  }
  res.status(400).json({ ok: false, error: 'Dữ liệu weight-tiers không hợp lệ' });
});

app.get('/api/gift-catalog', (_req, res) => res.json(giftCatalog));
app.post('/api/gift-catalog', (req, res) => {
  const { giftId, name, coins } = req.body || {};
  if (!giftId || coins == null) {
    return res.status(400).json({ ok: false, error: 'Thiếu giftId hoặc coins' });
  }
  giftCatalog[Number(giftId)] = { name: String(name || 'Quà TikTok'), coins: Number(coins) };
  io.emit('config:gift-catalog', giftCatalog);
  res.json({ ok: true, catalog: giftCatalog });
});

/* ================= VIETNAMESE FEMALE TTS ENDPOINT (Chị Google / Hoài My Neural) ================= */
const TTS_CACHE_DIR = path.resolve('public/cache/tts');
if (!fs.existsSync(TTS_CACHE_DIR)) {
  fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
}

app.get('/api/tts', async (req, res) => {
  const text = (req.query.text || '').trim();
  if (!text) return res.status(400).send('Missing text parameter');

  // Khóa băm hash MD5 cho file cache
  const hash = crypto.createHash('md5').update(text).digest('hex');
  const cacheFile = path.join(TTS_CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(cacheFile)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(cacheFile);
  }

  try {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=' + encodeURIComponent(text);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!resp.ok) throw new Error('TTS upstream status ' + resp.status);
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(cacheFile, buffer);

    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(cacheFile);
  } catch (err) {
    console.error('[TTS Error]', err.message);
    res.status(502).json({ error: 'TTS generation failed', details: err.message });
  }
});
app.get('/health', (_req, res) => res.json({
  ok: true,
  tiktokConfigured: Boolean(HOSTNAME),
  username: HOSTNAME,
  playersCount: players.size,
  botRunning: botEngine.running
}));

const serverStartTime = Date.now();
let totalGiftsCount = 0;
let totalCoinsAccumulated = 0;
let currentVoiceSpeed = 1.28;

const players = new Map();
const CHARACTER_DIR = path.resolve('public/assets/characters');
const CHARACTER_IDS = fs.existsSync(CHARACTER_DIR)
  ? fs.readdirSync(CHARACTER_DIR, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
  : [];
let unusedCharacterIds = [];
let lastCharacterId = '';

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function nextCharacterId() {
  if (!CHARACTER_IDS.length) return '';
  if (!unusedCharacterIds.length) {
    unusedCharacterIds = shuffle([...CHARACTER_IDS]);
    if (unusedCharacterIds.length > 1 && unusedCharacterIds.at(-1) === lastCharacterId) {
      const last = unusedCharacterIds.length - 1;
      [unusedCharacterIds[last], unusedCharacterIds[last - 1]] = [unusedCharacterIds[last - 1], unusedCharacterIds[last]];
    }
  }
  lastCharacterId = unusedCharacterIds.pop();
  return lastCharacterId;
}

function resetCharacterPool() {
  unusedCharacterIds = [];
  lastCharacterId = '';
}

// ================= CONFIGURATION & WEIGHT TIERS =================
// Bảng cấu hình mặc định phân cấp trọng lượng cá theo xu quà (Quản trị viên có thể thay đổi qua API/Panel)
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
let weightTiers = JSON.parse(JSON.stringify(DEFAULT_WEIGHT_TIERS));

// Gift Catalog TikTok (giftId -> { name, coins })
const DEFAULT_GIFT_CATALOG = {
  5655: { name: 'Hoa hồng', coins: 1 },
  5269: { name: 'Trái tim TikTok', coins: 1 },
  5658: { name: 'Kem ốc quế', coins: 1 },
  5879: { name: 'Bánh Donut', coins: 5 },
  5509: { name: 'Mũ phớt', coins: 10 },
  5659: { name: 'Kính râm', coins: 20 },
  5911: { name: 'Nước hoa', coins: 20 },
  5660: { name: 'Khóa tình yêu', coins: 99 },
  5661: { name: 'Pháo hoa', coins: 108 },
  5827: { name: 'Thiên nga', coins: 500 },
  5881: { name: 'Rồng Vàng', coins: 500 },
  6059: { name: 'Siêu xe', coins: 1999 },
  6060: { name: 'Du thuyền', coins: 5000 },
  6064: { name: 'Sư tử', coins: 29999 },
  6065: { name: 'Vũ trụ TikTok', coins: 34999 }
};
let giftCatalog = { ...DEFAULT_GIFT_CATALOG };

// Cấu hình hồi chiêu Free Cast & Thả tim
const DEFAULT_FREE_COOLDOWN_SEC = 60; // 1 phút hồi chiêu câu miễn phí
const MIN_FREE_COOLDOWN_SEC = 5;
const CAST_DURATION_MS = 2900;
const LEADERBOARD_SIZE = 10;

function getWeightTierIndex(coins = 0) {
  const c = Math.max(0, Number(coins) || 0);
  for (let i = weightTiers.length - 1; i >= 0; i--) {
    if (c >= weightTiers[i].minCoins) {
      return i;
    }
  }
  return 0;
}

function getWeightTier(coins = 0) {
  const idx = getWeightTierIndex(coins);
  return weightTiers[idx] || weightTiers[0];
}

// Cơ chế may mắn: Cá ở mức xu nhỏ vẫn có tỉ lệ câu được cá ở mức xu lớn hơn:
// - Không vượt quá 2 bậc so với mức xu hiện tại (maxJump <= 2)
// - Tổng tỉ lệ trúng cá mức cao hơn từ 40% trở lại (tối đa 38%)
// - Bậc càng cao thì tỉ lệ xuất hiện càng thấp (+2 bậc thấp hơn +1 bậc)
function selectCatchTier(coins = 0) {
  const baseIdx = getWeightTierIndex(coins);
  const maxIdx = weightTiers.length - 1;
  const baseTier = weightTiers[baseIdx] || weightTiers[0];

  if (baseIdx >= maxIdx) {
    return {
      tier: baseTier,
      baseTier,
      tierJump: 0,
      isLuckyBonus: false
    };
  }

  const maxJump = Math.min(2, maxIdx - baseIdx);

  // Hệ số co hẹp nhẹ theo bậc gốc (bậc càng cao thì tỉ lệ nổ bậc càng thấp)
  const tierFactor = Math.max(0.65, 1 - (baseIdx / maxIdx) * 0.35);

  // Nhảy +2 bậc: ~8% (giảm dần khi bậc gốc cao)
  const probPlus2 = maxJump >= 2 ? (0.08 * tierFactor) : 0;
  // Nhảy +1 bậc: ~24% (giảm dần khi bậc gốc cao)
  const probPlus1 = maxJump >= 1 ? (0.24 * tierFactor) : 0;
  // Tổng tỉ lệ nâng cấp <= 32% (luôn từ 40% trở lại)

  const rand = Math.random();
  let jump = 0;
  if (rand < probPlus2) {
    jump = 2; // Đại may mắn (+2 bậc cần)
  } else if (rand < probPlus2 + probPlus1) {
    jump = 1; // May mắn (+1 bậc cần)
  } else {
    jump = 0; // Giữ nguyên bậc xu gốc
  }

  const finalIdx = Math.min(baseIdx + jump, maxIdx);
  const awardedTier = weightTiers[finalIdx] || baseTier;

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
  // Làm tròn 2 chữ số thập phân
  const weight = Math.round((tier.minKg + Math.random() * range) * 100) / 100;

  // Random chọn 1 trong các loài cá thuộc mốc xu này
  const names = Array.isArray(tier.fishNames) && tier.fishNames.length > 0 ? tier.fishNames : [tier.name];
  const chosenName = names[Math.floor(Math.random() * names.length)];

  return {
    tier,
    baseTier: selection.baseTier,
    isLuckyBonus: selection.isLuckyBonus,
    tierJump: selection.tierJump,
    name: chosenName,
    weight,
    color: tier.color,
    rarity: tier.rarity,
    size: tier.minKg < 1 ? 0.85 : tier.minKg < 5 ? 1.2 : tier.minKg < 25 ? 1.6 : 2.1
  };
}

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
    // Chuẩn TikTok LIVE: 1 Diamond = 1 Coin (xu)
    unitCoins = diamondCount;
  } else if (data.gift?.coinCount != null && Number(data.gift.coinCount) > 0) {
    unitCoins = Number(data.gift.coinCount);
  } else if (data.extendedGiftInfo?.coinCount != null && Number(data.extendedGiftInfo.coinCount) > 0) {
    unitCoins = Number(data.extendedGiftInfo.coinCount);
  } else {
    // Mọi quà tặng TikTok phát sinh đều có giá trị ít nhất 1 xu (như Hoa hồng 1 xu)
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

// Xử lý Thả Tim: 100 tim = giảm 1 giây hồi chiêu (Tối thiểu 5s)
function handlePlayerLike(player, count = 1) {
  if (!player || count <= 0) return { reducedSec: 0, currentCooldownSec: DEFAULT_FREE_COOLDOWN_SEC };

  player.lastActiveAt = Date.now(); // Thả tim là tương tác từ người xem -> cập nhật mốc hoạt động
  player.hasPendingTurn = true;
  player.totalLikes = (player.totalLikes || 0) + count;
  player.pendingLikes = (player.pendingLikes || 0) + count;

  const reducedSec = Math.floor(player.pendingLikes / 100);
  if (reducedSec > 0) {
    player.pendingLikes = player.pendingLikes % 100;

    const oldCooldown = player.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC;
    const newCooldown = Math.max(MIN_FREE_COOLDOWN_SEC, oldCooldown - reducedSec);
    player.currentCooldownSec = newCooldown;

    const now = Date.now();
    if (player.cooldownUntil && player.cooldownUntil > now) {
      const remaining = Math.max(MIN_FREE_COOLDOWN_SEC * 1000, (player.cooldownUntil - now) - (reducedSec * 1000));
      player.cooldownUntil = now + remaining;
    }

    return {
      reducedSec,
      currentCooldownSec: newCooldown,
      totalLikes: player.totalLikes,
      pendingLikes: player.pendingLikes,
      cooldownUntil: player.cooldownUntil
    };
  }

  return {
    reducedSec: 0,
    currentCooldownSec: player.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC,
    totalLikes: player.totalLikes,
    pendingLikes: player.pendingLikes,
    cooldownUntil: player.cooldownUntil
  };
}

function canPlayerFreeCast(player) {
  const now = Date.now();
  if (!player.cooldownUntil || now >= player.cooldownUntil) {
    return { allowed: true, remainingSec: 0 };
  }
  const remainingSec = Math.max(0, Math.ceil((player.cooldownUntil - now) / 1000));
  return { allowed: false, remainingSec };
}

function triggerFreeCast(player) {
  if (!player) return false;
  const check = canPlayerFreeCast(player);
  if (!check.allowed) return false;

  const now = Date.now();
  const cooldownDuration = player.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC;
  player.cooldownUntil = now + cooldownDuration * 1000;
  player.hasPendingTurn = true; // Duy trì chu kỳ câu cá tự động cho cần thủ đang xem live
  player.lastActiveAt = now;
  player.lastSeenWatchingAt = now;
  player.isWatching = true;
  castLine(player, { giftName: 'Câu miễn phí', coins: 0 });
  return true;
}

// Bảng Xếp Hạng Cần Thủ: Theo tổng trọng lượng cá (totalWeight kg), nếu bằng nhau thì cá nặng nhất (heaviestFish kg)
function getTopAnglers(limit = 10) {
  const sorted = [...players.values()]
    .filter(p => ((p.totalWeight || 0) > 0 || (p.catches || 0) > 0 || (p.totalFish || 0) > 0))
    .sort((a, b) => {
      // 1. Giảm dần theo totalWeight
      const diffWeight = (b.totalWeight || 0) - (a.totalWeight || 0);
      if (Math.abs(diffWeight) > 0.0001) return diffWeight;
      // 2. Nếu bằng nhau: người có con cá nặng nhất (heaviestFish) lớn hơn xếp trên
      const diffHeaviest = (b.heaviestFish || 0) - (a.heaviestFish || 0);
      if (Math.abs(diffHeaviest) > 0.0001) return diffHeaviest;
      // 3. Nếu vẫn bằng nhau: người tham gia trước xếp trên
      return a.joinedAt - b.joinedAt;
    })
    .slice(0, limit);

  return sorted.map((p, idx) => ({
    rank: idx + 1,
    id: p.id,
    username: p.username,
    avatar: p.avatar,
    characterId: p.characterId,
    totalWeight: Math.round((p.totalWeight || 0) * 100) / 100,
    totalFish: p.totalFish || p.catches || 0,
    catches: p.totalFish || p.catches || 0,
    heaviestFish: Math.round((p.heaviestFish || 0) * 100) / 100,
    currentCooldownSec: p.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC,
    totalLikes: p.totalLikes || 0,
    joinedAt: p.joinedAt,
    title: idx === 0 ? 'Vua Câu Cá' : idx === 1 ? 'Bậc Thầy' : idx === 2 ? 'Cao Thủ' : 'Thợ Câu'
  }));
}

function getTopDonors(limit = 10) {
  const sorted = [...players.values()]
    .filter(p => (p.totalCoinsGiven > 0 || p.giftCount > 0))
    .sort((a, b) => (b.totalCoinsGiven || 0) - (a.totalCoinsGiven || 0) || (b.giftCount || 0) - (a.giftCount || 0) || a.joinedAt - b.joinedAt)
    .slice(0, limit);

  return sorted.map((p, idx) => ({
    rank: idx + 1,
    id: p.id,
    username: p.username,
    avatar: p.avatar,
    characterId: p.characterId,
    totalCoins: p.totalCoinsGiven || 0,
    giftCount: p.giftCount || 0,
    title: idx === 0 ? 'Đại Gia VIP' : idx === 1 ? 'Kim Cương' : idx === 2 ? 'Tài Trợ Vàng' : 'Ủng Hộ'
  }));
}

function getStreamStats() {
  const top1 = getTopAnglers(1)[0] || null;
  const baseViewers = 1250;
  const dynamicViewers = baseViewers + Math.round(Math.sin(Date.now() / 25000) * 120 + players.size * 3);

  return {
    roomName: 'BỜ CÂU BÌNH YÊN',
    liveStatus: Boolean(HOSTNAME) ? 'ĐANG LIVE • TikTok' : 'Chế độ Demo Live',
    isLive: true,
    viewerCount: dynamicViewers,
    totalPlayers: players.size,
    totalGifts: totalGiftsCount,
    totalCoins: totalCoinsAccumulated,
    top1Angler: top1 ? { username: top1.username, totalWeight: top1.totalWeight, heaviestFish: top1.heaviestFish } : null
  };
}

function broadcastLeaderboardAndStats() {
  const topAnglers = getTopAnglers(10);
  const topDonors = getTopDonors(10);
  const stats = getStreamStats();

  io.emit('leaderboard:data', { topAnglers, topDonors });
  io.emit('leaderboard', topAnglers);
  io.emit('stream:stats', stats);
  io.emit('panel:stats', {
    totalPlayers: players.size,
    leaderboard: topAnglers,
    topDonors,
    ...stats
  });
}

const getLeaderboard = () => getTopAnglers(LEADERBOARD_SIZE);
const giftValue = data => Number(data?.gift?.diamondCount ?? data?.extendedGiftInfo?.diamondCount ?? data?.giftDetails?.diamondCount ?? data?.gift?.diamond_count ?? 0) * Math.max(1, Number(data?.repeatCount || 1));

function avatarOf(user) {
  if (!user) return '';
  return user?.profilePictureUrl
    ?? user?.avatarThumb?.urlList?.[0]
    ?? user?.avatarThumb
    ?? user?.avatarMedium?.urlList?.[0]
    ?? user?.avatarMedium
    ?? user?.avatarLarge?.urlList?.[0]
    ?? user?.avatarLarge
    ?? user?.avatar
    ?? user?.userDetails?.profilePictureUrls
    ?? '';
}

function extractUserFromEvent(data) {
  if (!data) return null;
  // tiktok-live-connector v2 flattens user fields directly onto the event object
  const u = (data.user && typeof data.user === 'object') ? data.user : data;
  const id = String(u.userId || u.id || u.uniqueId || u.displayId || data.userId || data.uniqueId || '');
  if (!id) return null;
  const username = String(u.nickname || u.displayId || u.uniqueId || data.nickname || data.uniqueId || 'Cần thủ').slice(0, 28);
  const avatar = avatarOf(u) || avatarOf(data);
  return {
    id,
    userId: id,
    uniqueId: String(u.uniqueId || data.uniqueId || id),
    nickname: username,
    username: username,
    avatar,
    profilePictureUrl: avatar
  };
}

function ensurePlayer(userInput = {}, enterBank = false) {
  const extracted = extractUserFromEvent(userInput);
  const user = extracted || userInput;
  const id = String(user.id || user.userId || user.uniqueId || user.displayId || `guest-${Date.now()}`);
  let player = players.get(id);
  const now = Date.now();
  if (!player) {
    player = {
      id,
      username: String(user.username || user.nickname || user.displayId || user.uniqueId || 'Cần thủ').slice(0, 28),
      avatar: avatarOf(user),
      characterId: nextCharacterId(),
      // Hệ thống trọng lượng cá (kg) & bảng xếp hạng mới
      totalWeight: 0,
      totalFish: 0,
      catches: 0,
      heaviestFish: 0,
      // Hồi chiêu 1 phút (60s) & Thả tim
      cooldownUntil: 0,
      cooldownBaseSec: DEFAULT_FREE_COOLDOWN_SEC,
      currentCooldownSec: DEFAULT_FREE_COOLDOWN_SEC,
      totalLikes: 0,
      pendingLikes: 0,
      // Thống kê quà tặng & xu
      totalCoinsGiven: 0,
      giftCount: 0,
      joinedAt: now,
      lastActiveAt: now,
      lastInteractionAt: now,
      lastSeenWatchingAt: now,
      isWatching: true,
      uniqueId: String(user.uniqueId || user.displayId || user.username || '').toLowerCase(),
      onBank: enterBank === true,
      hasPendingTurn: enterBank === true
    };
    players.set(id, player);
    if (enterBank === true) {
      player.cooldownUntil = now + DEFAULT_FREE_COOLDOWN_SEC * 1000;
      io.emit('player:join', player);
    }
    broadcastLeaderboardAndStats();
  } else {
    // Bảo toàn dữ liệu người chơi cũ
    if (player.totalWeight == null) player.totalWeight = 0;
    if (player.totalFish == null) player.totalFish = player.catches || 0;
    if (player.heaviestFish == null) player.heaviestFish = 0;
    if (player.currentCooldownSec == null) player.currentCooldownSec = DEFAULT_FREE_COOLDOWN_SEC;
    if (player.pendingLikes == null) player.pendingLikes = 0;
    if (player.totalLikes == null) player.totalLikes = 0;
    if (!player.avatar && avatarOf(user)) player.avatar = avatarOf(user);
    if (!player.uniqueId) player.uniqueId = String(user.uniqueId || user.displayId || user.username || '').toLowerCase();
    const newName = String(user.username || user.nickname || user.displayId || user.uniqueId || '').slice(0, 28);
    if (newName && newName !== 'Cần thủ' && player.username === 'Cần thủ') {
      player.username = newName;
    }

    if (enterBank === true) {
      player.lastActiveAt = now;
      player.lastInteractionAt = now;
      player.lastSeenWatchingAt = now;
      player.isWatching = true;
      player.hasPendingTurn = true;
      if (player.onBank === false) {
        player.onBank = true;
        player.cooldownUntil = now + (player.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC) * 1000;
        io.emit('player:join', player);
      }
    }
  }
  return player;
}

function markViewerWatching(userInput) {
  if (!userInput) return null;
  const extracted = extractUserFromEvent(userInput);
  const u = extracted || userInput;
  const uid = String(u.id || u.userId || u.idStr || '').trim();
  const uname = String(u.uniqueId || u.displayId || '').toLowerCase().trim();
  const nickname = String(u.nickname || u.username || '').toLowerCase().trim();
  const now = Date.now();

  let foundPlayer = null;
  if (uid && players.has(uid)) {
    foundPlayer = players.get(uid);
  } else {
    for (const p of players.values()) {
      if (uname && p.uniqueId && (p.uniqueId === uname || p.uniqueId.toLowerCase() === uname)) {
        foundPlayer = p;
        break;
      }
      if (nickname && p.username && p.username.toLowerCase() === nickname) {
        foundPlayer = p;
        break;
      }
    }
  }

  if (foundPlayer) {
    foundPlayer.lastSeenWatchingAt = now;
    foundPlayer.isWatching = true;
    if (uid && !players.has(uid)) {
      foundPlayer.userId = uid;
    }
  }
  return foundPlayer;
}

// ================= PRIORITY FISHING QUEUE (LƯỢT CÂU TUẦN TỰ & ƯU TIÊN THEO XU) =================
// Yêu cầu:
// 1. Không thực hiện câu giữa nhiều nhân vật cùng lúc, đưa vào hàng đợi và thực hiện lần lượt.
// 2. Người tặng phần thưởng có xu lớn hơn được ưu tiên thực hiện tiếp theo (người 10 xu ưu tiên trước người 1 xu).
// 3. Người đang câu được giữ nguyên thực hiện trọn vẹn lượt của mình.
const fishingQueue = [];
let currentFishingSession = null;
let currentBiteTimer = null;
let currentAnimTimer = null;
const MAX_QUEUE_SIZE = 50;

// Trạng thái số lượng người xem trực tiếp từ TikTok LIVE
let currentViewerCount = 0;
let lastZeroViewerAt = null;

function clearFishingQueue() {
  fishingQueue.length = 0;
  currentFishingSession = null;
  clearTimeout(currentBiteTimer);
  clearTimeout(currentAnimTimer);
}

// ================= RESET LIVE SESSION DATA =================
// Tự động làm mới toàn bộ dữ liệu khi tắt live hoặc bắt đầu phiên live mới
function resetLiveSessionData(reason = 'Tắt live / Làm mới dữ liệu') {
  console.log(`🧹 [Làm mới dữ liệu] ${reason} -> Dọn sạch cần thủ trên bờ, hàng đợi và bảng xếp hạng.`);
  if (typeof botEngine !== 'undefined' && botEngine.running) {
    botEngine.stop();
  }
  currentViewerCount = 0;
  lastZeroViewerAt = null;
  clearFishingQueue();
  players.clear();
  resetCharacterPool();
  io.emit('demo:reset');
  io.emit('leaderboard', []);
  io.emit('panel:stats', { totalPlayers: 0, leaderboard: [] });
  broadcastQueueStatus();
}

function castLine(player, { giftName = '', coins = 0 } = {}) {
  if (!player) return;
  const now = Date.now();
  player.lastActiveAt = now;
  player.lastSeenWatchingAt = now;
  player.isWatching = true;
  if (player.onBank === false) {
    player.onBank = true;
    io.emit('player:join', player);
  }
  enqueueFishing(player, { giftName, coins });
}

function enqueueFishing(player, { giftName = '', coins = 0 } = {}) {
  const safeCoins = Math.max(0, Number(coins) || 0);

  // Nếu người này đã có trong hàng đợi với số xu thấp hơn, nâng cấp xu & tên quà
  const existingIdx = fishingQueue.findIndex(item => item.player.id === player.id);
  if (existingIdx !== -1) {
    if (safeCoins > fishingQueue[existingIdx].coins) {
      fishingQueue[existingIdx].coins = safeCoins;
      fishingQueue[existingIdx].giftName = giftName || fishingQueue[existingIdx].giftName;
    }
  } else {
    // Nếu hàng đợi quá đông (MAX_QUEUE_SIZE = 50):
    // Ưu tiên quà có xu thay thế cho lượt câu thường (0 xu) ở cuối hàng đợi
    if (fishingQueue.length >= MAX_QUEUE_SIZE) {
      if (safeCoins > 0 && fishingQueue[fishingQueue.length - 1].coins === 0) {
        fishingQueue.pop();
      } else if (safeCoins === 0) {
        return; // Hàng đợi đang đầy, tạm ngưng nhận câu thường
      }
    }

    fishingQueue.push({
      player,
      giftName: giftName || (safeCoins > 0 ? 'Quà' : 'Câu thường'),
      coins: safeCoins,
      enqueuedAt: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    });
  }

  if (safeCoins > 0) {
    player.totalCoinsGiven = (player.totalCoinsGiven || 0) + safeCoins;
    player.giftCount = (player.giftCount || 0) + 1;
    totalGiftsCount++;
    totalCoinsAccumulated += safeCoins;
    broadcastLeaderboardAndStats();
  }

  // Sắp xếp hàng đợi theo độ ưu tiên:
  // 1. Xu lớn hơn xếp lên trước (b.coins - a.coins)
  // 2. Cùng xu: Ai gửi trước câu trước (a.enqueuedAt - b.enqueuedAt)
  sortFishingQueue();
  broadcastQueueStatus();

  // NẾU LÀ NGƯỜI TẶNG QUÀ (safeCoins > 0):
  // Ưu tiên giật cần: Nếu lượt câu hiện tại chỉ là câu miễn phí (0 xu), rút ngắn kết thúc ngay lượt 0 xu
  // để người tặng quà vào câu NGAY LẬP TỨC!
  if (safeCoins > 0 && currentFishingSession && currentFishingSession.coins === 0) {
    if (typeof currentFishingSession.fastForward === 'function') {
      currentFishingSession.fastForward();
      return;
    }
  }

  // Bắt đầu lượt câu nếu chưa có ai đang thực hiện
  processNextInQueue();
}

function sortFishingQueue() {
  fishingQueue.sort((a, b) => (b.coins - a.coins) || (a.enqueuedAt - b.enqueuedAt));
}

function broadcastQueueStatus() {
  io.emit('fishing:queue-status', {
    waitingCount: fishingQueue.length,
    activePlayerId: currentFishingSession ? currentFishingSession.player.id : null,
    queue: fishingQueue.slice(0, 10).map(q => ({
      username: q.player.username,
      coins: q.coins,
      giftName: q.giftName
    }))
  });
}

function processNextInQueue() {
  // Nếu đang có người thực hiện câu hoặc hàng đợi trống -> không nhận thêm lượt mới
  if (currentFishingSession) return;
  if (!fishingQueue.length) return;

  clearTimeout(currentBiteTimer);
  clearTimeout(currentAnimTimer);

  // Lấy người có độ ưu tiên cao nhất ở đầu hàng đợi
  const item = fishingQueue.shift();
  sortFishingQueue();
  broadcastQueueStatus();

  const player = item.player;
  const boosted = item.coins > 0;
  const catchRes = generateCatchResult(item.coins);
  const fishWeight = catchRes.weight;
  const fish = {
    name: catchRes.name,
    weight: fishWeight,
    color: catchRes.color,
    rarity: catchRes.rarity,
    size: catchRes.size,
    isLuckyBonus: catchRes.isLuckyBonus,
    tierJump: catchRes.tierJump,
    baseTierName: catchRes.baseTier?.name || '',
    awardedTierName: catchRes.tier?.name || ''
  };

  const event = {
    playerId: player.id,
    username: player.username,
    avatar: player.avatar,
    giftName: item.giftName,
    coins: item.coins,
    fish,
    chance: 1.0, // Phần thưởng cam kết minh bạch theo mức cấu hình xu
    duration: CAST_DURATION_MS,
    id: item.id
  };

  let isCatchCompleted = false;

  function finishCatch() {
    if (isCatchCompleted) return;
    isCatchCompleted = true;
    clearTimeout(currentBiteTimer);

    player.totalWeight = Math.round(((player.totalWeight || 0) + fishWeight) * 100) / 100;
    player.totalFish = (player.totalFish || player.catches || 0) + 1;
    player.catches = player.totalFish;
    if (!player.heaviestFish || fishWeight > player.heaviestFish) {
      player.heaviestFish = fishWeight;
    }

    io.emit('fishing:catch', event);
    broadcastLeaderboardAndStats();
    io.emit('panel:event-log', {
      type: 'catch',
      ...event,
      weightText: `${fishWeight.toFixed(2)} kg`,
      luckyText: catchRes.isLuckyBonus ? `🌟 Nổ Cá Cấp Cao (+${catchRes.tierJump} bậc)` : '',
      time: Date.now()
    });

    // Nếu sau lưng đang có người tặng quà đang đợi (coins > 0), nhường lượt cực nhanh (600ms)
    const hasGiftWaiting = fishingQueue.some(q => q.coins > 0);
    const animWaitMs = (item.coins === 0 && hasGiftWaiting) ? 600 : 2300;

    currentAnimTimer = setTimeout(() => {
      currentFishingSession = null;
      broadcastQueueStatus();
      processNextInQueue();
    }, animWaitMs);
  }

  currentFishingSession = {
    ...item,
    event,
    startedAt: Date.now(),
    fastForward: () => {
      finishCatch();
    }
  };

  // 1. Giai đoạn cắn câu (Bite / Approach): Duy nhất người này câu
  io.emit('fishing:approach', event);
  io.emit('panel:event-log', {
    type: boosted ? 'gift' : 'cast',
    ...event,
    luckyText: catchRes.isLuckyBonus ? `🌟 May Mắn (+${catchRes.tierJump} bậc)` : '',
    time: Date.now()
  });

  // 2. Sau thời gian cắn câu (CAST_DURATION_MS = 2900ms): Cam kết câu trúng theo trọng lượng tier
  currentBiteTimer = setTimeout(finishCatch, CAST_DURATION_MS);
}

// ================= AUTO FREE FISHING ENGINE (MỖI 1 PHÚT TỰ ĐỘNG GIẬT CẦN CÂU CÁ) =================
// Tự động kiểm tra tất cả cần thủ đang trên bờ:
// Khi hết thời gian hồi chiêu 45s (hoặc nhanh hơn nếu được thả tim), cần thủ sẽ tự động câu cá!
setInterval(() => {
  const now = Date.now();
  for (const player of players.values()) {
    // Nếu người chơi đã rời bờ -> không auto câu cá
    if (player.onBank === false) continue;

    // Nếu chưa khởi tạo thời điểm hồi chiêu, khởi tạo ngay
    if (!player.cooldownUntil) {
      player.cooldownUntil = now + (player.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC) * 1000;
      continue;
    }

    // Khi đã hết thời gian hồi chiêu
    if (now >= player.cooldownUntil) {
      // Tránh trùng lặp nếu người này đã có trong hàng đợi câu hoặc đang thực hiện giật cần
      const alreadyInQueue = fishingQueue.some(item => item.player.id === player.id);
      const isCurrentlyFishing = currentFishingSession && currentFishingSession.player.id === player.id;
      if (!alreadyInQueue && !isCurrentlyFishing) {
        triggerFreeCast(player);
      }
    }
  }
}, 1000);

// ================= AUTO LEAVE BANK (RỜI BỜ KHI KHÔNG CÒN TÍN HIỆU TƯƠNG TÁC) =================
// Quy tắc hoạt động:
// 1. Mốc thời gian rời bờ: 2.5 phút (150 giây) - đủ cho 2-3 chu kỳ câu cá (mỗi chu kỳ 60s).
// 2. Tín hiệu gia hạn thời gian (reset mốc 150s):
//    - Người xem chạm tay vào màn hình thả tim (Like) -> Làm mới 150s + giảm hồi chiêu.
//    - Bình luận bất kỳ trong live -> Làm mới 150s.
//    - Tặng quà bất kỳ -> Làm mới 150s.
//    - Đang câu cá hoặc trong hàng đợi -> Được bảo vệ tuyệt đối, không ngắt quãng.
// 3. Nếu 1 người thực sự thoát live (không còn chạm like, không cmt, không quà quá 150s):
//    - Nhân vật người đó sẽ tự động chào tạm biệt và bước ra khỏi bờ câu!
//    - Những người còn lại (vẫn đang xem / thả tim / bình luận) thì VẪN TIẾP TỤC Ở LẠI CÂU!
let INACTIVE_LEAVE_SEC = 150; // Mặc định 2.5 phút (150 giây)
let INACTIVE_LEAVE_MS = INACTIVE_LEAVE_SEC * 1000;

setInterval(() => {
  const now = Date.now();

  // Kiểm tra từng cần thủ trên bờ:
  for (const player of players.values()) {
    if (player.onBank === false) continue;

    // Không rời bờ nếu đang trong hàng đợi hoặc đang kéo cá (đợi xong lượt trọn vẹn)
    const inQueue = fishingQueue.some(q => q.player && q.player.id === player.id);
    const isCurrentFishing = currentFishingSession && currentFishingSession.player && currentFishingSession.player.id === player.id;
    if (inQueue || isCurrentFishing) continue;

    // Mốc tương tác gần nhất của người dùng (Thả tim Like, Bình luận, Tặng quà, hoặc vừa mới vào bờ)
    const lastSignal = Math.max(
      player.lastInteractionAt || 0,
      player.joinedAt || 0
    );
    const timeSinceLastSignal = now - lastSignal;

    // Nếu quá 2.5 phút (150s) không có bất kỳ tương tác nào (không thả tim, không cmt, không quà):
    // Xác định người này đã thoát khỏi live -> Đưa nhân vật ra khỏi bờ câu!
    if (timeSinceLastSignal >= INACTIVE_LEAVE_MS) {
      player.onBank = false;
      player.hasPendingTurn = false;
      player.isWatching = false;
      console.log(`👋 [Rời bờ] Cần thủ @${player.username} đã thoát live (không tương tác sau ${Math.round(timeSinceLastSignal / 1000)}s) -> Rời khỏi bờ câu.`);
      io.emit('player:leave', { playerId: player.id, username: player.username, time: now });
      io.emit('panel:event-log', {
        type: 'leave',
        username: player.username,
        reason: `Thoát live (không tương tác sau ${Math.round(timeSinceLastSignal / 1000)}s)`,
        time: now
      });
    }
  }
}, 1000);

// ================= 50 BOTS STRESS TEST ENGINE =================
const BOT_NAMES = [
  'Minh Tuấn', 'Thuỳ Linh', 'Hoàng Nam', 'Bảo Châu', 'Gia Huy',
  'Khánh Huyền', 'Quốc Bảo', 'Phương Anh', 'Đức Anh', 'Hương Giang',
  'Tuấn Kiệt', 'Thanh Trúc', 'Hải Đăng', 'Ngọc Ánh', 'Việt Hoàng',
  'Thảo My', 'Hữu Phước', 'Bích Ngọc', 'Trọng Hiếu', 'Yến Nhi',
  'Quang Huy', 'Minh Châu', 'Duy Khánh', 'Mai Anh', 'Bảo Long',
  'Kim Ngân', 'Đình Trọng', 'Khánh Linh', 'Thành Đạt', 'Hồng Nhung',
  'Văn Hậu', 'Trà My', 'Tiến Dũng', 'Ánh Tuyết', 'Hải Nam',
  'Thu Trang', 'Văn Toàn', 'Ngọc Huyền', 'Công Phượng', 'Diệu Linh',
  'Tấn Tài', 'Quỳnh Nga', 'Bảo Hưng', 'Thanh Vân', 'Minh Trí',
  'Bảo An', 'Anh Quân', 'Hoài Thương', 'Chí Kiên', 'Thuỳ Dung'
];

const BOT_GIFTS = [
  { name: 'Hoa hồng', coins: 1 },
  { name: 'Kem ốc quế', coins: 1 },
  { name: 'Trái tim', coins: 5 },
  { name: 'Mũ phớt', coins: 10 },
  { name: 'Cánh diều', coins: 20 },
  { name: 'Du thuyền', coins: 50 },
  { name: 'Pháo hoa', coins: 100 },
  { name: 'Rồng Thần', coins: 500 }
];

const botEngine = {
  running: false,
  timer: null,
  botIds: [],
  intervalMs: 380,
  giftRatio: 0.5,
  stats: {
    totalActions: 0,
    totalGifts: 0,
    totalCasts: 0,
    totalCoins: 0,
    startTime: 0
  },

  spawnBots(count = 50) {
    this.botIds = [];
    for (let i = 0; i < count; i++) {
      const id = `bot-${i + 1}`;
      const name = BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? ` #${Math.floor(i / BOT_NAMES.length) + 1}` : '');
      const cid = CHARACTER_IDS[i % CHARACTER_IDS.length];
      let p = players.get(id);
      if (!p) {
        p = {
          id,
          username: name,
          avatar: '',
          characterId: cid,
          totalWeight: 0,
          totalFish: 0,
          catches: 0,
          heaviestFish: 0,
          currentCooldownSec: DEFAULT_FREE_COOLDOWN_SEC,
          totalLikes: 0,
          pendingLikes: 0,
          totalCoinsGiven: 0,
          giftCount: 0,
          joinedAt: Date.now() + i
        };
        players.set(id, p);
        io.emit('player:join', p);
      } else {
        p.username = name;
        p.characterId = cid;
        io.emit('player:update', p);
      }
      this.botIds.push(id);
    }
    broadcastLeaderboardAndStats();
  },

  start({ count = 50, intervalMs = 380, giftRatio = 0.5 } = {}) {
    if (this.running) this.stop();
    this.intervalMs = Math.max(100, Number(intervalMs) || 380);
    this.giftRatio = Math.max(0.05, Math.min(0.95, Number(giftRatio) || 0.5));
    this.spawnBots(count);

    this.running = true;
    this.stats.startTime = Date.now();
    this.stats.totalActions = 0;
    this.stats.totalGifts = 0;
    this.stats.totalCasts = 0;
    this.stats.totalCoins = 0;

    this.timer = setInterval(() => {
      if (!this.running || !this.botIds.length) return;

      // Simulate concurrent activity: 1-2 bots act each tick
      const actionsCount = Math.random() < 0.35 ? 2 : 1;
      for (let k = 0; k < actionsCount; k++) {
        const randId = this.botIds[Math.floor(Math.random() * this.botIds.length)];
        const p = players.get(randId);
        if (!p) continue;

        this.stats.totalActions++;
        if (Math.random() < this.giftRatio) {
          const gift = BOT_GIFTS[Math.floor(Math.random() * BOT_GIFTS.length)];
          this.stats.totalGifts++;
          this.stats.totalCoins += gift.coins;
          castLine(p, { giftName: gift.name, coins: gift.coins });
        } else {
          this.stats.totalCasts++;
          castLine(p);
        }
      }

      const elapsedSec = Math.max(1, (Date.now() - this.stats.startTime) / 1000);
      const aps = (this.stats.totalActions / elapsedSec).toFixed(1);
      io.emit('bot:stats', {
        running: true,
        count: this.botIds.length,
        ...this.stats,
        actionsPerSec: aps
      });
    }, this.intervalMs);

    io.emit('bot:status', { running: true, count: this.botIds.length });
    console.log(`🤖 [BotEngine] Đã kích hoạt ${count} Bots câu cá & tặng quà liên tục (${this.intervalMs}ms/nhịp)`);
  },

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    io.emit('bot:status', { running: false, count: this.botIds.length });
    console.log(`🛑 [BotEngine] Đã dừng Bot mô phỏng.`);
  }
};

io.on('connection', socket => {
  const topAnglers = getTopAnglers(10);
  const topDonors = getTopDonors(10);
  const stats = getStreamStats();

  socket.emit('state:init', {
    players: [...players.values()].filter(p => p.onBank !== false),
    leaderboard: topAnglers,
    topDonors,
    connected: isConnected,
    connecting: isConnecting,
    characterIds: CHARACTER_IDS,
    username: currentTiktokUsername,
    roomId: currentRoomId,
    voiceSpeed: currentVoiceSpeed,
    botRunning: botEngine.running,
    botStats: botEngine.stats,
    streamStats: stats
  });

  socket.emit('leaderboard:data', { topAnglers, topDonors });
  socket.emit('stream:stats', stats);

  socket.emit('fishing:queue-status', {
    waitingCount: fishingQueue.length,
    activePlayerId: currentFishingSession ? currentFishingSession.player.id : null,
    queue: fishingQueue.slice(0, 10).map(q => ({
      username: q.player.username,
      coins: q.coins,
      giftName: q.giftName
    }))
  });

  socket.on('demo:join', ({ username = 'Khách xem', avatar = '', characterId = '' } = {}) => {
    const p = ensurePlayer({
      uniqueId: `demo-${String(username).toLowerCase().replace(/\W+/g, '-')}`,
      nickname: username,
      avatarThumb: avatar
    }, true);
    if (characterId && CHARACTER_IDS.includes(characterId)) {
      p.characterId = characterId;
      io.emit('player:update', p);
    }
    // Lần đầu vào bờ: thực hiện ngay 1 lượt câu cá
    triggerFreeCast(p);
    return p;
  });

  socket.on('demo:change-character', ({ username = 'Khách xem', characterId = '' } = {}) => {
    const id = `demo-${String(username).toLowerCase().replace(/\W+/g, '-')}`;
    const p = players.get(id);
    if (p && characterId && CHARACTER_IDS.includes(characterId)) {
      p.characterId = characterId;
      io.emit('player:update', p);
    }
  });

  socket.on('demo:spawn-all', () => {
    CHARACTER_IDS.forEach((cid, idx) => {
      const uname = `Cần thủ ${idx + 1}`;
      const uid = `demo-char-${idx + 1}`;
      let p = players.get(uid);
      if (!p) {
        p = {
          id: uid,
          username: uname,
          avatar: '',
          characterId: cid,
          totalWeight: 0,
          totalFish: 0,
          catches: 0,
          heaviestFish: 0,
          currentCooldownSec: DEFAULT_FREE_COOLDOWN_SEC,
          cooldownUntil: Date.now() + Math.floor(((idx * 7300) % DEFAULT_FREE_COOLDOWN_SEC) * 1000) + 2000,
          totalLikes: 0,
          pendingLikes: 0,
          joinedAt: Date.now() + idx
        };
        players.set(uid, p);
        io.emit('player:join', p);
      } else {
        p.characterId = cid;
        io.emit('player:update', p);
      }
    });
    io.emit('leaderboard', getLeaderboard());
    io.emit('panel:stats', { totalPlayers: players.size, leaderboard: getLeaderboard() });
  });

  socket.on('demo:spawn-batch', ({ count = 5 } = {}) => {
    const start = players.size + 1;
    for (let i = 0; i < count; i++) {
      const idx = start + i;
      const cid = CHARACTER_IDS[(idx - 1) % CHARACTER_IDS.length];
      const uid = `demo-batch-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
      const uname = `Cần thủ ${idx}`;
      const p = {
        id: uid,
        username: uname,
        avatar: '',
        characterId: cid,
        totalWeight: 0,
        totalFish: 0,
        catches: 0,
        heaviestFish: 0,
        currentCooldownSec: DEFAULT_FREE_COOLDOWN_SEC,
        cooldownUntil: Date.now() + Math.floor(((i * 7300) % DEFAULT_FREE_COOLDOWN_SEC) * 1000) + 2000,
        totalLikes: 0,
        pendingLikes: 0,
        joinedAt: Date.now() + i
      };
      players.set(uid, p);
      io.emit('player:join', p);
    }
    io.emit('leaderboard', getLeaderboard());
    io.emit('panel:stats', { totalPlayers: players.size, leaderboard: getLeaderboard() });
  });

  socket.on('demo:gift', ({ username = 'Khách xem', giftName = 'Hoa hồng', coins = 1, playerId = '' } = {}) => {
    let player = null;
    if (playerId && players.has(playerId)) {
      player = players.get(playerId);
    } else {
      const user = { uniqueId: `demo-${String(username).toLowerCase().replace(/\W+/g, '-')}`, nickname: username };
      player = ensurePlayer(user, true);
    }
    castLine(player, { giftName, coins: Math.max(1, Number(coins) || 1) });
  });

  socket.on('demo:cast', ({ username = 'Khách xem', playerId = '' } = {}) => {
    let player = null;
    if (playerId && players.has(playerId)) {
      player = players.get(playerId);
    } else {
      const user = { uniqueId: `demo-${String(username).toLowerCase().replace(/\W+/g, '-')}`, nickname: username };
      player = ensurePlayer(user, true);
    }
    castLine(player);
  });

  // Sự kiện Thả Tim (Like): 100 tim = giảm 1 giây hồi chiêu (Tối thiểu 5s)
  socket.on('demo:like', ({ playerId = '', username = '', count = 100 } = {}) => {
    let player = null;
    if (playerId && players.has(playerId)) {
      player = players.get(playerId);
    } else if (username) {
      const uid = `demo-${String(username).toLowerCase().replace(/\W+/g, '-')}`;
      player = players.get(uid) || ensurePlayer({ uniqueId: uid, nickname: username }, true);
    }
    if (player) {
      const res = handlePlayerLike(player, Math.max(1, Number(count) || 1));
      io.emit('player:like-boost', {
        playerId: player.id,
        username: player.username,
        totalLikes: player.totalLikes,
        pendingLikes: player.pendingLikes,
        reducedSec: res.reducedSec,
        currentCooldownSec: res.currentCooldownSec,
        cooldownUntil: player.cooldownUntil
      });
      io.emit('panel:event-log', {
        type: 'like',
        username: player.username,
        count,
        reducedSec: res.reducedSec,
        currentCooldownSec: res.currentCooldownSec,
        time: Date.now()
      });
    }
  });

  // Câu cá miễn phí (0 xu, hồi chiêu 45s trừ dần bằng like)
  socket.on('demo:free-cast', ({ playerId = '', username = '' } = {}) => {
    let player = null;
    if (playerId && players.has(playerId)) {
      player = players.get(playerId);
    } else if (username) {
      const uid = `demo-${String(username).toLowerCase().replace(/\W+/g, '-')}`;
      player = players.get(uid) || ensurePlayer({ uniqueId: uid, nickname: username }, true);
    }
    if (player) {
      const ok = triggerFreeCast(player);
      if (!ok) {
        const check = canPlayerFreeCast(player);
        socket.emit('player:cooldown', { playerId: player.id, remainingSec: check.remainingSec });
      }
    }
  });

  // Quản lý Weight Tiers & Gift Catalog qua Socket
  socket.on('config:get-tiers', () => socket.emit('config:weight-tiers', weightTiers));
  socket.on('config:update-tiers', tiers => {
    if (Array.isArray(tiers) && tiers.length) {
      weightTiers = tiers;
      io.emit('config:weight-tiers', weightTiers);
      console.log('⚙️ [Config] Đã cập nhật Bảng Trọng Lượng Mới (Weight Tiers)');
    }
  });
  socket.on('config:get-catalog', () => socket.emit('config:gift-catalog', giftCatalog));
  socket.on('config:update-catalog', ({ giftId, name, coins }) => {
    if (giftId && coins != null) {
      giftCatalog[Number(giftId)] = { name: String(name || 'Quà TikTok'), coins: Number(coins) };
      io.emit('config:gift-catalog', giftCatalog);
      console.log(`🎁 [Catalog] Đã cập nhật Quà ID: ${giftId} -> ${name} (${coins} xu)`);
    }
  });

  // Bot Stress Test Commands
  socket.on('bot:start', opts => botEngine.start(opts));
  socket.on('bot:stop', () => botEngine.stop());
  socket.on('bot:get-status', () => {
    socket.emit('bot:status', { running: botEngine.running, count: botEngine.botIds.length, stats: botEngine.stats });
  });

  socket.on('demo:reset', () => {
    botEngine.stop();
    clearFishingQueue();
    players.clear();
    resetCharacterPool();
    io.emit('demo:reset');
    io.emit('leaderboard', []);
    io.emit('panel:stats', { totalPlayers: 0, leaderboard: [] });
    broadcastQueueStatus();
  });

  // Panel Control Commands
  socket.on('panel:camera-cmd', cmd => {
    io.emit('client:camera-cmd', cmd);
  });

  socket.on('panel:force-pose', ({ pose, durationMs = 3500 } = {}) => {
    io.emit('client:force-pose', { pose, durationMs });
  });

  socket.on('panel:debug-toggle', enabled => {
    io.emit('client:debug-toggle', enabled);
  });

  socket.on('panel:test-voice', () => {
    io.emit('client:test-voice');
  });

  socket.emit('client:voice-speed', currentVoiceSpeed);

  socket.on('panel:voice-speed', speed => {
    currentVoiceSpeed = Math.max(0.8, Math.min(2.0, Number(speed) || 1.28));
    io.emit('client:voice-speed', currentVoiceSpeed);
  });

  // Dynamic TikTok Live Connection from Panel
  socket.emit('tiktok:status', {
    connected: isConnected,
    connecting: isConnecting,
    username: currentTiktokUsername,
    roomId: currentRoomId
  });

  socket.on('panel:tiktok-connect', (data) => {
    const user = typeof data === 'string' ? data : data?.username;
    connectToTikTok(user);
  });

  socket.on('panel:tiktok-disconnect', () => {
    disconnectTikTok();
  });
});

server.listen(PORT, () => {
  console.log(`🎣 Fishing Live Stream running at http://localhost:${PORT}`);
  console.log(`🎛️ Streamer Control Panel ready at http://localhost:${PORT}/panel`);
});

let currentTiktokUsername = HOSTNAME;
let currentRoomId = null;
let currentConnection = null;
let isConnecting = false;
let isConnected = false;
let retryTimer = null;

function disconnectTikTok() {
  clearTimeout(retryTimer);
  retryTimer = null;
  if (currentConnection) {
    try {
      currentConnection.disconnect();
    } catch (_) { }
    currentConnection = null;
  }
  isConnecting = false;
  isConnected = false;
  currentRoomId = null;
  console.log(`🔌 [TikTok] Đã ngắt kết nối khỏi phòng LIVE của @${currentTiktokUsername || 'Unknown'}.`);
  resetLiveSessionData('Chủ động ngắt kết nối phòng LIVE');
  io.emit('tiktok:status', { connected: false, username: currentTiktokUsername });
}

function connectToTikTok(targetUsername) {
  const username = String(targetUsername || currentTiktokUsername || '').replace(/^@/, '').trim();
  if (!username) {
    console.warn('[TikTok] Tên người dùng TikTok rỗng, không thể kết nối.');
    return;
  }

  clearTimeout(retryTimer);
  retryTimer = null;
  if (currentConnection) {
    try { currentConnection.disconnect(); } catch (_) { }
    currentConnection = null;
  }

  currentTiktokUsername = username;
  isConnecting = true;
  isConnected = false;
  currentRoomId = null;
  console.log(`[TikTok] Đang kết nối tới phòng LIVE của @${username}...`);
  io.emit('tiktok:status', { connected: false, connecting: true, username });

  const sessionId = (process.env.TIKTOK_SESSION_ID || '').trim();
  const connOptions = {
    processInitialData: false,
    enableExtendedGiftInfo: false,
    fetchRoomInfoOnConnect: false,
    requestPollingIntervalMs: 1000
  };

  if (sessionId) {
    connOptions.session = {
      cookie: {
        type: 'cookie',
        value: {
          sessionId: sessionId,
          ttTargetIdc: 'useast2a'
        }
      }
    };
    connOptions.wsClientOptions = {
      headers: {
        Cookie: `sessionid=${sessionId}; sessionid_ss=${sessionId}`
      }
    };
  }

  const connection = new TikTokLiveConnection(username, connOptions);
  currentConnection = connection;

  connection.connect().then(state => {
    isConnecting = false;
    isConnected = true;
    const isNewRoom = currentRoomId && String(state.roomId) !== String(currentRoomId);
    if (isNewRoom) {
      resetLiveSessionData(`Phát hiện phiên LIVE mới (Room ID đổi từ ${currentRoomId} sang ${state.roomId})`);
    }
    currentRoomId = state.roomId;
    console.log(`✅ [TikTok] Đã kết nối thành công phòng LIVE của @${username} (Room ID: ${state.roomId})`);
    io.emit('tiktok:status', { connected: true, username, roomId: state.roomId });
    io.emit('panel:event-log', {
      type: 'tiktok-connected',
      username,
      roomId: state.roomId,
      time: Date.now()
    });
  }).catch(error => {
    isConnecting = false;
    isConnected = false;
    currentRoomId = null;
    const msg = error.message || 'Chưa phát LIVE';
    let hint = '';
    let retryDelay = 15000;
    if (msg.includes('offline') || msg.includes("isn't online") || msg.includes('ended')) {
      hint = ' (Streamer đang offline hoặc chưa bật LIVE)';
      retryDelay = 20000;
      if (players.size > 0) {
        resetLiveSessionData('Streamer offline / đã tắt LIVE');
      }
    } else if (msg.includes('rate_limit') || msg.includes('Rate Limited')) {
      hint = ' (Đang chờ hồi kết nối Euler Stream...)';
      retryDelay = 45000;
    } else if (msg.includes('DEVICE_BLOCKED')) {
      hint = ' (TikTok tạm chặn IP ẩn danh. Hãy điền TIKTOK_SESSION_ID vào .env để vào trực tiếp!)';
      retryDelay = 30000;
    } else if (msg.includes('Business plan') || msg.includes('Euler')) {
      hint = ' (Chưa phát LIVE hoặc phòng riêng tư)';
      retryDelay = 20000;
    }
    console.warn(`⏳ [TikTok] Chưa kết nối được tới @${username} (${msg}${hint}). Sẽ tự động thử lại sau ${Math.round(retryDelay / 1000)} giây...`);
    io.emit('tiktok:status', { connected: false, error: `${msg}${hint}`, username });
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (currentTiktokUsername === username) connectToTikTok(username);
    }, retryDelay);
  });

  connection.on(WebcastEvent.CHAT, data => {
    if (!data) return;
    const user = extractUserFromEvent(data);
    if (!user || !user.id) return;
    const commentText = String(data.content || data.comment || data.text || '').trim();
    const commentLower = commentText.toLowerCase();

    // LỆNH RỜI BỜ CHỦ ĐỘNG QUA BÌNH LUẬN (người dùng muốn thoát):
    const LEAVE_KEYWORDS = ['thoát', 'thoat', 'out', 'rời', 'roi', 've', 'về', 'nghỉ', 'nghi', 'bye', 'tam biet', 'tạm biệt'];
    const isLeaveCmd = LEAVE_KEYWORDS.some(kw => commentLower === kw || commentLower.startsWith(kw + ' '));
    if (isLeaveCmd) {
      const existing = players.get(String(user.id || user.userId || user.uniqueId || ''));
      if (existing && existing.onBank) {
        existing.onBank = false;
        existing.hasPendingTurn = false;
        existing.isWatching = false;
        console.log(`👋 [Rời bờ chủ động] @${existing.username} bình luận "${commentText}" -> Rời khỏi bờ câu.`);
        io.emit('player:leave', { playerId: existing.id, username: existing.username, time: Date.now() });
        io.emit('panel:event-log', { type: 'leave', username: existing.username, reason: 'Chủ động rời qua bình luận', time: Date.now() });
      }
      return;
    }
    
    // Kiểm tra xem người này có đang ở ngoài bờ hay không
    const existing = players.get(String(user.id || user.userId || user.uniqueId || ''));
    const wasOffBank = !existing || existing.onBank === false;

    // BÌNH LUẬN BẤT KỲ: Cần thủ chính thức được bước vào bờ câu cá!
    const p = ensurePlayer(user, true);
    p.hasPendingTurn = true;
    p.lastSeenWatchingAt = Date.now();
    p.isWatching = true;
    p.lastActiveAt = Date.now();
    console.log(`💬 [TikTok Chat] @${p.username}: "${commentText}" -> ${wasOffBank ? 'Bước vào bờ câu (chờ 1 phút hồi chiêu)' : 'Đang trên bờ'}`);
    io.emit('panel:event-log', {
      type: 'chat',
      username: p.username,
      comment: commentText,
      time: Date.now()
    });

    // BỎ LƯỢT CÂU MIỄN PHÍ KHI VỪA VÀO BỜ:
    // Cần thủ vào bờ vẫn phải chờ đủ 1 phút (60s) hồi chiêu mới được câu cá miễn phí!
    if (wasOffBank) {
      p.cooldownUntil = Date.now() + (p.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC) * 1000;
      io.emit('player:cooldown', {
        playerId: p.id,
        username: p.username,
        remainingSec: p.currentCooldownSec || DEFAULT_FREE_COOLDOWN_SEC,
        isNewJoin: true
      });
    } else {
      const triggered = triggerFreeCast(p);
      if (!triggered) {
        const chk = canPlayerFreeCast(p);
        if (!chk.allowed) {
          io.emit('player:cooldown', {
            playerId: p.id,
            username: p.username,
            remainingSec: chk.remainingSec
          });
        }
      }
    }
  });

  // Tích hợp sự kiện Thả Tim (Like) từ TikTok LIVE:
  // Thả tim là bằng chứng người xem đang chạm màn hình xem live -> Tự động gia hạn 2.5 phút và giảm hồi chiêu
  connection.on(WebcastEvent.LIKE, data => {
    if (!data) return;
    const user = extractUserFromEvent(data);
    if (!user || !user.id) return;
    const p = markViewerWatching(user) || players.get(String(user.id || user.userId || user.uniqueId || user.displayId || ''));
    if (!p) return;
    const now = Date.now();
    p.lastActiveAt = now;
    p.lastInteractionAt = now; // Thả tim chạm màn hình -> Reset ngay mốc 150s!
    p.lastSeenWatchingAt = now;
    p.isWatching = true;

    if (p.onBank === false) return; // Chưa bình luận vào bờ -> không xử lý giảm hồi chiêu

    const count = Math.max(1, Number(data.likeCount || data.count || 1));
    const res = handlePlayerLike(p, count);
    if (res.reducedSec > 0) {
      io.emit('player:like-boost', {
        playerId: p.id,
        username: p.username,
        totalLikes: p.totalLikes,
        pendingLikes: p.pendingLikes,
        reducedSec: res.reducedSec,
        currentCooldownSec: res.currentCooldownSec,
        cooldownUntil: p.cooldownUntil
      });
    }
  });

  // Tích hợp sự kiện Tặng Quà (Gift) từ TikTok LIVE:
  // Tự động nhận diện giá trị xu (Diamond = Coin) và ưu tiên giật cần ngay lập tức!
  connection.on(WebcastEvent.GIFT, data => {
    if (!data) return;
    const res = resolveGiftCost(data);
    const user = extractUserFromEvent(data);
    if (!user || !user.id) return;
    const player = ensurePlayer(user, true); // Tặng quà cũng vào bờ câu cá!
    const now = Date.now();
    player.lastActiveAt = now;
    player.lastInteractionAt = now; // Tặng quà -> Reset ngay mốc 150s!
    player.lastSeenWatchingAt = now;
    player.isWatching = true;
    player.lastActiveAt = Date.now();
    player.lastSeenWatchingAt = Date.now();
    player.isWatching = true;

    console.log(`🎁 [TikTok Gift] @${player.username} tặng "${res.giftName}" x${res.repeatCount} (${res.coinCost} xu) -> Ưu tiên giật cần ngay!`);
    io.emit('panel:event-log', {
      type: 'gift',
      giftId: res.giftId,
      giftName: res.giftName,
      repeatCount: res.repeatCount,
      diamondCount: res.diamondCount,
      coins: res.coinCost,
      username: player.username,
      time: Date.now()
    });

    if (res.coinCost <= 0) return;
    castLine(player, { giftName: res.giftName, coins: res.coinCost });
  });

  // Tích hợp sự kiện danh sách người xem phòng LIVE (ROOM_USER):
  // TikTok gửi định kỳ mỗi 2-4s chứa danh sách topViewers và số lượng người xem (viewerCount).
  // Đảm bảo: Người xem ĐANG XEM dù KHÔNG TƯƠNG TÁC (không comment, không thả tim) VẪN SẼ Ở LẠI TRÊN BỜ!
  connection.on(WebcastEvent.ROOM_USER, data => {
    if (!data) return;
    const count = Number(data.viewerCount ?? data.totalUser ?? 0);
    const now = Date.now();
    if (count > 0) {
      currentViewerCount = count;
      lastZeroViewerAt = null;
      // Khi phòng đang có người xem: duy trì trạng thái xem cho tất cả cần thủ đang trên bờ
      for (const p of players.values()) {
        if (p.onBank) {
          p.lastSeenWatchingAt = now;
          p.isWatching = true;
        }
      }
    } else if (count === 0 && !lastZeroViewerAt) {
      currentViewerCount = 0;
      lastZeroViewerAt = now;
    }

    const topViewers = data.topViewers || data.ranksList;
    if (Array.isArray(topViewers)) {
      for (const item of topViewers) {
        markViewerWatching(item?.user || item);
      }
    }
  });

  // Tích hợp sự kiện người xem tham gia phòng (MEMBER):
  // CHỈ ghi nhận log xem live, KHÔNG cho vào bờ câu (Người xem phải bình luận bất kỳ mới được vào câu)
  connection.on(WebcastEvent.MEMBER, data => {
    if (!data) return;
    const user = extractUserFromEvent(data);
    if (!user || !user.id) return;
    markViewerWatching(user);
    const name = user.nickname || user.username || user.displayId || 'Người xem';
    console.log(`👋 [TikTok Join] @${name} đã vào phòng (chưa bình luận, không vào bờ)`);
    io.emit('panel:event-log', {
      type: 'join',
      username: name,
      time: Date.now()
    });
  });

  function scheduleReconnect(delayMs = 15000) {
    isConnected = false;
    currentRoomId = null;
    if (retryTimer) return; // Đang có hẹn giờ kết nối lại, tránh tạo trùng
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (currentTiktokUsername === username) connectToTikTok(username);
    }, delayMs);
  }

  connection.on('disconnected', () => {
    console.warn(`⚠️ [TikTok] Phòng LIVE của @${username} đã ngắt kết nối. Thử kết nối lại sau 15s...`);
    io.emit('tiktok:status', { connected: false, username });
    scheduleReconnect(15000);
  });

  connection.on('error', err => {
    console.warn(`⚠️ [TikTok Socket Error] @${username}: ${err?.message || err}. Thử kết nối lại sau 15s...`);
    io.emit('tiktok:status', { connected: false, error: err?.message, username });
    scheduleReconnect(15000);
  });

  connection.on('streamEnd', () => {
    console.log(`🛑 [TikTok] Phiên LIVE của @${username} đã kết thúc hoặc streamer đang offline. Tự động kiểm tra lại sau 20s...`);
    resetLiveSessionData('Phiên LIVE đã kết thúc (streamEnd)');
    io.emit('tiktok:status', { connected: false, streamEnd: true, username });
    scheduleReconnect(20000);
  });
}

// Watchdog kiểm tra kết nối định kỳ mỗi 30 giây:
// Nếu WebSocket bị ngắt và chưa có hẹn giờ kết nối lại -> kết nối lại
setInterval(() => {
  if (currentTiktokUsername && !isConnecting && !isConnected && !retryTimer) {
    console.log(`🔄 [Watchdog] Tự động thử kết nối lại với @${currentTiktokUsername}...`);
    connectToTikTok(currentTiktokUsername);
  }
}, 30000);

if (currentTiktokUsername) {
  connectToTikTok(currentTiktokUsername);
} else {
  console.log(`ℹ️ [TikTok] Chưa cấu hình TIKTOK_USERNAME trong file .env -> Có thể kết nối trực tiếp từ Panel.`);
}
