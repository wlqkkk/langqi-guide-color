(function() {
  'use strict';

  // 状态
  const state = {
    points: [],
    categories: [],
    routes: [],
    badges: [],
    checked: new Set(),
    earnedBadges: new Set(),
    currentPointId: null,
    currentCardIndex: 0,
    totalCards: 0,
    avatar: '🐱',
    voice: {
      mode: 'click', // 'off' | 'click' | 'auto'
      volume: 1.0,
      userInteracted: false,
      speaking: false
    },
    transform: { x: 0, y: 0, scale: 1 },
    minScale: 0.5,
    maxScale: 4,
    isDragging: false,
    lastTouchDist: 0,
    startX: 0,
    startY: 0,
    containerWidth: 0,
    containerHeight: 0,
    mapWidth: 0,
    mapHeight: 0,
    currentAudio: null
  };

  // DOM 元素
  const els = {
    splash: document.getElementById('splash'),
    startBtn: document.getElementById('startBtn'),
    mapContainer: document.getElementById('mapContainer'),
    mapWrapper: document.getElementById('mapWrapper'),
    mapImage: document.getElementById('mapImage'),
    mapLoading: document.getElementById('mapLoading'),
    mapHint: document.getElementById('mapHint'),
    hotspotsLayer: document.getElementById('hotspotsLayer'),
    storySheet: document.getElementById('storySheet'),
    storyCards: document.getElementById('storyCards'),
    storyCardsTrack: document.getElementById('storyCardsTrack'),
    cardPrev: document.getElementById('cardPrev'),
    cardNext: document.getElementById('cardNext'),
    cardDots: document.getElementById('cardDots'),
    audioPlayBtn: document.getElementById('audioPlayBtn'),
    audioCurrent: document.getElementById('audioCurrent'),
    audioProgress: document.getElementById('audioProgress'),
    audioDuration: document.getElementById('audioDuration'),
    checkInBtn: document.getElementById('checkInBtn'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    progressText: document.getElementById('progressText'),
    resetBtn: document.getElementById('resetBtn'),
    voiceSettingsBtn: document.getElementById('voiceSettingsBtn'),
    voiceIcon: document.getElementById('voiceIcon'),
    voiceModal: document.getElementById('voiceModal'),
    closeVoiceModal: document.getElementById('closeVoiceModal'),
    voiceModeGroup: document.getElementById('voiceModeGroup'),
    voiceVolume: document.getElementById('voiceVolume'),
    voiceVolumeValue: document.getElementById('voiceVolumeValue'),
    voiceTestBtn: document.getElementById('voiceTestBtn'),
    resultModal: document.getElementById('resultModal'),
    closeResultModal: document.getElementById('closeResultModal'),
    resultCount: document.getElementById('resultCount'),
    resultCategories: document.getElementById('resultCategories'),
    resultPoints: document.getElementById('resultPoints'),
    badgeModal: document.getElementById('badgeModal'),
    badgeIcon: document.getElementById('badgeIcon'),
    badgeTitle: document.getElementById('badgeTitle'),
    badgeDesc: document.getElementById('badgeDesc'),
    closeBadgeModal: document.getElementById('closeBadgeModal'),
    avatarModal: document.getElementById('avatarModal'),
    avatarGrid: document.getElementById('avatarGrid'),
    confirmAvatarBtn: document.getElementById('confirmAvatarBtn'),
    certificateModal: document.getElementById('certificateModal'),
    closeCertificateModal: document.getElementById('closeCertificateModal'),
    certName: document.getElementById('certName'),
    certNameInput: document.getElementById('certNameInput'),
    certCount: document.getElementById('certCount'),
    certDate: document.getElementById('certDate'),
    certNo: document.getElementById('certNo'),
    updateCertNameBtn: document.getElementById('updateCertNameBtn'),
    downloadCertBtn: document.getElementById('downloadCertBtn'),
    toastContainer: document.getElementById('toastContainer')
  };

  // 初始化
  async function init() {
    await loadData();
    state.totalCards = state.points.reduce((sum, p) => sum + (p.cards ? p.cards.length : 0), 0);
    loadChecked();
    loadVoiceSettings();
    initAudio();
    setupEventListeners();
    setupZoomControls();
    renderHotspots();
    renderAvatarGrid();
    updateProgress();
    updateVoiceIcon();

    // 等待地图图片加载完成后再适配屏幕
    if (els.mapImage.complete && els.mapImage.naturalWidth > 0) {
      fitMapToScreen();
    } else {
      els.mapImage.addEventListener('load', fitMapToScreen, { once: true });
      els.mapImage.addEventListener('error', () => {
        console.error('平面图加载失败');
        alert('平面图加载失败，请检查图片路径');
      }, { once: true });
    }

    els.startBtn.addEventListener('click', () => {
      // 首次使用显示头像选择，否则直接进入
      const hasSeenAvatar = localStorage.getItem('langqi-avatar-seen');
      if (!hasSeenAvatar) {
        showAvatarModal();
      } else {
        enterMap();
      }
    });

    els.confirmAvatarBtn.addEventListener('click', () => {
      localStorage.setItem('langqi-avatar-seen', '1');
      hideAvatarModal();
      enterMap();
    });

    // 进入地图
    function enterMap() {
      els.splash.classList.add('hide');
      setTimeout(() => {
        updateDimensions();
        fitMapToScreen();
      }, 100);
    }

    // 调试/预览模式：URL 带 ?preview=1 时自动进入地图
    if (location.search.includes('preview=1')) {
      setTimeout(() => {
        els.splash.classList.add('hide');
        updateDimensions();
        fitMapToScreen();
        // 可选：URL 带 checked=p01,p02 时模拟已打卡
        const checkedMatch = location.search.match(/checked=([a-z0-9,]+)/);
        if (checkedMatch) {
          checkedMatch[1].split(',').forEach(id => state.checked.add(id));
          renderHotspots();
          updateProgress();
        }
        // 可选：URL 带 active=xxx 时自动选中某个点
        var match = location.search.match(/active=([a-z0-9]+)/);
        if (match) selectPoint(match[1]);
        // 可选：URL 带 certificate=1 时直接显示证书
        if (location.search.includes('certificate=1')) {
          setTimeout(showCertificate, 1500);
        }
        // 可选：URL 带 badge=xxx 时直接显示徽章弹窗
        var badgeMatch = location.search.match(/badge=([a-z0-9]+)/);
        if (badgeMatch) {
          var badge = state.badges.find(b => b.id === badgeMatch[1]);
          if (badge) setTimeout(() => showBadgeModal(badge), 1000);
        }
      }, 300);
    }
  }

  // 加载数据
  async function loadData() {
    // 优先从 localStorage 加载编辑器保存的数据
    const saved = localStorage.getItem('langqi-guide-data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        state.points = data.points || [];
        state.categories = data.categories || [];
        state.routes = data.routes || [];
        state.badges = data.badges || [];
        return;
      } catch (e) { /* fall through */ }
    }

    // 其次从 GUIDE_DATA 全局变量加载
    if (typeof GUIDE_DATA !== 'undefined') {
      state.points = GUIDE_DATA.points;
      state.categories = GUIDE_DATA.categories;
      state.routes = GUIDE_DATA.routes;
      state.badges = GUIDE_DATA.badges || [];
      return;
    }

    // 兜底：fetch JSON
    try {
      const response = await fetch('data/points.json');
      const data = await response.json();
      state.points = data.points;
      state.categories = data.categories;
      state.routes = data.routes;
      state.badges = data.badges || [];
    } catch (err) {
      console.error('加载数据失败:', err);
      alert('数据加载失败，请检查网络连接');
    }
  }

  // 读取本地打卡记录
  function loadChecked() {
    try {
      const saved = localStorage.getItem('langqi-guide-checked');
      if (saved) {
        const raw = new Set(JSON.parse(saved));
        // 兼容旧格式：旧记录按故事点存（如 p01），新格式按卡片存（如 p01-0）
        // 迁移：把旧 point id 视为该点第一张卡片已打卡
        raw.forEach(key => {
          if (key && /^p\d+$/.test(key) && !key.includes('-')) {
            raw.add(getCardCheckKey(key, 0));
          }
        });
        state.checked = raw;
      }
      const savedBadges = localStorage.getItem('langqi-guide-badges');
      if (savedBadges) {
        state.earnedBadges = new Set(JSON.parse(savedBadges));
      }
      const savedAvatar = localStorage.getItem('langqi-guide-avatar');
      if (savedAvatar) {
        state.avatar = savedAvatar;
      }
    } catch (e) {
      state.checked = new Set();
      state.earnedBadges = new Set();
    }
  }

  // 打卡辅助函数
  function getCardCheckKey(pointId, cardIndex) {
    return `${pointId}-${cardIndex}`;
  }

  function isCardChecked(pointId, cardIndex) {
    return state.checked.has(getCardCheckKey(pointId, cardIndex));
  }

  function isPointChecked(point) {
    return point.cards && point.cards.some((_, i) => isCardChecked(point.id, i));
  }

  function isPointFullyChecked(point) {
    return point.cards && point.cards.every((_, i) => isCardChecked(point.id, i));
  }

  function getCheckedCardCount() {
    return state.checked.size;
  }

  // 保存打卡记录
  function saveChecked() {
    try {
      localStorage.setItem('langqi-guide-checked', JSON.stringify([...state.checked]));
      localStorage.setItem('langqi-guide-badges', JSON.stringify([...state.earnedBadges]));
      localStorage.setItem('langqi-guide-avatar', state.avatar);
    } catch (e) {
      // ignore
    }
  }

  // 加载语音设置
  function loadVoiceSettings() {
    try {
      const saved = localStorage.getItem('langqi-guide-voice');
      if (saved) {
        const settings = JSON.parse(saved);
        state.voice.mode = settings.mode || 'click';
        state.voice.volume = typeof settings.volume === 'number' ? settings.volume : 1.0;
      }
    } catch (e) {
      // ignore
    }
  }

  // 保存语音设置
  function saveVoiceSettings() {
    try {
      localStorage.setItem('langqi-guide-voice', JSON.stringify({
        mode: state.voice.mode,
        volume: state.voice.volume
      }));
    } catch (e) {
      // ignore
    }
  }

  // 初始化音频
  function initAudio() {
    // 音频播放器用 HTML5 Audio，无需额外初始化
  }

  // 创建/获取当前故事点的音频对象
  // 播放当前故事卡片音频
  function playCurrentStoryAudio() {
    if (state.voice.mode === 'off') return;
    const card = getCurrentCard();
    if (!card) return;
    if (!card.audio) {
      showToast('当前卡片暂无音频', '');
      return;
    }

    stopAudio();

    const audio = new Audio(card.audio);
    audio.volume = state.voice.volume;
    audio.preload = 'metadata';
    state.currentAudio = audio;

    audio.addEventListener('loadedmetadata', () => {
      if (els.audioDuration) els.audioDuration.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      if (els.audioCurrent) els.audioCurrent.textContent = formatTime(audio.currentTime);
      if (els.audioProgress) els.audioProgress.value = (audio.currentTime / audio.duration) * 100 || 0;
    });

    audio.addEventListener('play', () => {
      state.voice.speaking = true;
      updateAudioPlayButton();
    });

    audio.addEventListener('ended', () => {
      state.voice.speaking = false;
      updateAudioPlayButton();
      if (els.audioCurrent) els.audioCurrent.textContent = '0:00';
      if (els.audioProgress) els.audioProgress.value = 0;
    });

    audio.addEventListener('pause', () => {
      state.voice.speaking = false;
      updateAudioPlayButton();
    });

    audio.addEventListener('error', () => {
      state.voice.speaking = false;
      updateAudioPlayButton();
      console.warn('音频加载失败:', card.title);
    });

    audio.play().catch(err => {
      state.voice.speaking = false;
      updateAudioPlayButton();
      console.warn('音频播放失败:', err);
    });
  }

  // 停止音频
  function stopAudio() {
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio.currentTime = 0;
      state.currentAudio = null;
    }
    state.voice.speaking = false;
    updateAudioPlayButton();
  }

  // 切换播放/暂停（暂停时不释放音频对象，保留进度）
  function toggleAudio() {
    if (state.voice.speaking && state.currentAudio) {
      state.currentAudio.pause();
      state.voice.speaking = false;
      updateAudioPlayButton();
    } else if (state.currentAudio) {
      state.currentAudio.play().then(() => {
        state.voice.speaking = true;
        updateAudioPlayButton();
      }).catch(err => {
        console.warn('音频播放失败:', err);
      });
    } else {
      playCurrentStoryAudio();
    }
  }

  // 切换音频播放按钮状态
  function updateAudioPlayButton() {
    if (!els.audioPlayBtn) return;
    els.audioPlayBtn.textContent = state.voice.speaking ? '⏸' : '▶';
    els.audioPlayBtn.title = state.voice.speaking ? '暂停' : '播放';
  }

  // 更新顶部语音图标
  function updateVoiceIcon() {
    if (!els.voiceIcon) return;
    if (state.voice.mode === 'off') {
      els.voiceIcon.textContent = '🔇';
    } else if (state.voice.mode === 'auto') {
      els.voiceIcon.textContent = '🔊';
    } else {
      els.voiceIcon.textContent = '🔈';
    }
  }

  // 显示语音设置弹窗
  function showVoiceModal() {
    if (!els.voiceModal) return;

    // 刷新模式按钮状态
    document.querySelectorAll('.voice-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === state.voice.mode);
    });

    // 刷新音量滑块
    if (els.voiceVolume) {
      els.voiceVolume.value = state.voice.volume;
      els.voiceVolumeValue.textContent = Math.round(state.voice.volume * 100) + '%';
    }

    els.voiceModal.classList.add('show');
  }

  // 隐藏语音设置弹窗
  function hideVoiceModal() {
    if (els.voiceModal) els.voiceModal.classList.remove('show');
  }

  // 设置播报模式
  function setVoiceMode(mode) {
    state.voice.mode = mode;
    saveVoiceSettings();
    updateVoiceIcon();

    document.querySelectorAll('.voice-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'auto' && state.currentPointId && state.voice.userInteracted) {
      playCurrentStoryAudio();
    }

    if (mode === 'off') {
      stopAudio();
    }
  }

  // 设置音量
  function setVoiceVolume(volume) {
    state.voice.volume = volume;
    if (state.currentAudio) {
      state.currentAudio.volume = volume;
    }
    saveVoiceSettings();
  }

  // 播放试听音频
  function playTestAudio() {
    stopAudio();
    const audio = new Audio('audio/p01.mp3');
    audio.volume = state.voice.volume;
    state.currentAudio = audio;

    audio.addEventListener('ended', () => {
      state.voice.speaking = false;
      updateAudioPlayButton();
      state.currentAudio = null;
    });

    audio.addEventListener('error', () => {
      state.voice.speaking = false;
      updateAudioPlayButton();
      state.currentAudio = null;
      showToast('试听音频加载失败', '');
    });

    audio.play().then(() => {
      state.voice.speaking = true;
      updateAudioPlayButton();
    }).catch(err => {
      state.voice.speaking = false;
      updateAudioPlayButton();
      console.warn('试听播放失败:', err);
    });
  }

  // 渲染热点
  function renderHotspots() {
    els.hotspotsLayer.innerHTML = '';
    state.points.forEach(point => {
      const isChecked = isPointChecked(point);
      const isActive = point.id === state.currentPointId;
      const hotspot = document.createElement('div');
      hotspot.className = 'hotspot' + (isChecked ? ' checked' : '') + (isActive ? ' active' : '') + (point.external ? ' external' : '');
      hotspot.dataset.id = point.id;
      hotspot.style.left = (point.x * 100) + '%';
      hotspot.style.top = (point.y * 100) + '%';

      const dot = document.createElement('div');
      dot.className = 'hotspot-dot';
      dot.style.backgroundColor = getCategoryColor(getPointCard(point).category);

      // 已打卡显示头像
      const avatar = document.createElement('div');
      avatar.className = 'hotspot-avatar';
      avatar.textContent = isChecked ? state.avatar : '';

      const label = document.createElement('div');
      label.className = 'hotspot-label';
      label.textContent = getPointName(point);

      hotspot.appendChild(dot);
      hotspot.appendChild(avatar);
      hotspot.appendChild(label);

      hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        state.voice.userInteracted = true;
        selectPoint(point.id);
      });

      els.hotspotsLayer.appendChild(hotspot);
    });
  }

  // 获取分类颜色
  function getCategoryColor(categoryId) {
    const cat = state.categories.find(c => c.id === categoryId);
    return cat ? cat.color : '#c9a86c';
  }

  // 获取分类名称
  function getCategoryName(categoryId) {
    const cat = state.categories.find(c => c.id === categoryId);
    return cat ? cat.name : '其他';
  }

  // 获取故事点的第一张卡片
  function getPointCard(point) {
    return point && point.cards && point.cards[0] ? point.cards[0] : null;
  }

  // 获取故事点显示名称（优先使用 point.name）
  function getPointName(point) {
    return point && point.name ? point.name : (getPointCard(point) ? getPointCard(point).title : '');
  }

  // 选择故事点
  function selectPoint(id) {
    const point = state.points.find(p => p.id === id);
    if (!point) return;

    state.currentPointId = id;
    state.currentCardIndex = 0;

    // 切换点时先停止当前播报
    stopAudio();

    // 更新热点样式
    document.querySelectorAll('.hotspot').forEach(h => h.classList.remove('active'));
    const activeHotspot = document.querySelector(`.hotspot[data-id="${id}"]`);
    if (activeHotspot) activeHotspot.classList.add('active');

    // 渲染轮播卡片
    renderStoryCards(point);

    // 更新打卡按钮
    updateCheckInButton();

    // 更新导航按钮
    updateNavButtons();

    // 打开故事卡片
    els.storySheet.classList.add('open');

    // 自动播报
    if (state.voice.mode === 'auto' && state.voice.userInteracted) {
      setTimeout(playCurrentStoryAudio, 300);
    }
  }

  // 渲染故事卡片轮播
  function renderStoryCards(point) {
    const cards = point.cards || [];
    if (!els.storyCardsTrack || !els.cardDots) return;

    els.storyCardsTrack.innerHTML = '';
    els.cardDots.innerHTML = '';

    // 只有一张卡片时隐藏翻页按钮和圆点
    const hasMultipleCards = cards.length > 1;
    if (els.cardPrev) els.cardPrev.style.display = hasMultipleCards ? '' : 'none';
    if (els.cardNext) els.cardNext.style.display = hasMultipleCards ? '' : 'none';
    els.cardDots.style.display = hasMultipleCards ? '' : 'none';

    cards.forEach((card, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'story-card';
      const catColor = getCategoryColor(card.category);
      const cardImages = (card.images && card.images.length) ? card.images : (card.image ? [card.image] : []);
      let imageHtml = '';
      if (cardImages.length > 1) {
        imageHtml = `
          <div class="story-gallery">
            <div class="gallery-track">
              ${cardImages.map((src, i) => `<div class="story-image gallery-slide${i === 0 ? ' active' : ''}"><img src="${src}" alt="${card.title}"></div>`).join('')}
            </div>
            <button class="card-nav gallery-prev" aria-label="上一张图">‹</button>
            <button class="card-nav gallery-next" aria-label="下一张图">›</button>
            <div class="gallery-dots">${cardImages.map((_, i) => `<span class="gallery-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>
          </div>`;
      } else if (cardImages.length === 1) {
        imageHtml = `<div class="story-image"><img src="${cardImages[0]}" alt="${card.title}" loading="lazy"></div>`;
      }
      cardEl.innerHTML = `
        ${imageHtml}
        <div class="story-header">
          <div class="story-title-row">
            <span class="story-category" style="background-color:${catColor}33;color:${catColor}">${getCategoryName(card.category)}</span>
          </div>
          <h2>${card.title}${hasMultipleCards ? `<span class="card-page">${index + 1}/${cards.length}</span>` : ''}</h2>
          <div class="story-area">${card.area || ''}</div>
        </div>
        <div class="story-body">
          <p style="color:var(--accent);font-weight:500">${card.summary || ''}</p>
          <p>${card.story || ''}</p>
        </div>
      `;

      // 图片轮播
      const gallery = cardEl.querySelector('.story-gallery');
      if (gallery) {
        const slides = gallery.querySelectorAll('.gallery-slide');
        const galleryDots = gallery.querySelectorAll('.gallery-dot');
        let galleryIndex = 0;
        const showImage = (i) => {
          galleryIndex = (i + cardImages.length) % cardImages.length;
          slides.forEach((s, si) => s.classList.toggle('active', si === galleryIndex));
          galleryDots.forEach((d, di) => d.classList.toggle('active', di === galleryIndex));
        };
        gallery.querySelector('.gallery-prev').addEventListener('click', (e) => { e.stopPropagation(); showImage(galleryIndex - 1); });
        gallery.querySelector('.gallery-next').addEventListener('click', (e) => { e.stopPropagation(); showImage(galleryIndex + 1); });
        galleryDots.forEach((d, di) => d.addEventListener('click', (e) => { e.stopPropagation(); showImage(di); }));
      }

      els.storyCardsTrack.appendChild(cardEl);

      const dot = document.createElement('button');
      dot.className = 'card-dot' + (index === 0 ? ' active' : '');
      dot.addEventListener('click', () => goToCard(index));
      els.cardDots.appendChild(dot);
    });

    // 重置到第一张
    state.currentCardIndex = 0;
    els.storyCardsTrack.style.transform = 'translateX(0)';
    updateCardNavButtons();
    updateAudioPlayButton();
    updateCheckInButton();
  }

  // 切换到指定卡片
  function goToCard(index) {
    if (!els.storyCardsTrack) return;
    const cardCount = els.storyCardsTrack.children.length;
    if (index < 0 || index >= cardCount) return;
    state.currentCardIndex = index;
    els.storyCardsTrack.style.transform = `translateX(-${index * 100}%)`;
    document.querySelectorAll('.card-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
    updateCardNavButtons();
    stopAudio();
    updateAudioPlayButton();
    updateCheckInButton();
  }

  // 更新卡片切换按钮状态
  function updateCardNavButtons() {
    if (!els.cardPrev || !els.cardNext) return;
    const cardCount = els.storyCardsTrack.children.length;
    els.cardPrev.disabled = state.currentCardIndex <= 0;
    els.cardNext.disabled = state.currentCardIndex >= cardCount - 1;
  }

  // 获取当前故事点的当前卡片
  function getCurrentCard() {
    const point = state.points.find(p => p.id === state.currentPointId);
    if (!point || !point.cards || !point.cards[state.currentCardIndex]) return null;
    return point.cards[state.currentCardIndex];
  }

  // 格式化时间
  function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  // 更新打卡按钮
  function updateCheckInButton() {
    const checked = isCardChecked(state.currentPointId, state.currentCardIndex);
    els.checkInBtn.classList.toggle('checked', checked);
    els.checkInBtn.querySelector('.btn-text').textContent = checked ? '已打卡' : '打卡';
    els.checkInBtn.querySelector('.btn-icon').textContent = checked ? '✓' : '📍';
  }

  // 更新导航按钮
  function updateNavButtons() {
    const index = state.points.findIndex(p => p.id === state.currentPointId);
    els.prevBtn.disabled = index <= 0;
    els.nextBtn.disabled = index >= state.points.length - 1;
  }

  // 打卡（卡片级）
  function checkIn() {
    if (!state.currentPointId) return;
    const point = state.points.find(p => p.id === state.currentPointId);
    const cardIndex = state.currentCardIndex;
    const key = getCardCheckKey(state.currentPointId, cardIndex);
    const alreadyChecked = state.checked.has(key);

    // 如果已打卡，则取消打卡
    if (alreadyChecked) {
      state.checked.delete(key);
      saveChecked();
      updateCheckInButton();
      updateProgress();
      renderHotspots();

      const activeHotspot = document.querySelector(`.hotspot[data-id="${state.currentPointId}"]`);
      if (activeHotspot) activeHotspot.classList.add('active');

      if (point) showToast(`↩️ 已取消：${getPointName(point)}`, '');
      return;
    }

    state.checked.add(key);
    saveChecked();
    updateCheckInButton();
    updateProgress();
    renderHotspots();

    // 重新标记当前选中
    const activeHotspot = document.querySelector(`.hotspot[data-id="${state.currentPointId}"]`);
    if (activeHotspot) activeHotspot.classList.add('active');

    // 首次打卡显示 Toast
    if (point) {
      showToast(`✓ 已打卡：${getPointName(point)}`, 'success');
      checkBadges();
    }

    // 如果全部卡片打卡完成，显示证书
    if (state.checked.size === state.totalCards) {
      setTimeout(showCertificate, 800);
    }
  }

  // 重置全部打卡
  function resetAllChecked() {
    if (state.checked.size === 0) {
      showToast('还没有打卡记录', '');
      return;
    }

    // 简单确认
    if (!confirm(`确定要清除全部 ${state.checked.size} 条打卡记录吗？此操作不可恢复。`)) return;

    state.checked.clear();
    state.earnedBadges.clear();
    saveChecked();
    updateProgress();
    renderHotspots();
    closeStorySheet();
    showToast('🔄 已重置全部打卡记录', 'success');
  }

  // 检查徽章
  function checkBadges() {
    const count = state.checked.size;
    const newBadges = [];

    state.badges.forEach(badge => {
      if (count >= badge.threshold && !state.earnedBadges.has(badge.id)) {
        state.earnedBadges.add(badge.id);
        newBadges.push(badge);
      }
    });

    if (newBadges.length > 0) {
      saveChecked();
      // 依次显示新徽章
      newBadges.forEach((badge, index) => {
        setTimeout(() => showBadgeModal(badge), index * 300);
      });
    }
  }

  // 显示 Toast
  function showToast(message, type = '') {
    const toast = document.createElement('div');
    toast.className = 'toast' + (type ? ' ' + type : '');
    toast.textContent = message;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2500);
  }

  // 显示徽章弹窗
  function showBadgeModal(badge) {
    els.badgeIcon.textContent = badge.icon;
    els.badgeTitle.textContent = `获得「${badge.name}」徽章`;
    els.badgeDesc.textContent = badge.desc;
    els.badgeModal.classList.add('show');
  }

  // 隐藏徽章弹窗
  function hideBadgeModal() {
    els.badgeModal.classList.remove('show');
  }

  // 渲染头像选择
  function renderAvatarGrid() {
    const avatars = ['🐱', '🐻', '🦊', '🐼', '🐶', '🐰', '🐯', '🦁'];
    els.avatarGrid.innerHTML = '';
    avatars.forEach(avatar => {
      const div = document.createElement('div');
      div.className = 'avatar-option' + (avatar === state.avatar ? ' selected' : '');
      div.textContent = avatar;
      div.addEventListener('click', () => selectAvatar(avatar));
      els.avatarGrid.appendChild(div);
    });
  }

  // 选择头像
  function selectAvatar(avatar) {
    state.avatar = avatar;
    saveChecked();
    renderAvatarGrid();
    renderHotspots();
  }

  // 显示头像选择弹窗
  function showAvatarModal() {
    renderAvatarGrid();
    els.avatarModal.classList.add('show');
  }

  // 隐藏头像选择弹窗
  function hideAvatarModal() {
    els.avatarModal.classList.remove('show');
  }

  // 显示证书
  function showCertificate() {
    const count = state.checked.size;
    const name = localStorage.getItem('langqi-cert-name') || '探索者';
    const certNo = localStorage.getItem('langqi-cert-no') || generateCertNo();
    localStorage.setItem('langqi-cert-no', certNo);
    els.certName.textContent = name;
    els.certNameInput.value = name === '探索者' ? '' : name;
    els.certCount.textContent = count;
    els.certDate.textContent = formatDate(new Date());
    els.certNo.textContent = 'NO. ' + certNo;
    els.certificateModal.classList.add('show');
  }

  // 生成证书编号
  function generateCertNo() {
    const date = new Date();
    const prefix = '' + date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 9000) + 1000);
    return prefix + '-' + random;
  }

  // 隐藏证书
  function hideCertificate() {
    els.certificateModal.classList.remove('show');
  }

  // 更新证书名字
  function updateCertName() {
    const name = els.certNameInput.value.trim() || '探索者';
    localStorage.setItem('langqi-cert-name', name);
    els.certName.textContent = name;
  }

  // 下载证书图片
  function downloadCertificate() {
    const width = 600;
    const height = 800;
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    // 背景渐变
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f8f4ec');
    gradient.addColorStop(0.5, '#ede6d6');
    gradient.addColorStop(1, '#e5dcc8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 内阴影效果
    ctx.shadowColor = 'rgba(201, 168, 108, 0.15)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillRect(0, 0, width, height);
    ctx.shadowColor = 'transparent';

    // 外边框
    ctx.strokeStyle = '#b8986a';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // 内边框
    ctx.strokeStyle = 'rgba(139, 115, 85, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 32, width - 64, height - 64);

    // 顶部装饰
    ctx.fillStyle = '#a08050';
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.fillText('❖  ❖  ❖', width / 2, 56);

    // 酒店名
    ctx.fillStyle = '#8b7355';
    ctx.font = '13px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
    ctx.fillText('深圳浪骑瞻云度假酒店', width / 2, 110);

    // 标题
    ctx.fillStyle = '#5c4033';
    ctx.font = 'bold 36px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
    ctx.fillText('故事探索认证', width / 2, 165);

    // 英文副标题
    ctx.fillStyle = '#9a8568';
    ctx.font = '12px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('CERTIFICATE OF EXPLORATION', width / 2, 195);

    // 分隔线
    const grad = ctx.createLinearGradient(width / 2 - 80, 0, width / 2 + 80, 0);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, '#b8986a');
    grad.addColorStop(1, 'transparent');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 80, 230);
    ctx.lineTo(width / 2 + 80, 230);
    ctx.stroke();

    // 图标
    ctx.font = '60px serif';
    ctx.fillText('🏅', width / 2, 310);

    // 名字
    const name = els.certName.textContent || '探索者';
    ctx.fillStyle = '#6b4423';
    ctx.font = 'bold 32px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
    ctx.fillText(name, width / 2, 380);

    // 名字下划线
    ctx.strokeStyle = 'rgba(139, 115, 85, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 100, 400);
    ctx.lineTo(width / 2 + 100, 400);
    ctx.stroke();

    // 描述
    const count = els.certCount.textContent || '30';
    ctx.fillStyle = '#5a4d3a';
    ctx.font = '16px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
    ctx.fillText(`已完成全部 ${count} 个故事点探索`, width / 2, 460);

    // 日期
    ctx.fillStyle = '#8b7355';
    ctx.font = '14px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(els.certDate.textContent || formatDate(new Date()), width / 2, 520);

    // 编号
    ctx.fillStyle = '#a09078';
    ctx.font = '12px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(els.certNo.textContent || 'NO. 0001', width / 2, 550);

    // 印章
    ctx.save();
    ctx.translate(width - 90, height - 90);
    ctx.rotate(-12 * Math.PI / 180);
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 16px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
    ctx.fillText('瞻云', 0, 6);
    ctx.restore();

    // 下载
    const link = document.createElement('a');
    link.download = '浪骑瞻云探索认证.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // 格式化日期
  function formatDate(date) {
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  }

  // 更新进度
  function updateProgress() {
    els.progressText.textContent = `${state.checked.size}/${state.totalCards}`;
  }

  // 居中到指定坐标
  function centerToPoint(x, y) {
    updateDimensions();
    const targetX = state.containerWidth / 2 - x * state.mapWidth * state.transform.scale;
    const targetY = state.containerHeight / 2 - y * state.mapHeight * state.transform.scale;
    state.transform.x = targetX;
    state.transform.y = targetY;
    applyTransform();
  }

  // 适应屏幕
  function fitMapToScreen() {
    updateDimensions();
    if (state.mapWidth === 0 || state.mapHeight === 0) {
      console.warn('平面图尺寸为 0，等待加载');
      return;
    }
    const scaleX = state.containerWidth / state.mapWidth;
    const scaleY = state.containerHeight / state.mapHeight;
    const scale = Math.min(scaleX, scaleY) * 0.95;
    state.transform.scale = Math.max(state.minScale, Math.min(scale, state.maxScale));
    state.transform.x = (state.containerWidth - state.mapWidth * state.transform.scale) / 2;
    state.transform.y = (state.containerHeight - state.mapHeight * state.transform.scale) / 2;
    // 首次适配时添加平滑动画
    if (!state.initialFitDone) {
      els.mapWrapper.style.transition = 'transform 0.5s cubic-bezier(0.32, 0.72, 0, 1)';
      state.initialFitDone = true;
      setTimeout(() => {
        els.mapWrapper.style.transition = '';
      }, 500);
    }
    applyTransform();
    if (els.mapLoading) els.mapLoading.style.display = 'none';
  }

  // 更新尺寸
  function updateDimensions() {
    state.containerWidth = els.mapContainer.clientWidth;
    state.containerHeight = els.mapContainer.clientHeight;
    state.mapWidth = els.mapImage.naturalWidth || els.mapImage.width;
    state.mapHeight = els.mapImage.naturalHeight || els.mapImage.height;
  }

  // 应用变换
  function applyTransform() {
    const { x, y, scale } = state.transform;
    els.mapWrapper.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    els.mapWrapper.style.setProperty('--map-scale', scale);
  }

  // 事件监听
  function setupEventListeners() {
    // 地图拖拽和缩放
    els.mapContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    els.mapContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    els.mapContainer.addEventListener('touchend', handleTouchEnd);
    els.mapContainer.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    els.mapContainer.addEventListener('wheel', handleWheel, { passive: false });

    // 横屏地图提示：首次滑动/点击后隐藏
    const hideMapHint = () => {
      if (els.mapHint) els.mapHint.classList.add('hide');
    };
    els.mapContainer.addEventListener('touchstart', hideMapHint, { once: true });
    els.mapContainer.addEventListener('mousedown', hideMapHint, { once: true });
    els.mapContainer.addEventListener('wheel', hideMapHint, { once: true });

    // 故事卡片按钮
    els.checkInBtn.addEventListener('click', checkIn);
    els.prevBtn.addEventListener('click', () => navigatePoint(-1));
    els.nextBtn.addEventListener('click', () => navigatePoint(1));

    // 语音播报
    if (els.audioPlayBtn) {
      els.audioPlayBtn.addEventListener('click', () => {
        state.voice.userInteracted = true;
        toggleAudio();
      });
    }

    if (els.audioProgress) {
      els.audioProgress.addEventListener('input', () => {
        if (state.currentAudio && state.currentAudio.duration) {
          state.currentAudio.currentTime = (els.audioProgress.value / 100) * state.currentAudio.duration;
        }
      });
    }

    if (els.cardPrev) {
      els.cardPrev.addEventListener('click', () => goToCard(state.currentCardIndex - 1));
    }

    if (els.cardNext) {
      els.cardNext.addEventListener('click', () => goToCard(state.currentCardIndex + 1));
    }

    if (els.voiceSettingsBtn) {
      els.voiceSettingsBtn.addEventListener('click', () => {
        state.voice.userInteracted = true;
        showVoiceModal();
      });
    }

    if (els.closeVoiceModal) {
      els.closeVoiceModal.addEventListener('click', hideVoiceModal);
    }

    if (els.voiceModeGroup) {
      els.voiceModeGroup.addEventListener('click', (e) => {
        if (e.target.classList.contains('voice-mode-btn')) {
          state.voice.userInteracted = true;
          setVoiceMode(e.target.dataset.mode);
        }
      });
    }

    if (els.voiceVolume) {
      els.voiceVolume.addEventListener('input', () => {
        const volume = parseFloat(els.voiceVolume.value);
        setVoiceVolume(volume);
        if (els.voiceVolumeValue) {
          els.voiceVolumeValue.textContent = Math.round(volume * 100) + '%';
        }
      });
    }

    if (els.voiceTestBtn) {
      els.voiceTestBtn.addEventListener('click', () => {
        state.voice.userInteracted = true;
        playTestAudio();
      });
    }

    // 记录用户首次交互，解锁自动播报
    const markInteracted = () => {
      if (!state.voice.userInteracted) {
        state.voice.userInteracted = true;
      }
    };
    document.body.addEventListener('click', markInteracted, { once: true });
    document.body.addEventListener('touchstart', markInteracted, { once: true });

    // 成果页
    els.progressText.addEventListener('click', showResult);
    els.closeResultModal.addEventListener('click', hideResultModal);

    // 重置打卡
    els.resetBtn.addEventListener('click', resetAllChecked);

    // 徽章弹窗
    els.closeBadgeModal.addEventListener('click', hideBadgeModal);

    // 证书弹窗
    els.closeCertificateModal.addEventListener('click', hideCertificate);
    els.updateCertNameBtn.addEventListener('click', updateCertName);
    els.downloadCertBtn.addEventListener('click', downloadCertificate);

    // 点击地图空白处关闭卡片
    els.mapContainer.addEventListener('click', (e) => {
      if (e.target === els.mapContainer || e.target === els.mapWrapper || e.target === els.mapImage) {
        closeStorySheet();
      }
    });

    // 故事卡片下滑关闭
    setupSheetSwipe();

    // 窗口大小变化
    window.addEventListener('resize', () => {
      updateDimensions();
      if (els.mapImage.complete && els.mapImage.naturalWidth > 0) {
        fitMapToScreen();
      }
    });
  }

  // 触摸开始
  function handleTouchStart(e) {
    if (e.touches.length === 1) {
      state.isDragging = true;
      state.startX = e.touches[0].clientX - state.transform.x;
      state.startY = e.touches[0].clientY - state.transform.y;
    } else if (e.touches.length === 2) {
      state.isDragging = false;
      state.lastTouchDist = getTouchDistance(e.touches);
    }
  }

  // 触摸移动
  function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && state.isDragging) {
      state.transform.x = e.touches[0].clientX - state.startX;
      state.transform.y = e.touches[0].clientY - state.startY;
      applyTransform();
    } else if (e.touches.length === 2) {
      const dist = getTouchDistance(e.touches);
      const scaleChange = dist / state.lastTouchDist;
      const newScale = state.transform.scale * scaleChange;
      zoomTo(newScale, getTouchCenter(e.touches));
      state.lastTouchDist = dist;
    }
  }

  // 触摸结束
  function handleTouchEnd() {
    state.isDragging = false;
  }

  // 鼠标按下
  function handleMouseDown(e) {
    state.isDragging = true;
    state.startX = e.clientX - state.transform.x;
    state.startY = e.clientY - state.transform.y;
  }

  // 鼠标移动
  function handleMouseMove(e) {
    if (!state.isDragging) return;
    state.transform.x = e.clientX - state.startX;
    state.transform.y = e.clientY - state.startY;
    applyTransform();
  }

  // 鼠标释放
  function handleMouseUp() {
    state.isDragging = false;
  }

  // 滚轮缩放
  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = state.transform.scale * delta;
    zoomTo(newScale, { x: e.clientX, y: e.clientY });
  }

  // 计算双指距离
  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 计算双指中心
  function getTouchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  // 缩放到指定级别
  function zoomTo(newScale, center) {
    newScale = Math.max(state.minScale, Math.min(newScale, state.maxScale));
    const ratio = newScale / state.transform.scale;
    const rect = els.mapContainer.getBoundingClientRect();
    const cx = center ? center.x - rect.left : state.containerWidth / 2;
    const cy = center ? center.y - rect.top : state.containerHeight / 2;

    state.transform.x = cx - (cx - state.transform.x) * ratio;
    state.transform.y = cy - (cy - state.transform.y) * ratio;
    state.transform.scale = newScale;
    applyTransform();
  }

  // 添加缩放控件
  function setupZoomControls() {
    const controls = document.createElement('div');
    controls.className = 'zoom-controls';
    controls.innerHTML = `
      <button id="zoomIn">+</button>
      <button id="zoomOut">−</button>
      <button id="fitMap">⌂</button>
    `;
    document.getElementById('app').appendChild(controls);

    controls.querySelector('#zoomIn').addEventListener('click', () => zoomTo(state.transform.scale * 1.3));
    controls.querySelector('#zoomOut').addEventListener('click', () => zoomTo(state.transform.scale / 1.3));
    controls.querySelector('#fitMap').addEventListener('click', fitMapToScreen);
  }

  // 导航到上一个/下一个
  function navigatePoint(direction) {
    let nextId;
    const currentIndex = state.points.findIndex(p => p.id === state.currentPointId);
    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < state.points.length) {
      nextId = state.points[nextIndex].id;
    }

    if (nextId) {
      state.voice.userInteracted = true;
      selectPoint(nextId);
    }
  }

  // 关闭故事卡片
  function closeStorySheet() {
    els.storySheet.classList.remove('open');
    document.querySelectorAll('.hotspot').forEach(h => h.classList.remove('active'));
    stopAudio();
  }


  // 故事卡片下滑关闭
  function setupSheetSwipe() {
    const handle = document.querySelector('.sheet-handle');
    if (!handle) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    handle.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      currentY = startY;
      isDragging = true;
      els.storySheet.style.transition = 'none';
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const delta = currentY - startY;
      if (delta > 0 && !window.matchMedia('(orientation: landscape)').matches) {
        els.storySheet.style.transform = `translateY(${delta}px)`;
      }
    }, { passive: true });

    handle.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      els.storySheet.style.transition = '';
      const delta = currentY - startY;
      if (delta > 60) {
        closeStorySheet();
      } else {
        els.storySheet.classList.add('open');
      }
      els.storySheet.style.transform = '';
    });
  }

  // 显示成果页
  function showResult() {
    els.resultCount.textContent = state.checked.size;

    // 分类统计（按已打卡卡片分类统计）
    const catCounts = {};
    state.points.forEach(p => {
      if (!p.cards) return;
      p.cards.forEach((card, i) => {
        if (isCardChecked(p.id, i)) {
          catCounts[card.category] = (catCounts[card.category] || 0) + 1;
        }
      });
    });

    els.resultCategories.innerHTML = '';
    state.categories.forEach(cat => {
      const count = catCounts[cat.id] || 0;
      if (count > 0) {
        const tag = document.createElement('span');
        tag.className = 'category-tag';
        tag.style.color = cat.color;
        tag.style.border = `1px solid ${cat.color}44`;
        tag.textContent = `${cat.name} ${count}`;
        els.resultCategories.appendChild(tag);
      }
    });

    // 故事点列表
    els.resultPoints.innerHTML = '';
    state.points.forEach(point => {
      const checked = isPointChecked(point);
      const div = document.createElement('div');
      div.className = 'result-point' + (checked ? ' checked' : '');
      div.innerHTML = `
        <span class="check-icon">${checked ? '✓' : ''}</span>
        <span>${getPointName(point)}</span>
      `;
      div.addEventListener('click', () => {
        state.voice.userInteracted = true;
        hideResultModal();
        selectPoint(point.id);
      });
      els.resultPoints.appendChild(div);
    });

    els.resultModal.classList.add('show');
  }

  // 隐藏成果页
  function hideResultModal() {
    els.resultModal.classList.remove('show');
  }

  // 注销旧的 Service Worker，避免缓存导致数据不更新
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
      }).catch((err) => {
        console.error('Service Worker 注销失败:', err);
      });
    });
  }

  // 启动
  init();
})();
