// テナントslugはURLから取得: /admin/:slug
const parts = location.pathname.split("/").filter(Boolean);
const tenantSlug = parts[1];

const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");
const loginMsg = document.getElementById("loginMsg");
const uploadMsg = document.getElementById("uploadMsg");
const listEl = document.getElementById("list");
const passMsg = document.getElementById("passMsg");
const bgMsg = null; // Removed
const announcementEl = document.getElementById("announcement");

document.getElementById("gameUrl").textContent = `${location.origin}/g/${tenantSlug}`;

function toMs(dtLocalValue) { return new Date(dtLocalValue).getTime(); }

async function loadMeta() {
  const res = await fetch(`/api/${tenantSlug}/meta`, { cache: "no-store" });
  if (res.ok) {
    const meta = await res.json();
    if (announcementEl && meta.announcement) {
      announcementEl.textContent = meta.announcement;
      announcementEl.classList.remove("hidden");
    } else if (announcementEl) {
      announcementEl.classList.add("hidden");
    }
    const tenantNameEl = document.getElementById("tenantName");
    if (tenantNameEl) tenantNameEl.textContent = `(${meta.name})`;

    // Populate Effect Settings
    if (meta.effect_probs) {
      document.getElementById("star1").value = meta.effect_probs.star1 ?? 25;
      document.getElementById("star2").value = meta.effect_probs.star2 ?? 25;
      document.getElementById("star3").value = meta.effect_probs.star3 ?? 25;
      document.getElementById("star4").value = meta.effect_probs.star4 ?? 25;
    }
  }
}

async function tryLoadList() {
  await loadMeta();
  const res = await fetch(`/api/${tenantSlug}/images`, { cache: "no-store" });
  if (!res.ok) return false;
  renderList(await res.json());
  return true;
}


function renderList(rows) {
  listEl.innerHTML = "";
  rows.forEach((r) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="thumb"><img src="${r.url}" alt=""></div>
      <div class="meta">
        <div><b>ID:</b> ${r.id}</div>
        <div><b>確率:</b> ${r.probability}%</div>
        <div><b>開始:</b> ${new Date(r.start_at).toLocaleString()}</div>
        <div><b>終了:</b> ${new Date(r.end_at).toLocaleString()}</div>
      </div>
      <div class="actions">
        <button data-id="${r.id}" class="delBtn">削除</button>
      </div>
    `;
    listEl.appendChild(div);
  });

  document.querySelectorAll(".delBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const res = await fetch(`/api/${tenantSlug}/images/${id}`, { method: "DELETE" });
      if (!res.ok) return alert("削除失敗");
      await tryLoadList();
    });
  });
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  loginMsg.textContent = "";
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`/api/${tenantSlug}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) return (loginMsg.textContent = "ログイン失敗");
  loginBox.classList.add("hidden");
  adminBox.classList.remove("hidden");
  await tryLoadList();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await fetch(`/api/${tenantSlug}/logout`, { method: "POST" });
  adminBox.classList.add("hidden");
  loginBox.classList.remove("hidden");
});

// Save Effect Settings
document.getElementById("saveEffectBtn").addEventListener("click", async () => {
  const msg = document.getElementById("effectMsg");
  msg.textContent = "";
  const star1 = document.getElementById("star1").value;
  const star2 = document.getElementById("star2").value;
  const star3 = document.getElementById("star3").value;
  const star4 = document.getElementById("star4").value;

  const res = await fetch(`/api/${tenantSlug}/effect-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ star1, star2, star3, star4 }),
  });

  if (res.ok) {
    msg.textContent = "保存しました";
  } else {
    msg.textContent = "保存失敗";
  }
});

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  uploadMsg.textContent = "";

  const form = new FormData(e.target);
  form.append("start_at", String(toMs(document.getElementById("startAt").value)));
  form.append("end_at", String(toMs(document.getElementById("endAt").value)));
  // probability is already in form as input name="probability"

  const res = await fetch(`/api/${tenantSlug}/images`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return (uploadMsg.textContent = data.error || "登録失敗");

  uploadMsg.textContent = "登録しました";
  e.target.reset();
  await tryLoadList();
});

document.getElementById("changePassBtn").addEventListener("click", async () => {
  passMsg.textContent = "";
  const old_password = document.getElementById("oldPass").value;
  const new_password = document.getElementById("newPass").value;

  const res = await fetch(`/api/${tenantSlug}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ old_password, new_password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return (passMsg.textContent = data.error || "変更失敗");

  passMsg.textContent = "変更しました";
  document.getElementById("oldPass").value = "";
  document.getElementById("newPass").value = "";
});

(async () => {
  const ok = await tryLoadList();
  if (ok) {
    loginBox.classList.add("hidden");
    adminBox.classList.remove("hidden");
  }
})();
