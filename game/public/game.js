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
    imagesEl.innerHTML = `<div class="empty">現在表示対象の画像はありません</div>`;
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

// Logic: Show Result Screen
async function showResult() {
  showScreen("screenResult");
  triggerKinFlaVisual();
  playKinFlaSE();

  // Fetch and display images
  const data = await fetchActiveImages();
  const urls = (data.images || []).map((x) => x.url);
  renderImages(urls);

  if (resultMsg) {
    resultMsg.textContent = urls.length ? `表示中：${urls.length}枚` : "（管理画面で画像と時間を登録してください）";
  }

  if (poweredByEl) {
    const pb = (data.tenant && data.tenant.powered_by) ? data.tenant.powered_by : "";
    poweredByEl.textContent = pb ? `Powered by ${pb}` : "";
  }
}

// Logic: Pick Random Video Effect
function pickFx() {
  const list = [
    '/fx/fx1.mp4',
    '/fx/fx2.mp4',
    '/fx/fx3.mp4',
    '/fx/fx4.mp4',
  ];
  return list[Math.floor(Math.random() * list.length)];
}

// Logic: Start Game Flow
async function startFlow() {
  showScreen("screenVideo");

  if (!effectVideo) {
    // Fallback if video element missing
    showResult();
    return;
  }

  try {
    effectVideo.pause();
    effectVideo.currentTime = 0;
    effectVideo.muted = true; // Ensure autoplay works
    effectVideo.playsInline = true;
    effectVideo.src = pickFx();
    effectVideo.load();
    await effectVideo.play();
  } catch (e) {
    console.warn("Video play error:", e);
    // Fallback to result immediately
    showResult();
  }
}

// ============================
// Event Listeners
// ============================

// 1. Initialize
(async () => {
  const meta = await fetchMeta();
  applyBackground(meta);

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

    // Attempt to prime audio (User Gesture)
    if (!audioPrimed && kinFla) {
      try {
        kinFla.muted = true;
        await kinFla.play();
        kinFla.pause();
        kinFla.currentTime = 0;
        kinFla.muted = false;
        audioPrimed = true;
      } catch (e) {
        // ignore
        console.log("Audio prime failed", e);
      }
    } else {
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
