const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const crypto = require('crypto');

// Support both tiktok-live-connector legacy and modern exports
let WebcastPushConnection;
try {
  WebcastPushConnection = require('tiktok-live-connector/legacy').WebcastPushConnection;
} catch (e) {
  const mod = require('tiktok-live-connector');
  WebcastPushConnection = mod.WebcastPushConnection || mod.TikTokLiveConnection;
}

// Bypass EulerStream commercial paywall on pre-fetching gift lists
try {
  const { RouteConfig } = require('tiktok-live-connector');
  if (RouteConfig) {
    RouteConfig.fetchRoomGifts = async () => [];
    RouteConfig.fetchRoomGiftsFromProvider = async () => [];
  }
} catch (e) {}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Guard against unhandled errors from third-party protobuf events
process.on('uncaughtException', err => {
  console.error('[Uncaught Exception]:', err.message);
});
process.on('unhandledRejection', reason => {
  console.error('[Unhandled Rejection]:', reason);
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure directories
const CACHE_DIR = path.join(__dirname, 'public', 'audio_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Load fortunes
let fortunes = [];
try {
  const fortunesData = fs.readFileSync(path.join(__dirname, 'fortunes.json'), 'utf8');
  fortunes = JSON.parse(fortunesData);
} catch (e) {
  console.error('Error loading fortunes:', e);
}

// App State
let tiktokConnection = null;
let currentTiktokUser = '';
let currentSessionId = '';
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
let simulationTimer = null;
let isSimulating = false;

// Initial Leaderboard state
let leaderboard = [
  { uniqueId: 'richardnguyen', nickname: 'RICHARD NGUYỄN', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face', score: 205 },
  { uniqueId: 'longtran', nickname: 'Long Tran', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop&crop=face', score: 204 },
  { uniqueId: 'dieunguyen', nickname: 'dieu.nguyen191298', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face', score: 122 },
  { uniqueId: 'phuyen', nickname: 'Phú Yên 🎧', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face', score: 100 },
  { uniqueId: 'tiknguyenn', nickname: 'tiknguyenn', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face', score: 60 },
  { uniqueId: 'tienly', nickname: 'Tiên Lý', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face', score: 60 },
  { uniqueId: 'quanghuynh', nickname: 'QUANG HUỲNH', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face', score: 60 }
];

// App Configuration
let appConfig = {
  ttsEnabled: true,
  ttsVoice: 'vi-VN-HoaiMyNeural',
  ttsRate: '+0%',
  moInterval: 3200,
  autoBow: true,
  bellOnGift: true,
  bgmEnabled: true,
  bgmTrack: 'zen_guzheng',
  bgmVolume: 0.35,
  minGiftCoinsForAltar: 5,
  minGiftCoinsForFortune: 10,
  minLikesForFlowers: 50,
  startWithEmptyMats: true // start with empty mats, real people walk in from center!
};

// Update donor in leaderboard
function recordDonation(user, coins) {
  if (!user || coins <= 0) return;
  const existing = leaderboard.find(item => item.uniqueId === user.uniqueId);
  if (existing) {
    existing.score += coins;
    if (user.avatar) existing.avatar = user.avatar;
    if (user.nickname) existing.nickname = user.nickname;
  } else {
    leaderboard.push({
      uniqueId: user.uniqueId || `user_${Date.now()}`,
      nickname: user.nickname || 'Phật tử ẩn danh',
      avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
      score: coins
    });
  }
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 20);
  io.emit('leaderboard_update', leaderboard);
}

// Generate speech file
function generateSpeechFile(text, voice = appConfig.ttsVoice, rate = appConfig.ttsRate) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5').update(`${text}_${voice}_${rate}`).digest('hex');
    const filename = `${hash}.mp3`;
    const outputPath = path.join(CACHE_DIR, filename);
    const publicUrl = `/audio_cache/${filename}`;

    if (fs.existsSync(outputPath)) {
      return resolve(publicUrl);
    }

    const scriptPath = path.join(__dirname, 'tts_service.py');
    execFile('python', [scriptPath, text, outputPath, '--voice', voice, '--rate', rate], (error, stdout, stderr) => {
      if (error) {
        console.error('TTS error:', stderr || error.message);
        return reject(error);
      }
      resolve(publicUrl);
    });
  });
}

// Generate blessing text based on gift and real name
function generateBlessingText(nickname, giftName, coins) {
  const randomFort = fortunes[Math.floor(Math.random() * fortunes.length)];
  let actionText = '';
  let blessingText = '';

  if (coins >= 10) {
    actionText = `thành tâm dâng ${giftName || 'Đại Lễ'}, lên bục đỏ trước Tam Bảo gieo quẻ cát tường.`;
    blessingText = randomFort ? randomFort.blessing : 'Nguyện Đức Phật từ bi gia hộ vạn sự như ý, công danh rạng rỡ!';
  } else if (coins >= 5) {
    actionText = `thành tâm dâng ${giftName || 'Lễ Vật'}, lên bục quỳ trước Tam Bảo.`;
    blessingText = 'Nguyện cho học hành đỗ đạt, thi cử điểm cao, công việc thuận buồm xuôi gió, bình an may mắn!';
  } else if (coins >= 1) {
    actionText = `thành tâm dâng nén tâm hương thơm ngát lên bàn thờ Phật.`;
    blessingText = 'Nguyện cho thân tâm an lạc, tai qua nạn khỏi, gia đạo êm ấm bình an!';
  } else {
    actionText = `thành tâm dâng hoa tươi cúng dường Tam Bảo.`;
    blessingText = 'Nguyện cầu phước đức vô lượng, bình an vạn dặm!';
  }

  const spoken = `Thành tâm cảm tạ Phật tử ${nickname} đã dâng ${giftName || (coins + ' xu')}. ${blessingText} Nam Mô A Di Đà Phật!`;
  const banner = `${nickname} ${actionText} ${blessingText}`;

  return { banner, spoken, fortune: randomFort };
}

// Generate personalized blessing when viewer joins live stream
const WELCOME_BLESSINGS = [
  'Cầu chúc thí chủ thân tâm thường an lạc, gia đạo bình an, sở cầu như ý!',
  'Nguyện Đức Phật từ bi gia hộ cho thí chủ tai qua nạn khỏi, may mắn vạn dặm!',
  'Cầu chúc thí chủ cùng gia quyến vạn sự hanh thông, tài lộc dồi dào, phúc thọ tăng long!',
  'Nguyện cho thí chủ sức khỏe dồi dào, tâm an trí sáng, công việc thuận buồm xuôi gió!',
  'Cầu chúc thí chủ trăm sự như ý, vạn sự cát tường, gặt hái nhiều phước báu!',
  'Cầu mong thí chủ luôn gặp quý nhân phù trợ, một đời bình an, hạnh phúc tròn đầy!'
];

function generateWelcomeBlessing(nickname) {
  const template = WELCOME_BLESSINGS[Math.floor(Math.random() * WELCOME_BLESSINGS.length)];
  const personalized = template.replace(/thí chủ/g, nickname);
  const banner = `Chào đón Phật tử ${nickname} ghé thăm chánh điện cầu an. ${personalized}`;
  const spoken = `Chào đón Phật tử ${nickname} đã đến chùa cầu an. ${personalized} Nam Mô A Di Đà Phật!`;
  return { banner, spoken, blessing: personalized };
}

// ==================== TIKTOK LIVE CONNECTION ====================

function connectToTikTok(uniqueId, sessionId = '') {
  if (tiktokConnection) {
    try {
      tiktokConnection.disconnect();
    } catch (e) {}
    tiktokConnection = null;
  }

  currentTiktokUser = uniqueId.trim().replace(/^@/, '');
  currentSessionId = (sessionId || '').trim();
  connectionStatus = 'connecting';
  io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser });

  const connectionOptions = {
    processInitialData: false,
    enableExtendedGiftInfo: false,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000,
    requestHeaders: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    }
  };

  if (currentSessionId) {
    connectionOptions.sessionId = currentSessionId;
  }

  try {
    tiktokConnection = new WebcastPushConnection(currentTiktokUser, connectionOptions);

    tiktokConnection.connect().then(state => {
      connectionStatus = 'connected';
      console.log(`[TikTok Live] Đã kết nối thành công: @${currentTiktokUser} (Room ID: ${state.roomId})`);
      io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser, roomId: state.roomId });
    }).catch(err => {
      connectionStatus = 'error';
      console.error('[TikTok Live Error]:', err.message);

      let friendlyError = err.message;
      if (err.message.includes('The requested user isn\'t online') || err.message.includes('not online')) {
        friendlyError = `Kênh @${currentTiktokUser} hiện đang OFFLINE (chưa bấm phát trực tiếp trên điện thoại). Vui lòng BẬT LIVE trên TikTok trước!`;
      } else if (err.message.includes('Business plan') || err.message.includes('eulerstream')) {
        friendlyError = `Kênh @${currentTiktokUser} chưa bật Live hoặc cần dán Cookie Session ID để xác minh.`;
      } else if (err.message.includes('Unexpected token') || err.message.includes('<!DOCTYPE') || err.message.includes('not valid JSON')) {
        friendlyError = `Kênh @${currentTiktokUser} hiện chưa phát trực tiếp (Offline). Hãy chắc chắn kênh ĐANG LIVE trên TikTok!`;
      } else if (err.message.includes('LIVE has ended')) {
        friendlyError = `Buổi phát trực tiếp của @${currentTiktokUser} đã kết thúc.`;
      }

      io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser, error: friendlyError });
    });

    // Chat message from real user
    tiktokConnection.on('chat', data => {
      const commentText = (data.comment || data.content || data.text || data.message || '').toString().trim();
      const nickname = data.nickname || data.user?.nickname || data.uniqueId || data.user?.uniqueId || 'Phật tử';
      const uniqueId = data.uniqueId || data.user?.uniqueId || data.userId || `user_${Date.now()}`;
      const avatar = data.profilePictureUrl || data.user?.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';

      console.log(`[TikTok Chat] ${nickname}: "${commentText}"`);

      if (!commentText || commentText === 'undefined') return;

      const chatData = {
        uniqueId: uniqueId,
        nickname: nickname,
        avatar: avatar,
        comment: commentText
      };
      io.emit('tiktok_chat', chatData);
    });

    // Gift from real user
    tiktokConnection.on('gift', async data => {
      if (data.giftType === 1 && !data.repeatEnd) {
        return;
      }

      const diamondCount = (data.diamondCount || data.coins || 1) * (data.repeatCount || 1);
      const nickname = data.nickname || data.user?.nickname || data.uniqueId || 'Phật tử';
      const uniqueId = data.uniqueId || data.user?.uniqueId || data.userId || `user_${Date.now()}`;
      const avatar = data.profilePictureUrl || data.user?.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';
      const giftName = data.giftName || data.gift?.name || 'Lễ Vật Cúng Dường';

      const giftData = {
        uniqueId: uniqueId,
        nickname: nickname,
        avatar: avatar,
        giftName: giftName,
        giftId: data.giftId,
        repeatCount: data.repeatCount || 1,
        coins: diamondCount
      };

      console.log(`[TikTok Gift] ${nickname} dâng ${giftName} (${diamondCount} xu)`);

      recordDonation(giftData, diamondCount);

      const blessing = generateBlessingText(giftData.nickname, `${giftData.giftName} x${giftData.repeatCount}`, diamondCount);
      let audioUrl = null;
      if (appConfig.ttsEnabled) {
        try {
          audioUrl = await generateSpeechFile(blessing.spoken);
        } catch (e) {
          console.error('TTS error on gift:', e);
        }
      }

      io.emit('tiktok_gift', {
        ...giftData,
        bannerText: blessing.banner,
        spokenText: blessing.spoken,
        audioUrl: audioUrl,
        fortune: blessing.fortune
      });
    });

    // Likes from real user
    let accumulatedLikes = 0;
    tiktokConnection.on('like', async data => {
      accumulatedLikes += (data.likeCount || 1);
      io.emit('tiktok_like', {
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
        likeCount: data.likeCount || 1,
        totalLikes: accumulatedLikes
      });

      if (accumulatedLikes >= appConfig.minLikesForFlowers) {
        accumulatedLikes = 0;
        const blessing = generateBlessingText(data.nickname || data.uniqueId, '50 Tim Dâng Hoa', 0);
        let audioUrl = null;
        if (appConfig.ttsEnabled) {
          try {
            audioUrl = await generateSpeechFile(blessing.spoken);
          } catch (e) {}
        }

        io.emit('offering_event', {
          type: 'flower_offering',
          nickname: data.nickname || data.uniqueId,
          avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face',
          uniqueId: data.uniqueId,
          bannerText: blessing.banner,
          audioUrl: audioUrl
        });
      }
    });

    // Share event
    tiktokConnection.on('share', data => {
      io.emit('tiktok_share', {
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face'
      });
    });

    // Follow event
    tiktokConnection.on('follow', data => {
      io.emit('tiktok_follow', {
        uniqueId: data.uniqueId,
        nickname: data.nickname || data.uniqueId,
        avatar: data.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face'
      });
    });

    // Member joins live - Send personalized peace blessing by real name
    let lastJoinWelcomeTime = 0;
    tiktokConnection.on('member', async data => {
      const nickname = data.nickname || data.user?.nickname || data.uniqueId || 'Phật tử';
      const uniqueId = data.uniqueId || data.user?.uniqueId || data.userId || `user_${Date.now()}`;
      const avatar = data.profilePictureUrl || data.user?.profilePictureUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face';

      console.log(`[TikTok Join] ${nickname} đã vào buổi lễ cầu an`);

      const now = Date.now();
      const shouldSpeak = (now - lastJoinWelcomeTime) > 4500;
      if (shouldSpeak) {
        lastJoinWelcomeTime = now;
      }

      const welcome = generateWelcomeBlessing(nickname);
      let audioUrl = null;
      if (shouldSpeak && appConfig.ttsEnabled) {
        try {
          audioUrl = await generateSpeechFile(welcome.spoken);
        } catch (e) {}
      }

      io.emit('tiktok_join', {
        uniqueId,
        nickname,
        avatar,
        bannerText: welcome.banner,
        spokenText: shouldSpeak ? welcome.spoken : null,
        audioUrl: audioUrl
      });
    });

    tiktokConnection.on('streamEnd', () => {
      connectionStatus = 'disconnected';
      io.emit('connection_status', { status: 'streamEnd', user: currentTiktokUser, error: 'Buổi livestream đã kết thúc.' });
    });

    tiktokConnection.on('disconnected', () => {
      connectionStatus = 'disconnected';
      io.emit('connection_status', { status: 'disconnected', user: currentTiktokUser });
    });

  } catch (err) {
    connectionStatus = 'error';
    io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser, error: err.message });
  }
}

function disconnectTikTok() {
  if (tiktokConnection) {
    try {
      tiktokConnection.disconnect();
    } catch (e) {}
    tiktokConnection = null;
  }
  connectionStatus = 'disconnected';
  io.emit('connection_status', { status: connectionStatus, user: currentTiktokUser });
}

// ==================== AUTO SIMULATION MODE ====================

const SAMPLE_NAMES = [
  'Nguyễn Hoàng Long', 'Trần Thị Mai', 'Phan Minh Khang', 'Vũ Diệu Linh',
  'Lê Thanh Tùng', 'Phạm Thu Thủy', 'Đỗ Quỳnh Anh', 'Bùi Gia Huy',
  'Nguyễn Ánh Dương', 'Trịnh Bảo Ngọc', 'Hoàng Tuấn Kiệt', 'Đặng Kim Ngân'
];

const SAMPLE_COMMENTS = [
  'Nam Mô A Di Đà Phật 🙏',
  'Con kính lạy Đức Phật từ bi gia hộ cho gia đình con luôn bình an',
  'Cầu mong cho kì thi sắp tới điểm cao, đỗ đạt như ý nguyện ạ',
  'Nam Mô Bổn Sư Thích Ca Mâu Ni Phật 🙏',
  'Cầu sức khỏe cho ba mẹ bách niên giai lão',
  'Cầu cho công việc buôn bán thuận buồm xuôi gió, phát tài phát lộc',
  'Con thành tâm sám hối, nguyện thân tâm an lạc',
  'May mắn cả năm, vạn sự hanh thông'
];

function startSimulation() {
  if (isSimulating) return;
  isSimulating = true;
  io.emit('simulation_status', { active: true });

  simulationTimer = setInterval(() => {
    const rand = Math.random();
    const name = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
    const id = `user_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const avatar = `https://images.unsplash.com/photo-${1535713875000 + Math.floor(Math.random() * 500)}?w=100&h=100&fit=crop&crop=face`;

    if (rand < 0.6) {
      // Simulate chat / new person entering
      const comment = SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];
      io.emit('tiktok_chat', { uniqueId: id, nickname: name, avatar, comment });
    } else if (rand < 0.8) {
      // Simulate Like
      io.emit('tiktok_like', { uniqueId: id, nickname: name, avatar, likeCount: 5, totalLikes: 25 });
    } else {
      // Simulate Gift (5 or 10 coins)
      const coins = Math.random() > 0.5 ? 10 : 5;
      const giftName = coins >= 10 ? 'Mũ Vương Miện' : 'Hoa Sen Vàng';
      const blessing = generateBlessingText(name, giftName, coins);

      recordDonation({ uniqueId: id, nickname: name, avatar }, coins);

      io.emit('tiktok_gift', {
        uniqueId: id,
        nickname: name,
        avatar: avatar,
        giftName: giftName,
        giftId: 100,
        repeatCount: 1,
        coins: coins,
        bannerText: blessing.banner,
        spokenText: blessing.spoken,
        audioUrl: null,
        fortune: blessing.fortune
      });
    }
  }, 4500);
}

function stopSimulation() {
  isSimulating = false;
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
  io.emit('simulation_status', { active: false });
}

// ==================== REST APIS ====================

app.get('/api/fortunes', (req, res) => res.json(fortunes));
app.get('/api/fortune/random', (req, res) => {
  res.json(fortunes[Math.floor(Math.random() * fortunes.length)]);
});

app.get('/api/leaderboard', (req, res) => res.json(leaderboard));

app.post('/api/leaderboard/reset', (req, res) => {
  leaderboard = [];
  io.emit('leaderboard_update', leaderboard);
  res.json({ success: true, leaderboard });
});

app.get('/api/config', (req, res) => {
  res.json({
    config: appConfig,
    tiktokUser: currentTiktokUser,
    connectionStatus: connectionStatus,
    isSimulating: isSimulating
  });
});

app.post('/api/config', (req, res) => {
  appConfig = { ...appConfig, ...req.body };
  io.emit('config_update', appConfig);
  res.json({ success: true, config: appConfig });
});

// TTS generator endpoint
app.get('/api/tts', async (req, res) => {
  const text = req.query.text;
  if (!text) return res.status(400).send('Missing text parameter');
  const voice = req.query.voice || appConfig.ttsVoice;
  const rate = req.query.rate || appConfig.ttsRate;

  try {
    const audioUrl = await generateSpeechFile(text, voice, rate);
    res.json({ success: true, audioUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TikTok Connect/Disconnect API
app.post('/api/tiktok/connect', (req, res) => {
  const { uniqueId, sessionId } = req.body;
  if (!uniqueId) return res.status(400).json({ error: 'Username is required' });
  connectToTikTok(uniqueId, sessionId);
  res.json({ success: true, message: `Connecting to @${uniqueId}` });
});

app.post('/api/tiktok/disconnect', (req, res) => {
  disconnectTikTok();
  res.json({ success: true, message: 'Disconnected' });
});

// Simulation API
app.post('/api/simulation/toggle', (req, res) => {
  if (isSimulating) {
    stopSimulation();
  } else {
    startSimulation();
  }
  res.json({ success: true, isSimulating });
});

// Test Simulation Events
app.post('/api/test/chat', (req, res) => {
  const nickname = req.body.nickname || SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
  const comment = req.body.comment || SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];
  const chatData = {
    uniqueId: req.body.uniqueId || `user_${nickname.toLowerCase().replace(/\s+/g, '_')}`,
    nickname: nickname,
    avatar: req.body.avatar || `https://images.unsplash.com/photo-${1535713875000 + Math.floor(Math.random() * 500)}?w=100&h=100&fit=crop&crop=face`,
    comment: comment
  };
  io.emit('tiktok_chat', chatData);
  res.json({ success: true, chatData });
});

app.post('/api/test/join', async (req, res) => {
  const nickname = req.body.nickname || SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
  const avatar = req.body.avatar || `https://images.unsplash.com/photo-${1535713875000 + Math.floor(Math.random() * 500)}?w=100&h=100&fit=crop&crop=face`;
  const uniqueId = req.body.uniqueId || `user_${nickname.toLowerCase().replace(/\s+/g, '_')}`;

  const welcome = generateWelcomeBlessing(nickname);
  let audioUrl = null;
  if (appConfig.ttsEnabled) {
    try {
      audioUrl = await generateSpeechFile(welcome.spoken);
    } catch (e) {}
  }

  const payload = {
    uniqueId,
    nickname,
    avatar,
    bannerText: welcome.banner,
    spokenText: welcome.spoken,
    audioUrl
  };

  io.emit('tiktok_join', payload);
  res.json({ success: true, payload });
});

app.post('/api/test/gift', async (req, res) => {
  const coins = parseInt(req.body.coins || 1, 10);
  const giftName = req.body.giftName || (coins >= 10 ? 'Mũ Vương Miện' : (coins >= 5 ? 'Hoa Sen Vàng' : 'Nhang Trầm'));
  const nickname = req.body.nickname || 'Dương Tử Linh';
  const avatar = req.body.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face';

  const giftData = {
    uniqueId: req.body.uniqueId || `user_${nickname.toLowerCase().replace(/\s+/g, '_')}`,
    nickname: nickname,
    avatar: avatar,
    giftName: giftName,
    giftId: req.body.giftId || 1001,
    repeatCount: req.body.repeatCount || 1,
    coins: coins
  };

  recordDonation(giftData, coins);

  const blessing = generateBlessingText(nickname, `${giftName} x${giftData.repeatCount}`, coins);
  let audioUrl = null;
  if (appConfig.ttsEnabled) {
    try {
      audioUrl = await generateSpeechFile(blessing.spoken);
    } catch (e) {
      console.error('Speech synthesis error in test:', e);
    }
  }

  const payload = {
    ...giftData,
    bannerText: blessing.banner,
    spokenText: blessing.spoken,
    audioUrl: audioUrl,
    fortune: blessing.fortune
  };

  io.emit('tiktok_gift', payload);
  res.json({ success: true, payload });
});

app.post('/api/test/bow', (req, res) => {
  io.emit('trigger_all_bow', { duration: req.body.duration || 3200 });
  res.json({ success: true, message: 'Triggered group bow' });
});

app.post('/api/test/fill-full', (req, res) => {
  io.emit('fill_all_seats');
  res.json({ success: true, message: 'Filled all 50 seats & celebrated' });
});

app.post('/api/test/flower', async (req, res) => {
  const nickname = req.body.nickname || 'Phật Tử Tâm Sen';
  const blessing = generateBlessingText(nickname, '50 Tim Dâng Hoa', 0);
  let audioUrl = null;
  if (appConfig.ttsEnabled) {
    try {
      audioUrl = await generateSpeechFile(blessing.spoken);
    } catch (e) {}
  }
  const payload = {
    type: 'flower_offering',
    nickname: nickname,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face',
    uniqueId: 'phattutamsen',
    bannerText: blessing.banner,
    audioUrl: audioUrl
  };
  io.emit('offering_event', payload);
  res.json({ success: true, payload });
});

// Socket.IO Handling
io.on('connection', socket => {
  socket.emit('init_state', {
    config: appConfig,
    leaderboard: leaderboard,
    fortunes: fortunes,
    tiktokUser: currentTiktokUser,
    connectionStatus: connectionStatus,
    isSimulating: isSimulating
  });

  socket.on('trigger_bow', () => {
    io.emit('trigger_all_bow', { duration: 3200 });
  });

  socket.on('toggle_donation_cards', data => {
    io.emit('toggle_donation_cards', data);
  });

  socket.on('toggle_halo_fx', data => {
    io.emit('toggle_halo_fx', data);
  });

  socket.on('toggle_petals_fx', data => {
    io.emit('toggle_petals_fx', data);
  });

  socket.on('fill_all_seats', () => {
    io.emit('fill_all_seats');
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🌸 CHÙA ONLINE TIKTOK LIVE ĐANG CHẠY TẠI:`);
  console.log(`📺 Màn hình Live (OBS Overlay): http://localhost:${PORT}/index.html`);
  console.log(`🎛️  Bảng Điều Khiển (Admin Panel): http://localhost:${PORT}/admin.html`);
  console.log(`====================================================`);
});
