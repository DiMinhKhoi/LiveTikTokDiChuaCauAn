/**
 * Admin Panel Controller for Buddhist Temple TikTok Live
 */

const socket = io();

// UI Elements
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
const tiktokUserInput = document.getElementById('tiktok-username');
const tiktokSessionInput = document.getElementById('tiktok-sessionid');
const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const btnToggleSim = document.getElementById('btn-toggle-sim');
const logBox = document.getElementById('event-logs');

// Audio / Config Elements
const ttsVoiceSelect = document.getElementById('tts-voice');
const ttsEnabledCheck = document.getElementById('tts-enabled');
const bgmTrackSelect = document.getElementById('bgm-track');
const bgmVolumeInput = document.getElementById('bgm-volume');
const moIntervalInput = document.getElementById('mo-interval');
const btnSaveConfig = document.getElementById('btn-save-config');
const btnTestVoice = document.getElementById('btn-test-voice');

let isSimulating = false;

// Helper to append logs
function addLog(type, message) {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.innerHTML = `<span class="time">[${time}]</span> ${message}`;
  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;
}

// Update connection UI
function updateConnectionUI(status, user = '', error = '') {
  statusBadge.className = `status-badge ${status}`;
  if (status === 'connected') {
    statusText.innerText = `Đã kết nối với @${user}`;
    btnConnect.disabled = true;
    btnDisconnect.disabled = false;
  } else if (status === 'connecting') {
    statusText.innerText = `Đang kết nối tới @${user}...`;
    btnConnect.disabled = true;
    btnDisconnect.disabled = false;
  } else if (status === 'error') {
    statusText.innerText = `Lỗi: ${error || 'Không thể kết nối'}`;
    btnConnect.disabled = false;
    btnDisconnect.disabled = true;
  } else {
    statusText.innerText = 'Chưa kết nối';
    btnConnect.disabled = false;
    btnDisconnect.disabled = true;
  }
}

// Update Simulation button UI
function updateSimUI(active) {
  isSimulating = active;
  if (btnToggleSim) {
    if (active) {
      btnToggleSim.innerText = '⏹️ Dừng Mô Phỏng Livestream';
      btnToggleSim.className = 'btn btn-danger';
    } else {
      btnToggleSim.innerText = '▶️ Bật Mô Phỏng Livestream';
      btnToggleSim.className = 'btn btn-gold';
    }
  }
}

// Socket event listeners
socket.on('init_state', data => {
  if (data.connectionStatus) {
    updateConnectionUI(data.connectionStatus, data.tiktokUser);
  }
  if (data.config) {
    ttsVoiceSelect.value = data.config.ttsVoice || 'vi-VN-HoaiMyNeural';
    ttsEnabledCheck.checked = !!data.config.ttsEnabled;
    moIntervalInput.value = (data.config.moInterval / 1000).toFixed(1);
    if (data.config.bgmTrack && bgmTrackSelect) {
      bgmTrackSelect.value = data.config.bgmTrack;
    }
    if (data.config.bgmVolume !== undefined) {
      bgmVolumeInput.value = data.config.bgmVolume;
    }
  }
  if (data.isSimulating !== undefined) {
    updateSimUI(data.isSimulating);
  }
  addLog('sys', 'Đã kết nối máy chủ điều khiển.');
});

socket.on('connection_status', data => {
  updateConnectionUI(data.status, data.user, data.error);
  if (data.status === 'connected') {
    addLog('sys', `Đã kết nối trực tiếp với phòng Live của @${data.user}!`);
  } else if (data.status === 'error') {
    addLog('sys', `Lỗi kết nối: ${data.error}`);
  }
});

socket.on('simulation_status', data => {
  updateSimUI(data.active);
  addLog('sys', data.active ? 'Đã bật chế độ mô phỏng livestream tự động.' : 'Đã dừng mô phỏng.');
});

socket.on('tiktok_chat', data => {
  const comment = data.comment || data.content || '';
  if (comment && comment !== 'undefined') {
    addLog('chat', `[Chat] <b>${data.nickname || 'Phật tử'}</b>: ${comment}`);
  }
});

socket.on('tiktok_gift', data => {
  addLog('gift', `[Gift] <b>${data.nickname}</b> dâng <b>${data.giftName}</b> (${data.coins} xu)`);
});

socket.on('tiktok_like', data => {
  addLog('like', `[Like] <b>${data.nickname}</b> đã thả tim`);
});

socket.on('tiktok_follow', data => {
  addLog('chat', `[Follow] <b>${data.nickname}</b> đã theo dõi buổi lễ!`);
});

socket.on('tiktok_share', data => {
  addLog('chat', `[Share] <b>${data.nickname}</b> đã chia sẻ buổi lễ!`);
});

socket.on('tiktok_join', data => {
  addLog('sys', `[Vào Live] 🌸 Chào đón <b>${data.nickname}</b> ghé thăm chánh điện cầu an.`);
});

socket.on('offering_event', data => {
  addLog('gift', `[Dâng Lễ] <b>${data.nickname}</b> đã dâng hoa thành công!`);
});

// Connect TikTok Live
btnConnect.addEventListener('click', async () => {
  const username = tiktokUserInput.value.trim().replace(/^@/, '');
  const sessionId = tiktokSessionInput ? tiktokSessionInput.value.trim() : '';

  if (!username) {
    alert('Vui lòng nhập TikTok Username (ví dụ: tranlich.official hoặc anh.miinh)');
    return;
  }
  updateConnectionUI('connecting', username);
  try {
    const res = await fetch('/api/tiktok/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uniqueId: username, sessionId: sessionId })
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error(`Máy chủ trả về phản hồi không hợp lệ: ${text.slice(0, 80)}`);
    }
    addLog('sys', json.message);
  } catch (err) {
    updateConnectionUI('error', username, err.message);
  }
});

btnDisconnect.addEventListener('click', async () => {
  try {
    await fetch('/api/tiktok/disconnect', { method: 'POST' });
    updateConnectionUI('disconnected');
    addLog('sys', 'Đã ngắt kết nối TikTok');
  } catch (err) {
    console.error(err);
  }
});

// Toggle simulation
btnToggleSim.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/simulation/toggle', { method: 'POST' });
    const data = await res.json();
    updateSimUI(data.isSimulating);
  } catch (e) {
    console.error(e);
  }
});

// Save configuration
btnSaveConfig.addEventListener('click', async () => {
  const config = {
    ttsVoice: ttsVoiceSelect.value,
    ttsEnabled: ttsEnabledCheck.checked,
    bgmTrack: bgmTrackSelect ? bgmTrackSelect.value : 'gentle_flute',
    bgmVolume: parseFloat(bgmVolumeInput.value || 0.25),
    moInterval: parseFloat(moIntervalInput.value || 3.2) * 1000
  };
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (res.ok) {
      addLog('sys', 'Cấu hình âm thanh và nhạc thiền đã được lưu.');
      alert('Đã cập nhật cài đặt âm thanh, nhạc thiền và giọng đọc!');
    }
  } catch (e) {
    alert('Lỗi cập nhật cấu hình: ' + e.message);
  }
});

// Test Voice TTS
btnTestVoice.addEventListener('click', async () => {
  btnTestVoice.disabled = true;
  btnTestVoice.innerText = 'Đang đọc...';
  try {
    const text = 'Thành tâm cảm tạ Phật tử đã cúng dường Tam Bảo. Cầu chúc bạn thân tâm thường an lạc, vạn sự hanh thông!';
    const voice = ttsVoiceSelect.value;
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${voice}`);
    const json = await res.json();
    if (json.audioUrl) {
      const audio = new Audio(json.audioUrl);
      audio.play();
      audio.onended = () => {
        btnTestVoice.disabled = false;
        btnTestVoice.innerText = '🔊 Thử Giọng Đọc';
      };
    } else {
      btnTestVoice.disabled = false;
      btnTestVoice.innerText = '🔊 Thử Giọng Đọc';
    }
  } catch (err) {
    btnTestVoice.disabled = false;
    btnTestVoice.innerText = '🔊 Thử Giọng Đọc';
    alert('Lỗi phát âm: ' + err.message);
  }
});

// ==================== SIMULATOR HANDLERS ====================

document.getElementById('sim-1xu').addEventListener('click', async () => {
  const name = ['Bảo Ngọc', 'Hoàng Tuấn', 'Thanh Mai', 'Minh Khang'][Math.floor(Math.random() * 4)];
  await fetch('/api/test/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: name,
      coins: 1,
      giftName: 'Nén Hương Trầm'
    })
  });
});

document.getElementById('sim-5xu').addEventListener('click', async () => {
  await fetch('/api/test/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: 'Dương Tử Linh',
      coins: 5,
      giftName: 'Hoa Sen Vàng'
    })
  });
});

document.getElementById('sim-10xu').addEventListener('click', async () => {
  await fetch('/api/test/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: 'RICHARD NGUYỄN',
      coins: 10,
      giftName: 'Vương Miện Vàng'
    })
  });
});

document.getElementById('sim-50tim').addEventListener('click', async () => {
  await fetch('/api/test/flower', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: 'Bảo Hân' })
  });
});

document.getElementById('sim-all-bow').addEventListener('click', async () => {
  await fetch('/api/test/bow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration: 3200 })
  });
});

document.getElementById('sim-join').addEventListener('click', async () => {
  await fetch('/api/test/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
});

const simFullBtn = document.getElementById('sim-full-seats');
if (simFullBtn) {
  simFullBtn.addEventListener('click', async () => {
    addLog('sys', '🌟 Kích hoạt: Lấp đầy toàn bộ 50/50 bồ đoàn & mở Đại Lễ Tạ Tam Bảo!');
    socket.emit('fill_all_seats');
    try {
      await fetch('/api/test/fill-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
    } catch (e) {}
  });
}

const sim51stBtn = document.getElementById('sim-51st-devotee');
if (sim51stBtn) {
  sim51stBtn.addEventListener('click', async () => {
    addLog('sys', '🚶‍♂️ Giả lập Người Thứ 51 vào chùa: Kích hoạt nhường bồ đoàn & nhảy số lượt viếng!');
    await fetch('/api/test/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: 'Phật Tử Diệu Hạnh'
      })
    });
  });
}

document.getElementById('sim-chat').addEventListener('click', async () => {
  await fetch('/api/test/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
});

document.getElementById('btn-custom-gift').addEventListener('click', async () => {
  const name = document.getElementById('custom-name').value.trim() || 'Phật tử ẩn danh';
  const gift = document.getElementById('custom-gift-name').value.trim() || 'Lễ Vật Cúng Dường';
  const coins = parseInt(document.getElementById('custom-coins').value || 10, 10);

  await fetch('/api/test/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: name,
      giftName: gift,
      coins: coins
    })
  });
});

document.getElementById('btn-reset-lb').addEventListener('click', async () => {
  if (confirm('Bạn có chắc chắn muốn làm mới bảng xếp hạng?')) {
    await fetch('/api/leaderboard/reset', { method: 'POST' });
    addLog('sys', 'Đã làm mới bảng xếp hạng Tấm Lòng Thành.');
  }
});

// Anti-Ban & Anti-Static toggles
let cardsVisible = true;
let haloEnabled = true;
let petalsEnabled = true;

const btnToggleCards = document.getElementById('btn-toggle-cards');
if (btnToggleCards) {
  btnToggleCards.addEventListener('click', () => {
    cardsVisible = !cardsVisible;
    socket.emit('toggle_donation_cards', { visible: cardsVisible });
    btnToggleCards.innerText = cardsVisible 
      ? '👁️ Ẩn Bảng Dâng Lễ Dưới Cùng' 
      : '👁️ Hiện Bảng Dâng Lễ Dưới Cùng';
    addLog('sys', cardsVisible ? 'Đã hiển thị bảng dâng lễ dưới cùng.' : 'Đã ẩn bảng dâng lễ (chế độ an toàn né bot OCR).');
  });
}

const btnToggleHalo = document.getElementById('btn-toggle-halo');
if (btnToggleHalo) {
  btnToggleHalo.addEventListener('click', () => {
    haloEnabled = !haloEnabled;
    socket.emit('toggle_halo_fx', { enabled: haloEnabled });
    btnToggleHalo.innerText = haloEnabled 
      ? '✨ Tắt Hào Quang Phật Xoay' 
      : '✨ Bật Hào Quang Phật Xoay';
    addLog('sys', haloEnabled ? 'Đã bật hào quang Phật xoay động.' : 'Đã tắt hào quang Phật xoay.');
  });
}

const btnTogglePetals = document.getElementById('btn-toggle-petals');
if (btnTogglePetals) {
  btnTogglePetals.addEventListener('click', () => {
    petalsEnabled = !petalsEnabled;
    socket.emit('toggle_petals_fx', { enabled: petalsEnabled });
    btnTogglePetals.innerText = petalsEnabled 
      ? '🌸 Tắt Cánh Sen Rơi' 
      : '🌸 Bật Cánh Sen Rơi';
    addLog('sys', petalsEnabled ? 'Đã bật cánh sen rơi tự nhiên.' : 'Đã tắt cánh sen rơi.');
  });
}
