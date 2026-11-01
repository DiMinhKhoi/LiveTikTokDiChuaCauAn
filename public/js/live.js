/**
 * Main Live Presentation Engine for Buddhist Temple TikTok Live
 * Features:
 * - 1080x1920 Native Resolution Architecture for TikTok Live Studio & OBS Studio
 * - Proportional scaling with automatic window fitting
 * - Seating grid positioned naturally on the dark wood floor in front of the altar
 * - High Golden Buddha layout with VIP mats and altar ceremony
 */

class TempleLiveApp {
  constructor() {
    this.stage = document.getElementById('temple-stage');
    this.canvas = document.getElementById('fx-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.seats = [];
    this.userToSeat = new Map();
    this.emptySeats = [];

    this.particles = [];
    this.petals = [];
    this.dustParticles = [];
    this.haloAngle = 0;
    this.haloEnabled = true;
    this.naturalPetalsEnabled = true;

    this.moInterval = 3200;
    this.moTimer = null;

    this.socket = null;
    this.isCeremonyActive = false;
    this.ceremonyQueue = [];
    this.hasTriggeredFullBlessing = false;
    this.totalVisitorsCount = 16;

    this.initViewportScale();
    this.initCanvas();
    this.initSeatingGrid();
    this.initSocket();
    this.initMoRhythm();
    this.initQuickAltarActions();
    this.startParticleLoop();
    this.setupAudioTrigger();
  }

  // Auto-scale 1080x1920 canvas to fit any window size
  initViewportScale() {
    const updateScale = () => {
      const scale = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
      document.documentElement.style.setProperty('--ui-scale', scale);
    };
    window.addEventListener('resize', updateScale);
    updateScale();
  }

  setupAudioTrigger() {
    const audioPill = document.getElementById('audio-pill');

    // Default to zen_guzheng (Đàn tranh thiền) and start immediately
    window.templeAudio.switchTrack('zen_guzheng');
    window.templeAudio.init();
    window.templeAudio.playBGM();

    if (audioPill) {
      audioPill.addEventListener('click', () => {
        window.templeAudio.init();
        window.templeAudio.soundEnabled = !window.templeAudio.soundEnabled;
        window.templeAudio.bgmEnabled = window.templeAudio.soundEnabled;
        if (window.templeAudio.soundEnabled) {
          window.templeAudio.switchTrack('zen_guzheng');
          window.templeAudio.playBGM();
          audioPill.innerHTML = '🎵 Nhạc Đàn Tranh Thiền: Bật';
        } else {
          window.templeAudio.pauseBGM();
          audioPill.innerHTML = '🔕 Âm thanh: Tắt';
        }
      });
    }

    // Unlock autoplay seamlessly across any browser or OBS source interaction
    const unlockAudioOnce = () => {
      window.templeAudio.init();
      window.templeAudio.switchTrack('zen_guzheng');
      window.templeAudio.playBGM();
      if (audioPill && window.templeAudio.soundEnabled) {
        audioPill.innerHTML = '🎵 Nhạc Đàn Tranh Thiền: Bật';
      }
    };
    ['click', 'pointerdown', 'touchstart', 'keydown'].forEach(evt => {
      document.addEventListener(evt, unlockAudioOnce, { once: true });
    });
  }

  initQuickAltarActions() {
    const btnBell = document.getElementById('btn-quick-bell');
    const btnMo = document.getElementById('btn-quick-mo');
    const btnFortune = document.getElementById('btn-quick-fortune');

    if (btnBell) {
      btnBell.addEventListener('click', () => {
        window.templeAudio.playBell();
        this.spawnGoldAura();
      });
    }
    if (btnMo) {
      btnMo.addEventListener('click', () => {
        window.templeAudio.playMo();
        this.bowOccupiedDevotees();
      });
    }
    if (btnFortune) {
      btnFortune.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/fortune/random');
          const fort = await res.json();
          this.showFortuneModal(fort);
        } catch (e) {}
      });
    }
  }

  // Setup the 50-seat grid on the grand temple wooden floor (y: 70.8% to 91.5%)
  initSeatingGrid() {
    this.stage.innerHTML = '';
    this.seats = [];
    this.emptySeats = [];
    this.userToSeat.clear();

    let seatIndex = 0;

    // 1. VIP Altar Row (6 red cushions right before the altar table, y = 70.8%)
    const vipCols = 6;
    for (let i = 0; i < vipCols; i++) {
      const x = 18 + (i / (vipCols - 1)) * 64; // from 18% to 82%
      const y = 70.8;
      const scale = 0.68;
      this.createSeatElement(seatIndex, x, y, scale, true);
      seatIndex++;
    }

    // 2. Floor Aisles (Left and Right of the central red carpet)
    // 6 rows from y = 74.2% down to y = 91.5%
    // Rows 0 and 1: 3 columns each side (3 + 3 = 6 per row -> 12 seats)
    // Rows 2, 3, 4, 5: 4 columns each side (4 + 4 = 8 per row -> 32 seats)
    // Total = 6 VIP + 12 + 32 = 50 SEATS!
    const rowConfigs = [
      { y: 74.2, scale: 0.72, cols: 3 },
      { y: 77.4, scale: 0.76, cols: 3 },
      { y: 80.8, scale: 0.81, cols: 4 },
      { y: 84.2, scale: 0.86, cols: 4 },
      { y: 87.8, scale: 0.92, cols: 4 },
      { y: 91.5, scale: 0.98, cols: 4 }
    ];

    for (let r = 0; r < rowConfigs.length; r++) {
      const cfg = rowConfigs[r];
      const progress = r / (rowConfigs.length - 1);
      const carpetLeft = 41 - progress * 4;   // carpet boundary left
      const leftEdge = 8 - progress * 1;      // floor boundary left
      const carpetRight = 59 + progress * 4;  // carpet boundary right
      const rightEdge = 92 + progress * 1;    // floor boundary right

      // Left aisle
      for (let c = 0; c < cfg.cols; c++) {
        const colP = cfg.cols > 1 ? c / (cfg.cols - 1) : 0.5;
        const x = leftEdge + colP * (carpetLeft - leftEdge);
        this.createSeatElement(seatIndex, x, cfg.y, cfg.scale, false);
        seatIndex++;
      }

      // Right aisle
      for (let c = 0; c < cfg.cols; c++) {
        const colP = cfg.cols > 1 ? c / (cfg.cols - 1) : 0.5;
        const x = carpetRight + colP * (rightEdge - carpetRight);
        this.createSeatElement(seatIndex, x, cfg.y, cfg.scale, false);
        seatIndex++;
      }
    }

    this.emptySeats = [...this.seats].sort((a, b) => a.y - b.y);

    // Initial 16 sample devotees
    this.seedInitialSampleDevotees();
  }

  createSeatElement(id, xPercent, yPercent, scale, isVip = false) {
    const seatEl = document.createElement('div');
    seatEl.className = `devotee-seat empty ${isVip ? 'vip-seat' : ''}`;
    seatEl.dataset.id = id;
    seatEl.style.left = `${xPercent}%`;
    seatEl.style.top = `${yPercent}%`;
    seatEl.style.zIndex = Math.floor(yPercent * 100);

    seatEl.innerHTML = `
      <div class="seat-mat" style="transform: scale(${scale});"></div>
      <div class="devotee-badge">
        <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face" class="devotee-avatar" alt="avt" />
        <span class="devotee-name">Phật tử</span>
      </div>
      <div class="devotee-sprite-wrap" style="transform: scale(${scale});">
        <img src="assets/devotee_kneeling.png" class="devotee-img kneeling" alt="kneeling" />
        <img src="assets/devotee_bowing.png" class="devotee-img bowing" alt="bowing" />
      </div>
      <div class="bubble-container"></div>
    `;

    this.stage.appendChild(seatEl);

    const seatData = {
      id,
      x: xPercent,
      y: yPercent,
      scale,
      isVip,
      element: seatEl,
      isOccupied: false,
      user: null,
      seatedTime: Date.now(),
      donationScore: 0
    };

    this.seats.push(seatData);
  }

  seedInitialSampleDevotees() {
    const samples = [
      { name: 'Tiến Trương', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face' },
      { name: 'Anh Thơ 1227', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face' },
      { name: 'Nguyễn Đăng', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' },
      { name: 'Lượng Nhi', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face' },
      { name: 'Diệu Tâm', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face' },
      { name: 'Quang Huỳnh', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face' },
      { name: 'Bảo Hân', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face' },
      { name: 'Minh Triết', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=face' },
      { name: 'Phúc Hưng', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face' },
      { name: 'Diệu Hương', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face' },
      { name: 'Hoàng Nam', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' },
      { name: 'Tuấn Kiệt', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop&crop=face' },
      { name: 'Thảo Nguyên', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face' },
      { name: 'Thanh Phong', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&h=100&fit=crop&crop=face' },
      { name: 'Khánh Vy', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop&crop=face' },
      { name: 'Đức Thịnh', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=face' }
    ];

    samples.forEach(s => {
      this.assignUserDirectlyToSeat(s.name, s.avatar, `sample_${s.name}`);
    });
    this.updateSanghaCounter();
  }

  fillAllRemainingSeats() {
    const extraNames = [
      'Bảo Trân', 'Gia Huy', 'Thanh Trúc', 'Nhật Minh', 'Hồng Phúc',
      'Minh Châu', 'Quốc Bảo', 'Ngọc Ánh', 'Hữu Phước', 'Thái Dương',
      'Mỹ Duyên', 'Văn Hùng', 'Thu Hằng', 'Trọng Hiếu', 'Diệu Linh',
      'Đăng Khôi', 'Lan Anh', 'Hải Đăng', 'Phương Nga', 'Hoàng Bách',
      'Thục Quyên', 'Việt Anh', 'Kim Ngân', 'Đức Anh', 'Quỳnh Chi',
      'Tuấn Anh', 'Thanh Hà', 'Vĩnh Khang', 'Như Ý', 'Minh Quân',
      'Mai Anh', 'Tấn Phát', 'Khánh Linh', 'Bảo Long', 'Hồng Nhung'
    ];

    let nameIdx = 0;
    while (this.emptySeats.length > 0) {
      const name = extraNames[nameIdx % extraNames.length];
      const avt = `https://images.unsplash.com/photo-${1535713875000 + (nameIdx * 19) % 400}?w=100&h=100&fit=crop&crop=face`;
      this.assignUserDirectlyToSeat(name, avt, `full_${name}_${Date.now()}_${nameIdx}`);
      nameIdx++;
    }

    this.hasTriggeredFullBlessing = false;
    this.totalVisitorsCount = 50;
    this.updateSanghaCounter();
    this.celebrateFullTempleCeremony();
  }

  assignUserDirectlyToSeat(nickname, avatar, uniqueId) {
    if (this.emptySeats.length === 0) return null;
    const seat = this.emptySeats.shift();
    seat.isOccupied = true;
    seat.user = { nickname, avatar, uniqueId };
    seat.seatedTime = Date.now();
    seat.donationScore = 0;
    this.userToSeat.set(uniqueId || nickname, seat);
    this.userToSeat.set(nickname, seat);

    seat.element.classList.remove('empty', 'departing');
    const badge = seat.element.querySelector('.devotee-badge');
    if (badge) {
      badge.querySelector('.devotee-avatar').src = avatar;
      badge.querySelector('.devotee-name').innerText = nickname;
    }
    this.updateSanghaCounter();
    return seat;
  }

  updateSanghaCounter() {
    const occupiedCount = this.seats.filter(s => s.isOccupied).length;
    const totalCount = this.seats.length;
    const sanghaPill = document.getElementById('sangha-pill');

    if (sanghaPill) {
      if (occupiedCount >= totalCount) {
        sanghaPill.classList.add('full');
        sanghaPill.innerHTML = `🏛️ Đạo Tràng: ${totalCount}/${totalCount} Kín Chỗ • Tổng Lễ: ${this.totalVisitorsCount} Lượt`;
      } else {
        sanghaPill.classList.remove('full');
        sanghaPill.innerHTML = `🌸 Đạo Tràng: ${occupiedCount}/${totalCount} Bồ Đoàn • Tổng Lễ: ${this.totalVisitorsCount} Lượt`;
      }
    }

    if (occupiedCount >= totalCount && !this.hasTriggeredFullBlessing) {
      this.hasTriggeredFullBlessing = true;
      this.celebrateFullTempleCeremony();
      setTimeout(() => {
        this.hasTriggeredFullBlessing = false;
      }, 45000);
    }
  }

  celebrateFullTempleCeremony() {
    // 1. Triple Bell
    window.templeAudio.playBell();
    setTimeout(() => window.templeAudio.playBell(), 1600);
    setTimeout(() => window.templeAudio.playBell(), 3200);

    // 2. Massive Golden Aura & Flower Rain
    this.spawnGoldAura();
    this.spawnFlowerRain(70);

    // 3. All devotees synchronously prostrate
    this.triggerAllBow(4200);

    // 4. Grand Top Announcement
    this.updateTopBanner('🌸 ĐẠI LỄ TẠ TAM BẢO: Đạo tràng 50 Phật tử trang nghiêm viên mãn! Nguyện mười phương chư Phật gia hộ đại chúng vạn sự an khang, phúc thọ tăng long!');

    // 5. Spoken Blessing
    const speech = 'Nam Mô Bổn Sư Thích Ca Mâu Ni Phật. Đạo tràng 50 vị Phật tử đã trang nghiêm thanh tịnh viên mãn. Kính chúc toàn thể quý Phật tử thân tâm thường an lạc, gia đạo bình an, phúc thọ tăng long!';
    window.templeAudio.queueSpeech(speech, null);
  }

  walkInFromCenterToSeat(nickname, avatar, uniqueId, onArrived) {
    this.totalVisitorsCount++;
    let seat;

    if (this.emptySeats.length > 0) {
      seat = this.emptySeats.shift();
      seat.isOccupied = true;
      seat.user = { nickname, avatar, uniqueId };
      seat.seatedTime = Date.now();
      seat.donationScore = 0;
      this.userToSeat.set(uniqueId || nickname, seat);
      this.userToSeat.set(nickname, seat);
    } else {
      // FULL SEATS (50/50 occupied):
      // Graceful Merit & Time Rotation for 51st, 52nd... newcomer
      const nonVipCandidates = this.seats.filter(s => !s.isVip);
      const pool = nonVipCandidates.length > 0 ? nonVipCandidates : this.seats;

      pool.sort((a, b) => {
        if ((a.donationScore || 0) !== (b.donationScore || 0)) {
          return (a.donationScore || 0) - (b.donationScore || 0);
        }
        return (a.seatedTime || 0) - (b.seatedTime || 0);
      });

      seat = pool[0];
      const oldUser = seat.user;

      if (oldUser) {
        // 1. Depart animation: Old devotee bows and ascends in golden light
        this.showGiftBadge(seat, `🙏 Công đức viên mãn • Hoan hỷ nhường bồ đoàn`);
        seat.element.classList.add('departing');
        this.seatBow(seat.element, 1400);

        // 2. Banner announcement for room
        this.updateTopBanner(`🌸 ĐẠO TRÀNG HOAN HỶ: Phật tử ${oldUser.nickname} tu tập viên mãn, hoan hỷ nhường bồ đoàn cho Phật tử ${nickname} bước lên thảm đỏ an vị cầu an!`);

        // 3. Audio chime & blessing
        window.templeAudio.playChime();
        const speech = `Chào đón Phật tử ${nickname} đã về chùa cầu an, an vị bồ đoàn trang nghiêm. Phật tử ${oldUser.nickname} hoan hỷ nhường chỗ công đức vô lượng. Nam Mô A Di Đà Phật!`;
        window.templeAudio.queueSpeech(speech, null);

        this.userToSeat.delete(oldUser.uniqueId);
        this.userToSeat.delete(oldUser.nickname);

        // After 1400ms, old devotee departs, mat is briefly open for newcomer
        setTimeout(() => {
          seat.element.classList.remove('departing');
          seat.element.classList.add('empty');
        }, 1400);
      }

      seat.user = { nickname, avatar, uniqueId };
      seat.seatedTime = Date.now();
      seat.donationScore = 0;
      this.userToSeat.set(uniqueId || nickname, seat);
      this.userToSeat.set(nickname, seat);
    }

    const traveler = document.createElement('div');
    traveler.className = 'traveling-devotee';
    traveler.style.left = '50%';
    traveler.style.top = '98%';
    traveler.style.transform = 'translate(-50%, -100%) scale(1.03)';

    traveler.innerHTML = `
      <div class="devotee-badge">
        <img src="${avatar}" class="devotee-avatar" alt="avt" />
        <span class="devotee-name">${nickname}</span>
      </div>
      <div class="devotee-sprite-wrap">
        <img src="assets/devotee_kneeling.png" class="devotee-img" alt="traveler" style="width: 95px;" />
      </div>
    `;

    this.stage.appendChild(traveler);

    // 1. Walk straight forward along center red carpet
    setTimeout(() => {
      traveler.style.transition = 'top 1.6s cubic-bezier(0.2, 0.8, 0.4, 1), transform 1.6s ease';
      traveler.style.top = `${seat.y}%`;
      traveler.style.transform = `translate(-50%, -100%) scale(${seat.scale})`;
    }, 40);

    // 2. Turn to their assigned seat
    setTimeout(() => {
      traveler.style.transition = 'left 1.3s cubic-bezier(0.2, 0.8, 0.4, 1)';
      traveler.style.left = `${seat.x}%`;
    }, 1700);

    // 3. Kneel down on the mat
    setTimeout(() => {
      traveler.remove();
      seat.element.classList.remove('empty', 'departing');
      const badge = seat.element.querySelector('.devotee-badge');
      if (badge) {
        badge.querySelector('.devotee-avatar').src = avatar;
        badge.querySelector('.devotee-name').innerText = nickname;
      }
      this.showGiftBadge(seat, `🌸 Cầu an cho ${nickname}`);
      this.seatBow(seat.element, 2000);
      this.updateSanghaCounter();
      if (onArrived) onArrived(seat);
    }, 3050);
  }

  getOrSpawnDevotee(nickname, avatar, uniqueId, callback) {
    const key = uniqueId || nickname;
    if (this.userToSeat.has(key)) {
      callback(this.userToSeat.get(key));
    } else {
      this.walkInFromCenterToSeat(nickname, avatar, uniqueId, callback);
    }
  }

  initMoRhythm() {
    this.moTimer = setInterval(() => {
      window.templeAudio.playMo();
      if (!this.isCeremonyActive) {
        this.bowOccupiedDevotees();
      }
    }, this.moInterval);
  }

  bowOccupiedDevotees() {
    const occupied = this.seats.filter(s => s.isOccupied);
    if (occupied.length === 0) return;

    const count = Math.max(1, Math.floor(occupied.length * 0.4));
    const shuffled = [...occupied].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    selected.forEach(seat => {
      this.seatBow(seat.element, 2200);
    });
  }

  seatBow(element, duration = 2200) {
    if (!element) return;
    element.classList.add('bowing');
    setTimeout(() => {
      element.classList.remove('bowing');
    }, duration);
  }

  triggerAllBow(duration = 3200) {
    window.templeAudio.playBell();
    this.spawnGoldAura();
    const occupied = this.seats.filter(s => s.isOccupied);
    occupied.forEach(seat => {
      this.seatBow(seat.element, duration);
    });
  }

  showChatBubble(nickname, comment, avatar, uniqueId) {
    if (!comment || comment === 'undefined' || typeof comment !== 'string' || comment.trim() === '') return;

    this.getOrSpawnDevotee(nickname, avatar, uniqueId, seat => {
      if (!seat) return;
      this.seatBow(seat.element, 1800);

      const container = seat.element.querySelector('.bubble-container');
      if (!container) return;

      container.innerHTML = '';
      const bubble = document.createElement('div');
      bubble.className = 'speech-bubble';
      bubble.innerText = comment.trim();
      container.appendChild(bubble);

      setTimeout(() => {
        if (bubble.parentNode) bubble.remove();
      }, 5500);
    });
  }

  showGiftBadge(seat, text) {
    const container = seat.element.querySelector('.bubble-container');
    if (!container) return;

    const giftBadge = document.createElement('div');
    giftBadge.className = 'gift-bubble';
    giftBadge.innerText = text;
    container.appendChild(giftBadge);

    setTimeout(() => {
      if (giftBadge.parentNode) giftBadge.remove();
    }, 2200);
  }

  performCeremony(data) {
    this.ceremonyQueue.push(data);
    this.processCeremonyQueue();
  }

  processCeremonyQueue() {
    if (this.isCeremonyActive || this.ceremonyQueue.length === 0) return;
    this.isCeremonyActive = true;

    const data = this.ceremonyQueue.shift();
    const { nickname, avatar, uniqueId, giftName, coins, bannerText, spokenText, audioUrl, fortune } = data;

    this.updateTopBanner(bannerText || `${nickname} thành tâm dâng ${giftName}, lên bục quỳ trước Tam Bảo.`);
    this.updateRecentDonor(nickname, coins);

    window.templeAudio.playChime();
    window.templeAudio.queueSpeech(spokenText, audioUrl);

    this.getOrSpawnDevotee(nickname, avatar, uniqueId, seat => {
      if (seat) {
        seat.donationScore = (seat.donationScore || 0) + (coins || 1);
      }
    });

    // Create ceremony walker on red carpet
    const walker = document.createElement('div');
    walker.className = 'walking-ceremony-devotee';
    walker.style.bottom = '4%';
    walker.style.transform = 'translate(-50%, 0) scale(1.05)';

    walker.innerHTML = `
      <div class="devotee-badge">
        <img src="${avatar}" class="devotee-avatar" alt="avt" />
        <span class="devotee-name">${nickname}</span>
      </div>
      <div class="devotee-sprite-wrap">
        <img src="assets/devotee_kneeling.png" class="devotee-img kneeling" alt="walking" style="width: 110px;" />
        <img src="assets/devotee_bowing.png" class="devotee-img bowing" alt="bowing" style="width: 110px;" />
      </div>
      <div class="gift-bubble" style="bottom: 120%;">🎁 ${giftName || (coins + ' xu')}</div>
    `;

    this.stage.appendChild(walker);

    // 1. Walk up to the altar steps (y: 30% from bottom = 70% from top)
    setTimeout(() => {
      walker.style.transition = 'all 3.2s cubic-bezier(0.2, 0.8, 0.4, 1)';
      walker.style.bottom = '30%';
      walker.style.transform = 'translate(-50%, 0) scale(0.85)';
    }, 50);

    // 2. Arrive at altar, ring bell, and prostrate 3 times before high Buddha
    setTimeout(() => {
      window.templeAudio.playBell();
      this.spawnGoldAura();

      walker.classList.add('bowing');
      setTimeout(() => walker.classList.remove('bowing'), 1200);

      setTimeout(() => {
        walker.classList.add('bowing');
        setTimeout(() => walker.classList.remove('bowing'), 1200);
      }, 1600);

      setTimeout(() => {
        walker.classList.add('bowing');
        setTimeout(() => walker.classList.remove('bowing'), 1200);
      }, 3100);

      this.spawnFlowerRain(45);

      if (fortune && coins >= 10) {
        setTimeout(() => {
          this.showFortuneModal(fortune);
        }, 1800);
      }

    }, 3300);

    // 3. Finish ceremony
    setTimeout(() => {
      walker.style.transition = 'opacity 1s ease';
      walker.style.opacity = '0';
      setTimeout(() => {
        walker.remove();
        this.isCeremonyActive = false;
        this.processCeremonyQueue();
      }, 1000);
    }, 9200);
  }

  updateTopBanner(text) {
    const bannerEl = document.getElementById('royal-banner-text');
    if (bannerEl) bannerEl.innerHTML = text;
  }

  updateSharePill(text) {
    const pill = document.querySelector('.share-pill');
    if (pill) pill.innerHTML = text;
  }

  updateRecentDonor(nickname, coins) {
    const nameEl = document.getElementById('recent-donor-name');
    const scoreEl = document.getElementById('recent-donor-score');
    if (nameEl) nameEl.innerText = nickname;
    if (scoreEl) scoreEl.innerText = `Công đức: ${coins || 1} CĐ`;
  }

  updateCompactLeaderboard(list) {
    const container = document.getElementById('clb-list-container');
    if (!container) return;

    container.innerHTML = '';
    const top4 = list.slice(0, 4);

    top4.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'clb-item';
      row.innerHTML = `
        <span class="clb-name">${index + 1}. ${item.nickname}</span>
        <span class="clb-val">${item.score}</span>
      `;
      container.appendChild(row);
    });
  }

  showFortuneModal(fortune) {
    window.templeAudio.playFortuneShake();
    const overlay = document.getElementById('fortune-overlay');
    if (!overlay) return;

    document.getElementById('fortune-title').innerText = fortune.title;
    document.getElementById('fortune-theme').innerText = fortune.theme;
    document.getElementById('fortune-poem').innerText = fortune.poem;
    document.getElementById('fortune-meaning').innerText = fortune.meaning;
    document.getElementById('fortune-blessing').innerText = fortune.blessing;

    overlay.classList.add('active');

    setTimeout(() => {
      overlay.classList.remove('active');
    }, 7000);
  }

  // ==================== PARTICLE & ATMOSPHERE ENGINE ====================

  initCanvas() {
    this.canvas.width = 1080;
    this.canvas.height = 1920;
  }

  spawnGoldAura() {
    const cx = 540;
    const cy = 680; // High Buddha position

    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 6.0;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3 + Math.random() * 6,
        color: '#ffd700',
        alpha: 1.0,
        decay: 0.015 + Math.random() * 0.02
      });
    }
  }

  spawnFlowerRain(count = 35) {
    for (let i = 0; i < count; i++) {
      this.petals.push({
        x: Math.random() * 1080,
        y: -30 - Math.random() * 150,
        vx: (Math.random() - 0.5) * 2.5,
        vy: 2.0 + Math.random() * 3.5,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.08,
        size: 14 + Math.random() * 16,
        color: Math.random() > 0.4 ? '#ff6b81' : '#ffd700',
        alpha: 0.95
      });
    }
  }

  startParticleLoop() {
    const render = () => {
      this.ctx.clearRect(0, 0, 1080, 1920);

      // 1. Dynamic Rotating Divine Halo Rays around Buddha (High center: 540, 680)
      if (this.haloEnabled) {
        this.haloAngle += 0.0022;
        const rayCount = 16;
        const rayRadius = 450;
        this.ctx.save();
        this.ctx.translate(540, 680);
        this.ctx.rotate(this.haloAngle);

        for (let r = 0; r < rayCount; r++) {
          const angle = (r / rayCount) * Math.PI * 2;
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.002 + r * 0.8);
          const alpha = 0.03 + pulse * 0.045;

          const grad = this.ctx.createRadialGradient(0, 0, 90, 0, 0, rayRadius);
          grad.addColorStop(0, `rgba(255, 235, 120, ${alpha * 1.6})`);
          grad.addColorStop(0.5, `rgba(255, 190, 60, ${alpha * 0.9})`);
          grad.addColorStop(1, 'rgba(255, 180, 40, 0)');

          this.ctx.fillStyle = grad;
          this.ctx.beginPath();
          this.ctx.moveTo(0, 0);
          this.ctx.arc(0, 0, rayRadius, angle - 0.11, angle + 0.11);
          this.ctx.closePath();
          this.ctx.fill();
        }
        this.ctx.restore();
      }

      // 2. Continuous Golden Dust & Firefly Sparkles (Ultra-light, zero shadowBlur)
      if (this.dustParticles.length < 40) {
        this.dustParticles.push({
          x: Math.random() * 1080,
          y: 200 + Math.random() * 1450,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.35 - Math.random() * 0.6,
          radius: 1.5 + Math.random() * 2.5,
          baseAlpha: 0.25 + Math.random() * 0.5,
          color: Math.random() > 0.35 ? '#ffd700' : '#ffeaa7',
          phase: Math.random() * Math.PI * 2
        });
      }

      for (let i = this.dustParticles.length - 1; i >= 0; i--) {
        const d = this.dustParticles[i];
        d.x += d.vx + Math.sin(d.y * 0.01 + d.phase) * 0.35;
        d.y += d.vy;
        d.phase += 0.025;
        const curAlpha = d.baseAlpha * (0.6 + 0.4 * Math.sin(d.phase));

        if (d.y < 120) {
          this.dustParticles.splice(i, 1);
          continue;
        }

        this.ctx.globalAlpha = Math.max(0, curAlpha);
        this.ctx.fillStyle = d.color;
        this.ctx.beginPath();
        this.ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // 3. Gentle Continuous Falling Lotus Petals
      if (this.naturalPetalsEnabled && Math.random() < 0.025 && this.petals.length < 8) {
        this.petals.push({
          x: Math.random() * 1080,
          y: -25,
          vx: (Math.random() - 0.5) * 1.5,
          vy: 1.4 + Math.random() * 2.0,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.04,
          size: 13 + Math.random() * 14,
          color: Math.random() > 0.4 ? '#ff758c' : '#ffd700',
          alpha: 0.88
        });
      }

      // 4. Incense smoke billowing gently from altar burner (y: 1250px)
      if (Math.random() < 0.35 && this.particles.length < 45) {
        this.particles.push({
          x: 540 + (Math.random() - 0.5) * 40,
          y: 1250,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -1.5 - Math.random() * 2.0,
          radius: 2.8 + Math.random() * 4.5,
          color: Math.random() > 0.3 ? '#ffd700' : '#ffffff',
          alpha: 0.7,
          decay: 0.007
        });
      }

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.globalAlpha = p.alpha;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }

      for (let i = this.petals.length - 1; i >= 0; i--) {
        const pt = this.petals[i];
        pt.x += pt.vx + Math.sin(pt.y * 0.015) * 1.2;
        pt.y += pt.vy;
        pt.rot += pt.vrot;

        if (pt.y > 1950) {
          this.petals.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.translate(pt.x, pt.y);
        this.ctx.rotate(pt.rot);
        this.ctx.fillStyle = pt.color;
        this.ctx.globalAlpha = pt.alpha;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, pt.size * 0.6, pt.size, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  // ==================== SOCKET.IO HANDLING ====================

  initSocket() {
    this.socket = io();

    this.socket.on('init_state', data => {
      if (data.leaderboard) {
        this.updateCompactLeaderboard(data.leaderboard);
        if (data.leaderboard.length > 0) {
          this.updateRecentDonor(data.leaderboard[0].nickname, data.leaderboard[0].score);
        }
      }
      if (data.config) {
        if (data.config.moInterval) this.moInterval = data.config.moInterval;
        if (data.config.bgmTrack) {
          window.templeAudio.switchTrack(data.config.bgmTrack);
        }
        if (data.config.bgmVolume !== undefined) {
          window.templeAudio.setBGMVolume(data.config.bgmVolume);
        }
      }
    });

    this.socket.on('leaderboard_update', list => {
      this.updateCompactLeaderboard(list);
    });

    this.socket.on('config_update', cfg => {
      if (cfg.moInterval) this.moInterval = cfg.moInterval;
      if (cfg.bgmTrack) {
        window.templeAudio.switchTrack(cfg.bgmTrack);
      }
      if (cfg.bgmVolume !== undefined) {
        window.templeAudio.setBGMVolume(cfg.bgmVolume);
      }
    });

    this.socket.on('tiktok_chat', data => {
      this.showChatBubble(data.nickname, data.comment, data.avatar, data.uniqueId);
    });

    this.socket.on('tiktok_join', data => {
      if (data.bannerText) {
        this.updateTopBanner(data.bannerText);
      }
      if (data.spokenText || data.audioUrl) {
        window.templeAudio.playChime();
        window.templeAudio.queueSpeech(data.spokenText, data.audioUrl);
      }
      this.getOrSpawnDevotee(data.nickname, data.avatar, data.uniqueId, seat => {
        if (seat) {
          this.showGiftBadge(seat, `🌸 Cầu an cho ${data.nickname}`);
          this.seatBow(seat.element, 2000);
        }
      });
    });

    this.socket.on('tiktok_gift', data => {
      this.performCeremony(data);
    });

    this.socket.on('tiktok_like', data => {
      this.getOrSpawnDevotee(data.nickname, data.avatar, data.uniqueId, seat => {
        if (seat) this.showGiftBadge(seat, `❤️ +${data.likeCount}`);
      });
    });

    this.socket.on('tiktok_follow', data => {
      this.getOrSpawnDevotee(data.nickname, data.avatar, data.uniqueId, seat => {
        if (seat) this.showGiftBadge(seat, `🔔 Đã theo dõi`);
      });
    });

    this.socket.on('tiktok_share', data => {
      this.updateSharePill(`bởi ${data.nickname} đã chia sẻ buổi lễ`);
      this.getOrSpawnDevotee(data.nickname, data.avatar, data.uniqueId, seat => {
        if (seat) this.showGiftBadge(seat, `↗️ Đã chia sẻ`);
      });
    });

    this.socket.on('offering_event', data => {
      if (data.type === 'flower_offering') {
        this.spawnFlowerRain(50);
        this.performCeremony({
          ...data,
          giftName: '50 Tim Dâng Hoa',
          coins: 0
        });
      }
    });

    this.socket.on('trigger_all_bow', data => {
      this.triggerAllBow(data.duration || 3200);
    });

    this.socket.on('fill_all_seats', () => {
      this.fillAllRemainingSeats();
    });

    this.socket.on('toggle_donation_cards', data => {
      const cardsRow = document.getElementById('donation-cards-row');
      if (cardsRow) {
        cardsRow.style.display = data.visible ? 'flex' : 'none';
      }
    });

    this.socket.on('toggle_halo_fx', data => {
      this.haloEnabled = data.enabled !== undefined ? data.enabled : !this.haloEnabled;
    });

    this.socket.on('toggle_petals_fx', data => {
      this.naturalPetalsEnabled = data.enabled !== undefined ? data.enabled : !this.naturalPetalsEnabled;
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.templeApp = new TempleLiveApp();
});
