/**
 * YouTube Music Vault - Frontend Engine
 */

// Application State
const state = {
  savedSongs: [],
  filteredSongs: [],
  currentSong: null,
  currentIndex: -1,
  isPlaying: false,
  viewMode: 'grid', // 'grid' | 'list'
  loopMode: 'off',  // 'off' | 'one' | 'all'
  isShuffle: false,
  isMuted: false,
  previousVolume: 0.8,
  ytPlayer: null,
  isYtReady: false
};

// DOM Elements
const audio = document.getElementById('audioElement');
const headerUrlInput = document.getElementById('headerUrlInput');
const headerPasteBtn = document.getElementById('headerPasteBtn');
const headerConvertBtn = document.getElementById('headerConvertBtn');
const heroUrlInput = document.getElementById('heroUrlInput');
const heroPasteBtn = document.getElementById('heroPasteBtn');
const fetchBtn = document.getElementById('fetchBtn');
const convertBtn = document.getElementById('convertBtn');

// Progress & Preview
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressPercent = document.getElementById('progressPercent');
const previewCard = document.getElementById('previewCard');
const previewThumb = document.getElementById('previewThumb');
const previewDuration = document.getElementById('previewDuration');
const previewTitle = document.getElementById('previewTitle');
const previewChannel = document.getElementById('previewChannel');
const previewPlayBtn = document.getElementById('previewPlayBtn');
const previewSaveBtn = document.getElementById('previewSaveBtn');
const previewWatchBtn = document.getElementById('previewWatchBtn');
const quickSamplesList = document.getElementById('quickSamplesList');

// Library
const emptyLibrary = document.getElementById('emptyLibrary');
const songsGrid = document.getElementById('songsGrid');
const songsList = document.getElementById('songsList');
const songsTableBody = document.getElementById('songsTableBody');
const librarySearchInput = document.getElementById('librarySearchInput');
const libraryCountBadge = document.getElementById('libraryCountBadge');
const navSongCount = document.getElementById('navSongCount');
const viewGridBtn = document.getElementById('viewGridBtn');
const viewListBtn = document.getElementById('viewListBtn');

// Player Bar
const playerCover = document.getElementById('playerCover');
const playerTitle = document.getElementById('playerTitle');
const playerChannel = document.getElementById('playerChannel');
const visualizerOverlay = document.getElementById('visualizerOverlay');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const skipBack10Btn = document.getElementById('skipBack10Btn');
const skipFwd10Btn = document.getElementById('skipFwd10Btn');
const loopBtn = document.getElementById('loopBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const currentTimeEl = document.getElementById('currentTime');
const totalDurationEl = document.getElementById('totalDuration');
const seekSlider = document.getElementById('seekSlider');
const seekProgress = document.getElementById('seekProgress');
const volumeSlider = document.getElementById('volumeSlider');
const muteBtn = document.getElementById('muteBtn');
const volHighIcon = document.getElementById('volHighIcon');
const volMuteIcon = document.getElementById('volMuteIcon');
const watchVideoBtn = document.getElementById('watchVideoBtn');
const directDownloadBtn = document.getElementById('directDownloadBtn');

// Video Modal
const videoModal = document.getElementById('videoModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalVideoTitle = document.getElementById('modalVideoTitle');
const toastContainer = document.getElementById('toastContainer');

// Mobile QR Modal & Mini Controls
const mobileQrBtn = document.getElementById('mobileQrBtn');
const qrModal = document.getElementById('qrModal');
const qrModalBackdrop = document.getElementById('qrModalBackdrop');
const qrModalCloseBtn = document.getElementById('qrModalCloseBtn');
const qrImage = document.getElementById('qrImage');
const mobileLinkInput = document.getElementById('mobileLinkInput');
const copyMobileLinkBtn = document.getElementById('copyMobileLinkBtn');
const mobilePlayPauseBtn = document.getElementById('mobilePlayPauseBtn');
const mobilePlayIcon = document.getElementById('mobilePlayIcon');
const mobilePauseIcon = document.getElementById('mobilePauseIcon');
const mobileNextBtn = document.getElementById('mobileNextBtn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadSavedSongs();
  loadQuickSamples();
  loadHostInfo();
  setupAudioListeners();
});

// YouTube Iframe API Ready Hook
window.onYouTubeIframeAPIReady = function() {
  state.isYtReady = true;
};

function initEventListeners() {
  // Input sync
  headerUrlInput.addEventListener('input', () => heroUrlInput.value = headerUrlInput.value);
  heroUrlInput.addEventListener('input', () => headerUrlInput.value = heroUrlInput.value);

  // Paste buttons
  headerPasteBtn.addEventListener('click', handleClipboardPaste);
  heroPasteBtn.addEventListener('click', handleClipboardPaste);

  // Action Buttons
  fetchBtn.addEventListener('click', () => handlePreview(heroUrlInput.value));
  convertBtn.addEventListener('click', () => handleConvert(heroUrlInput.value));
  headerConvertBtn.addEventListener('click', () => handleConvert(headerUrlInput.value));

  // Enter key to convert
  heroUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleConvert(heroUrlInput.value);
  });
  headerUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleConvert(headerUrlInput.value);
  });

  // Preview Card Buttons
  previewSaveBtn.addEventListener('click', () => {
    if (state.previewInfo) handleConvert(state.previewInfo.youtube_url || heroUrlInput.value);
  });
  previewPlayBtn.addEventListener('click', () => {
    if (state.previewInfo) playSong(state.previewInfo);
  });
  previewWatchBtn.addEventListener('click', () => {
    if (state.previewInfo) openVideoModal(state.previewInfo);
  });

  // Library Controls
  librarySearchInput.addEventListener('input', handleLibrarySearch);
  viewGridBtn.addEventListener('click', () => setViewMode('grid'));
  viewListBtn.addEventListener('click', () => setViewMode('list'));

  // Player Controls
  playPauseBtn.addEventListener('click', togglePlayPause);
  prevBtn.addEventListener('click', playPrevious);
  nextBtn.addEventListener('click', playNext);
  skipBack10Btn.addEventListener('click', () => skipSeconds(-10));
  skipFwd10Btn.addEventListener('click', () => skipSeconds(10));
  loopBtn.addEventListener('click', toggleLoop);
  shuffleBtn.addEventListener('click', toggleShuffle);

  // Seekbar Controls
  seekSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (audio.duration) {
      const seekTime = (val / 100) * audio.duration;
      seekProgress.style.width = `${val}%`;
      currentTimeEl.textContent = formatTime(seekTime);
    }
  });

  seekSlider.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    if (audio.duration) {
      audio.currentTime = (val / 100) * audio.duration;
    }
  });

  // Volume Controls
  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.volume = val;
    state.isMuted = val === 0;
    updateVolumeIcon(val);
  });

  muteBtn.addEventListener('click', toggleMute);

  // Video Mode Button
  watchVideoBtn.addEventListener('click', () => {
    if (state.currentSong) openVideoModal(state.currentSong);
    else showToast('No song is currently selected', 'info');
  });

  // Direct Download Button
  directDownloadBtn.addEventListener('click', () => {
    if (state.currentSong) {
      window.location.href = `/download/${state.currentSong.id}`;
      showToast(`Downloading "${state.currentSong.title}"...`, 'success');
    } else {
      showToast('Select a song first to download', 'info');
    }
  });

  // Modal Closers
  modalCloseBtn.addEventListener('click', closeVideoModal);
  modalBackdrop.addEventListener('click', closeVideoModal);

  // Mobile QR Modal Listeners
  if (mobileQrBtn) mobileQrBtn.addEventListener('click', openQrModal);
  if (qrModalCloseBtn) qrModalCloseBtn.addEventListener('click', closeQrModal);
  if (qrModalBackdrop) qrModalBackdrop.addEventListener('click', closeQrModal);
  if (copyMobileLinkBtn) copyMobileLinkBtn.addEventListener('click', copyMobileLink);
  if (mobilePlayPauseBtn) mobilePlayPauseBtn.addEventListener('click', togglePlayPause);
  if (mobileNextBtn) mobileNextBtn.addEventListener('click', playNext);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeVideoModal();
      closeQrModal();
    }
  });
}

// --- Audio Player Engine ---
function setupAudioListeners() {
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const current = audio.currentTime;
    const duration = audio.duration;
    const percent = (current / duration) * 100;
    seekProgress.style.width = `${percent}%`;
    seekSlider.value = percent;
    currentTimeEl.textContent = formatTime(current);
  });

  audio.addEventListener('loadedmetadata', () => {
    totalDurationEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('play', () => {
    state.isPlaying = true;
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    if (mobilePlayIcon) mobilePlayIcon.classList.add('hidden');
    if (mobilePauseIcon) mobilePauseIcon.classList.remove('hidden');
    visualizerOverlay.classList.add('active');
  });

  audio.addEventListener('pause', () => {
    state.isPlaying = false;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    if (mobilePlayIcon) mobilePlayIcon.classList.remove('hidden');
    if (mobilePauseIcon) mobilePauseIcon.classList.add('hidden');
    visualizerOverlay.classList.remove('active');
  });

  audio.addEventListener('ended', () => {
    if (state.loopMode === 'one') {
      audio.currentTime = 0;
      audio.play();
    } else {
      playNext();
    }
  });

  audio.addEventListener('error', (e) => {
    console.warn("Audio playback error, falling back to YouTube Player if available:", e);
    visualizerOverlay.classList.remove('active');
  });
}

function playSong(song) {
  if (!song || !song.id) return;
  state.currentSong = song;
  state.currentIndex = state.savedSongs.findIndex(s => s.id === song.id);

  // Update UI Elements
  playerTitle.textContent = song.title;
  playerTitle.title = song.title;
  playerChannel.textContent = song.channel || 'YouTube Video';
  if (song.thumbnail_url) {
    playerCover.src = song.thumbnail_url;
  }
  totalDurationEl.textContent = song.duration || '00:00';
  currentTimeEl.textContent = '00:00';
  seekProgress.style.width = '0%';
  seekSlider.value = 0;

  // Set audio source to stream endpoint
  audio.src = `/stream/${song.id}`;
  audio.play().then(() => {
    state.isPlaying = true;
    showToast(`Now playing: ${song.title}`, 'info');
  }).catch(err => {
    console.error("Playback failed:", err);
    showToast("Starting audio stream...", "info");
  });
}

function togglePlayPause() {
  if (!state.currentSong) {
    if (state.savedSongs.length > 0) {
      playSong(state.savedSongs[0]);
    } else {
      showToast('Add a YouTube song to start playing', 'info');
    }
    return;
  }

  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}

function playNext() {
  if (state.savedSongs.length === 0) return;

  if (state.isShuffle) {
    const randomIndex = Math.floor(Math.random() * state.savedSongs.length);
    playSong(state.savedSongs[randomIndex]);
    return;
  }

  let nextIdx = state.currentIndex + 1;
  if (nextIdx >= state.savedSongs.length) {
    if (state.loopMode === 'all') {
      nextIdx = 0;
    } else {
      return;
    }
  }
  playSong(state.savedSongs[nextIdx]);
}

function playPrevious() {
  if (state.savedSongs.length === 0) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  let prevIdx = state.currentIndex - 1;
  if (prevIdx < 0) {
    prevIdx = state.savedSongs.length - 1;
  }
  playSong(state.savedSongs[prevIdx]);
}

function skipSeconds(seconds) {
  if (audio && audio.duration) {
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
  }
}

function toggleLoop() {
  if (state.loopMode === 'off') {
    state.loopMode = 'all';
    loopBtn.classList.add('active');
    loopBtn.title = 'Loop All';
    showToast('Looping all songs', 'info');
  } else if (state.loopMode === 'all') {
    state.loopMode = 'one';
    loopBtn.classList.add('active');
    loopBtn.title = 'Loop Current Track';
    showToast('Looping current track', 'info');
  } else {
    state.loopMode = 'off';
    loopBtn.classList.remove('active');
    loopBtn.title = 'Repeat Track';
    showToast('Looping disabled', 'info');
  }
}

function toggleShuffle() {
  state.isShuffle = !state.isShuffle;
  shuffleBtn.classList.toggle('active', state.isShuffle);
  showToast(state.isShuffle ? 'Shuffle enabled' : 'Shuffle disabled', 'info');
}

function toggleMute() {
  if (state.isMuted) {
    audio.volume = state.previousVolume || 0.8;
    volumeSlider.value = audio.volume;
    state.isMuted = false;
  } else {
    state.previousVolume = audio.volume;
    audio.volume = 0;
    volumeSlider.value = 0;
    state.isMuted = true;
  }
  updateVolumeIcon(audio.volume);
}

function updateVolumeIcon(vol) {
  if (vol === 0) {
    volHighIcon.classList.add('hidden');
    volMuteIcon.classList.remove('hidden');
  } else {
    volHighIcon.classList.remove('hidden');
    volMuteIcon.classList.add('hidden');
  }
}

// --- Video Modal Cinema View ---
function openVideoModal(song) {
  if (!song || !song.id) return;
  modalVideoTitle.textContent = song.title;
  videoModal.classList.remove('hidden');

  // Pause audio element if playing to prevent dual sound
  if (!audio.paused) {
    audio.pause();
  }

  // If YouTube Player already exists, load video, else create iframe
  const container = document.getElementById('youtubePlayerPlaceholder');
  container.innerHTML = `
    <iframe 
      width="100%" 
      height="100%" 
      src="https://www.youtube.com/embed/${song.id}?autoplay=1&enablejsapi=1" 
      title="${song.title}" 
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
      allowfullscreen>
    </iframe>
  `;
}

function closeVideoModal() {
  videoModal.classList.add('hidden');
  const container = document.getElementById('youtubePlayerPlaceholder');
  container.innerHTML = '';
}

// --- Mobile Host & QR Modal Logic ---
async function loadHostInfo() {
  try {
    const res = await fetch('/api/host-info');
    if (res.ok) {
      const data = await res.json();
      state.mobileUrl = data.mobile_url;
      if (mobileLinkInput) mobileLinkInput.value = data.mobile_url;
      if (qrImage) {
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data.mobile_url)}`;
      }
    }
  } catch (err) {
    console.warn('Could not load host info:', err);
  }
}

function openQrModal() {
  if (qrModal) {
    qrModal.classList.remove('hidden');
    if (state.mobileUrl && qrImage && !qrImage.src.includes('qrserver')) {
      qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(state.mobileUrl)}`;
    }
  }
}

function closeQrModal() {
  if (qrModal) qrModal.classList.add('hidden');
}

async function copyMobileLink() {
  const url = state.mobileUrl || (mobileLinkInput ? mobileLinkInput.value : '');
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    showToast('Mobile link copied to clipboard!', 'success');
    if (copyMobileLinkBtn) {
      const originalText = copyMobileLinkBtn.innerHTML;
      copyMobileLinkBtn.innerHTML = `<span>Copied!</span>`;
      setTimeout(() => copyMobileLinkBtn.innerHTML = originalText, 2000);
    }
  } catch (err) {
    // Fallback for copying
    if (mobileLinkInput) {
      mobileLinkInput.select();
      document.execCommand('copy');
      showToast('Link copied to clipboard!', 'success');
    }
  }
}

// --- Preview & Conversion Handlers ---
async function handleClipboardPaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      heroUrlInput.value = text.trim();
      headerUrlInput.value = text.trim();
      showToast('Link pasted from clipboard', 'info');
      handlePreview(text.trim());
    }
  } catch (err) {
    showToast('Unable to read clipboard automatically. Please paste manually.', 'info');
  }
}

async function handlePreview(url) {
  if (!url || !url.trim()) {
    showToast('Please enter a YouTube link', 'error');
    return;
  }

  showProgress('Fetching video metadata from YouTube...');
  try {
    const res = await fetch('/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() })
    });
    const data = await res.json();
    hideProgress();

    if (!res.ok) {
      showToast(data.error || 'Failed to fetch video details', 'error');
      return;
    }

    state.previewInfo = data;
    previewThumb.src = data.thumbnail_url;
    previewTitle.textContent = data.title;
    previewChannel.textContent = data.channel;
    previewDuration.textContent = data.duration;
    previewCard.classList.remove('hidden');

    if (data.is_saved) {
      previewSaveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Already in Library (Play Now)</span>
      `;
      previewSaveBtn.onclick = () => playSong(data);
    } else {
      previewSaveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Convert to MP3 & Save to Website</span>
      `;
      previewSaveBtn.onclick = () => handleConvert(data.youtube_url || url);
    }
  } catch (err) {
    hideProgress();
    showToast('Network error while fetching preview', 'error');
  }
}

async function handleConvert(url) {
  if (!url || !url.trim()) {
    showToast('Please paste a YouTube link to convert', 'error');
    return;
  }

  setConvertingState(true);
  showProgress('Downloading YouTube audio and converting to MP3...');

  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() })
    });

    const data = await res.json();
    setConvertingState(false);
    hideProgress();

    if (!res.ok) {
      showToast(data.error || 'Failed to convert YouTube video', 'error');
      return;
    }

    showToast(data.message || 'Saved to your website library!', 'success');
    
    // Refresh library and auto play
    await loadSavedSongs();
    if (data.song) {
      playSong(data.song);
    }
  } catch (err) {
    setConvertingState(false);
    hideProgress();
    showToast('Conversion process failed. Please check the URL.', 'error');
  }
}

function setConvertingState(isConverting) {
  convertBtn.disabled = isConverting;
  headerConvertBtn.disabled = isConverting;
  fetchBtn.disabled = isConverting;
  if (isConverting) {
    convertBtn.innerHTML = `<span>Converting...</span>`;
  } else {
    convertBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      <span>Convert to MP3 & Save</span>
    `;
  }
}

function showProgress(message) {
  progressContainer.classList.remove('hidden');
  progressText.textContent = message;
  progressPercent.textContent = 'Working...';
}

function hideProgress() {
  progressContainer.classList.add('hidden');
}

// --- Library Management ---
async function loadSavedSongs() {
  try {
    const res = await fetch('/api/songs');
    if (!res.ok) return;
    const songs = await res.json();
    state.savedSongs = songs;
    state.filteredSongs = songs;
    renderLibrary();
  } catch (err) {
    console.error('Failed to load songs:', err);
  }
}

function renderLibrary() {
  const songs = state.filteredSongs;
  const count = state.savedSongs.length;
  libraryCountBadge.textContent = `${count} ${count === 1 ? 'Song' : 'Songs'}`;
  navSongCount.textContent = count;

  if (count === 0) {
    emptyLibrary.classList.remove('hidden');
    songsGrid.classList.add('hidden');
    songsList.classList.add('hidden');
    return;
  }

  emptyLibrary.classList.add('hidden');

  if (state.viewMode === 'grid') {
    songsGrid.classList.remove('hidden');
    songsList.classList.add('hidden');
    renderGrid(songs);
  } else {
    songsGrid.classList.add('hidden');
    songsList.classList.remove('hidden');
    renderList(songs);
  }
}

function renderGrid(songs) {
  songsGrid.innerHTML = songs.map(song => `
    <div class="song-card" data-id="${song.id}">
      <div class="card-thumb-wrap">
        <img src="${song.thumbnail_url || 'https://img.youtube.com/vi/' + song.id + '/hqdefault.jpg'}" alt="${escapeHtml(song.title)}" loading="lazy">
        <span class="time-badge">${song.duration || '00:00'}</span>
        <button class="card-play-btn" onclick="playSongById('${song.id}')" title="Play Song">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
      <div class="card-info">
        <div class="card-title" title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</div>
        <div class="card-channel">${escapeHtml(song.channel || 'Artist')}</div>
        <div class="card-actions">
          <button class="card-action-btn" onclick="openVideoModalById('${song.id}')" title="Watch Video">
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Watch</span>
          </button>
          <a class="card-action-btn" href="/download/${song.id}" title="Download MP3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>MP3</span>
          </a>
          <button class="card-action-btn delete" onclick="deleteSongById('${song.id}', event)" title="Delete from Website">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderList(songs) {
  songsTableBody.innerHTML = songs.map((song, idx) => `
    <tr data-id="${song.id}">
      <td>${idx + 1}</td>
      <td>
        <img class="table-cover" src="${song.thumbnail_url || 'https://img.youtube.com/vi/' + song.id + '/hqdefault.jpg'}" alt="cover">
      </td>
      <td>
        <div class="table-title">${escapeHtml(song.title)}</div>
        <div class="table-channel">${escapeHtml(song.channel || 'Artist')}</div>
      </td>
      <td>${song.duration || '00:00'}</td>
      <td style="color: var(--text-muted); font-size: 0.8rem;">${(song.added_at || '').substring(0, 10)}</td>
      <td class="text-right">
        <div class="table-actions">
          <button class="icon-btn-subtle" onclick="playSongById('${song.id}')" title="Play">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <button class="icon-btn-subtle" onclick="openVideoModalById('${song.id}')" title="Watch Video">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </button>
          <a class="icon-btn-subtle" href="/download/${song.id}" title="Download MP3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
          <button class="icon-btn-subtle" onclick="deleteSongById('${song.id}', event)" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="color: var(--yt-red);"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function handleLibrarySearch(e) {
  const q = e.target.value.toLowerCase().trim();
  if (!q) {
    state.filteredSongs = state.savedSongs;
  } else {
    state.filteredSongs = state.savedSongs.filter(s => 
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.channel && s.channel.toLowerCase().includes(q))
    );
  }
  renderLibrary();
}

function setViewMode(mode) {
  state.viewMode = mode;
  viewGridBtn.classList.toggle('active', mode === 'grid');
  viewListBtn.classList.toggle('active', mode === 'list');
  renderLibrary();
}

window.playSongById = function(id) {
  const song = state.savedSongs.find(s => s.id === id);
  if (song) playSong(song);
};

window.openVideoModalById = function(id) {
  const song = state.savedSongs.find(s => s.id === id);
  if (song) openVideoModal(song);
};

window.deleteSongById = async function(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('Are you sure you want to remove this song from your library?')) return;

  try {
    const res = await fetch(`/api/songs/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Song deleted from library', 'info');
      // If deleted current song, reset player
      if (state.currentSong && state.currentSong.id === id) {
        audio.pause();
        audio.src = '';
        state.currentSong = null;
        playerTitle.textContent = 'No song playing';
        playerChannel.textContent = 'Choose a song from your library';
        playerCover.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='%23333'%3E%3Crect width='24' height='24'/%3E%3C/svg%3E";
        visualizerOverlay.classList.remove('active');
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
      }
      loadSavedSongs();
    } else {
      showToast('Failed to delete song', 'error');
    }
  } catch (err) {
    showToast('Network error while deleting', 'error');
  }
};

// --- Quick Samples ---
async function loadQuickSamples() {
  try {
    const res = await fetch('/api/quick-samples');
    if (!res.ok) return;
    const samples = await res.json();
    quickSamplesList.innerHTML = samples.map(s => `
      <div class="sample-chip" onclick="handleQuickSample('${s.url}')" title="${escapeHtml(s.title)}">
        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        <span>${escapeHtml(s.title.substring(0, 32))}${s.title.length > 32 ? '...' : ''}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load quick samples:', err);
  }
}

window.handleQuickSample = function(url) {
  heroUrlInput.value = url;
  headerUrlInput.value = url;
  handlePreview(url);
};

// --- Helpers ---
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
