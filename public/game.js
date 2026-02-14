// テナントslugはURLから取得: /g/:slug
const parts = location.pathname.split("/").filter(Boolean);
const tenantSlug = parts[1]; // ["g","slug"]

// DOM Elements
const screenStart = document.getElementById("screenStart");
const screenVideo = document.getElementById("screenVideo");
const screenResult = document.getElementById("screenResult");

const startBtn = document.getElementById("startBtn");
const retryBtn = document.getElementById("retryBtn");

const effectVideo = document.getElementById("effectVideo");
const imagesEl = document.getElementById("images");
const resultMsg = document.getElementById("resultMsg");
const poweredByEl = document.getElementById("poweredBy");
const gameTitle = document.getElementById("gameTitle");

const kinFlaFx = document.getElementById("kinFlaFx");
const kinFla = document.getElementById("kinFla");
const missSE = document.getElementById("missSE");

let audioPrimed = false; // user gesture unlock flag

// ============================
// Helper Functions
// ============================

// Toggle Screens
function showScreen(id) {
  // Hide all screens
  [screenStart, screenVideo, screenResult].forEach(el => {
    if (el) el.classList.remove("active");
  });

  // Show target
  const target = document.getElementById(id);
  // Remove 'hidden' class just in case legacy CSS interferes, though .active should handle it
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("active");
  }
}

// API: Fetch Metadata (Title, Background)
async function fetchMeta() {
  try {
    const res = await fetch(`/api/${tenantSlug}/meta`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

// API: Fetch Active Images for Result
async function fetchActiveImages() {
  try {
    const res = await fetch(`/api/${tenantSlug}/active-images`, { cache: "no-store" });
    if (!res.ok) return { images: [] };
    return await res.json();
  } catch (e) { return { images: [] }; }
}

// Apply Background & Title
function applyBackground(meta) {
  if (!meta) return;
  const pc = meta.bg_pc_url ? `url("${meta.bg_pc_url}")` : "none";
  const spRaw = meta.bg_sp_url ? `url("${meta.bg_sp_url}")` : "none";
  const sp = spRaw === "none" ? pc : spRaw; // スマホ未設定ならPC背景を流用

  document.documentElement.style.setProperty("--bg-pc", pc);
  document.documentElement.style.setProperty("--bg-sp", sp);

  if (meta.name && gameTitle) gameTitle.textContent = meta.name;
}

// Render Result Images
function renderImages(urls) {
  imagesEl.innerHTML = "";
  if (!urls || !urls.length) {
    // Keep empty or let showResult handle "Zannen"
    // If we call this with empty, it clears content.
    imagesEl.innerHTML = "";
    imagesEl.dataset.count = 0;
    return;
  }

  imagesEl.dataset.count = urls.length;

  urls.forEach((url, idx) => {
    const d = document.createElement("div");
    d.className = "imgbox";
    d.innerHTML = `<img src="${url}" alt="result ${idx + 1}">`;
    imagesEl.appendChild(d);
    // Staggered animation
    setTimeout(() => d.classList.add("reveal"), idx * 140);
  });
}

// Effect: Flash Animation (Gold Flash)
function triggerKinFlaVisual() {
  if (!kinFlaFx) return;
  kinFlaFx.classList.remove("hidden");
  kinFlaFx.classList.remove("run");
  void kinFlaFx.offsetWidth; // trigger reflow
  kinFlaFx.classList.add("run");

  if (screenResult) {
    screenResult.classList.remove("shake");
    void screenResult.offsetWidth;
    screenResult.classList.add("shake");
  }

  setTimeout(() => kinFlaFx.classList.add("hidden"), 600);
}

// Effect: Sound
async function playKinFlaSE() {
  if (!kinFla) return;
  try {
    kinFla.currentTime = 0;
    await kinFla.play();
  } catch (e) {
    console.log("Audio play failed", e);
  }
}

// Effect: Sound (Miss)
async function playMissSE() {
  if (!missSE) return;
  try {
    missSE.currentTime = 0;
    await missSE.play();
  } catch (e) {
    console.log("Audio play failed", e);
  }
}

// Logic: Show Result Screen
async function showResult() {
  showScreen("screenResult");
  // triggerKinFlaVisual(); // Moved to WIN block
  // playKinFlaSE(); // Moved to WIN block

  // Fetch and display images
  const data = await fetchActiveImages();
  let validImages = data.images || [];

  // Filter by probability
  const wonImages = validImages.filter(img => {
    const prob = (img.probability !== undefined) ? img.probability : 0;
    // prob is Percentage (0-100).
    // Roll: 0.0 - 99.9...
    const roll = Math.random() * 100;
    return roll < prob;
  });

  if (wonImages.length > 0) {
    // WIN
    triggerKinFlaVisual();
    playKinFlaSE();
    renderImages(wonImages.map(img => img.url));
    if (resultMsg) resultMsg.textContent = `表示中：${wonImages.length}枚`;
  } else {
    // LOSE (Zannen)
    playMissSE();
    imagesEl.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;">
        <h2 style="font-size:3rem; color:#fff; text-shadow:0 0 10px red;">残念</h2>
        <p style="color:#ddd;">何も当たりませんでした...</p>
      </div>
    `;
    if (resultMsg) resultMsg.textContent = "";
  }

  if (poweredByEl) {
    const pb = (data.tenant && data.tenant.powered_by) ? data.tenant.powered_by : "";
    poweredByEl.textContent = pb ? `Powered by ${pb}` : "";
  }
}

// Cache meta to avoid async delay on click (iOS fix)
let cachedMeta = null;

// Logic: Pick Random Video Effect based on Probabilities
function pickFx(meta) {
  let probs = (meta && meta.effect_probs) ? meta.effect_probs : null;
  if (typeof probs === 'string') {
    try { probs = JSON.parse(probs); } catch (e) { probs = null; }
  }
  if (!probs) probs = { star1: 25, star2: 25, star3: 25, star4: 25 };

  // Create weighted list
  const pool = [];
  if (probs.star1 > 0) pool.push({ file: '/fx/fx1.mp4', weight: Number(probs.star1) });
  if (probs.star2 > 0) pool.push({ file: '/fx/fx2.mp4', weight: Number(probs.star2) });
  if (probs.star3 > 0) pool.push({ file: '/fx/fx3.mp4', weight: Number(probs.star3) });
  if (probs.star4 > 0) pool.push({ file: '/fx/fx4.mp4', weight: Number(probs.star4) });

  if (pool.length === 0) return '/fx/fx1.mp4'; // fallback

  const totalWeight = pool.reduce((a, b) => a + b.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of pool) {
    if (random < item.weight) return item.file;
    random -= item.weight;
  }
  return pool[pool.length - 1].file;
}

// Logic: Start Game Flow
async function startFlow() {
  showScreen("screenVideo");

  if (!effectVideo) {
    showResult();
    return;
  }

  try {
    // Use cached meta if available, otherwise fetch (but might block iOS sound)
    const meta = cachedMeta || await fetchMeta();

    effectVideo.pause();
    effectVideo.currentTime = 0;
    effectVideo.muted = false; // Enable sound!
    effectVideo.volume = 1.0;
    effectVideo.playsInline = true;
    effectVideo.src = pickFx(meta);
    effectVideo.load();

    // Attempt play
    const playPromise = effectVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => {
        console.warn("Video play error:", e);
        showResult();
      });
    }
  } catch (e) {
    console.warn("Flow error:", e);
    showResult();
  }
}

// ============================
// Event Listeners
// ============================

// 1. Initialize
(async () => {
  cachedMeta = await fetchMeta(); // Pre-fetch for iOS
  applyBackground(cachedMeta);

  // Check active images
  const data = await fetchActiveImages();
  if (!data || !data.images || data.images.length === 0) {
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.classList.add("disabled");

      const msg = document.createElement("div");
      msg.className = "disabledMsg";
      msg.textContent = "現在プレイできません";
      // Insert after start button or append to container
      startBtn.parentNode.appendChild(msg);
    }
  }

  showScreen("screenStart");
})();

// 2. Start Button Click
if (startBtn) {
  startBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    // Attempt to prime audio (User Gesture) with silent buffer
    if (!audioPrimed) {
      const silent = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
      silent.play().catch(e => console.log("Audio prime failed", e));
      audioPrimed = true;
    }

    await startFlow();
  });
}

// 3. Video Ended -> Show Result
if (effectVideo) {
  effectVideo.addEventListener("ended", () => {
    // Small delay for effect
    setTimeout(showResult, 500);
  });

  effectVideo.addEventListener("error", () => {
    showResult();
  });
}

// 4. Result Screen Click -> Dismiss (Return to Start) REMOVED
// Only retryBtn should trigger reset


// 5. Retry Button (Explicit)
if (retryBtn) {
  retryBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Avoid bubbling to screenResult click
    showScreen("screenStart");
  });
}

// 6. Sound Toggle
const soundToggle = document.getElementById("soundToggle");
if (soundToggle && effectVideo) {
  // Update icon based on state
  const updateIcon = () => {
    soundToggle.textContent = effectVideo.muted ? "🔇" : "🔊";
  };

  // Sync on play
  effectVideo.addEventListener("play", updateIcon);
  effectVideo.addEventListener("volumechange", updateIcon);

  soundToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    effectVideo.muted = !effectVideo.muted;
    // If we unmute, ensure volume is up
    if (!effectVideo.muted) {
      effectVideo.volume = 1.0;
    }
    updateIcon();
  });
}
