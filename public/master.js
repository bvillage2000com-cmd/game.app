const masterLogin = document.getElementById("masterLogin");
const masterPanel = document.getElementById("masterPanel");

const masterMsg = document.getElementById("masterMsg");
const tenantMsg = document.getElementById("tenantMsg");
const userMsg = document.getElementById("userMsg");
const resetMsg = document.getElementById("resetMsg");
const tenantList = document.getElementById("tenantList");

const editTenantPanel = document.getElementById("editTenantPanel");
const editSlug = document.getElementById("editSlug");
const editName = document.getElementById("editName");
const editPowered = document.getElementById("editPowered");
const editAnnouncement = document.getElementById("editAnnouncement");
const editMsg = document.getElementById("editMsg");

let allTenants = [];
let lastIssued = { slug: null, password: null };
const tenantSearch = document.getElementById("tenantSearch");

async function refreshTenants() {
  try {
    const res = await fetch("/api/master/tenants", { cache: "no-store" });
    if (!res.ok) {
      console.error("Refresh failed", res.status);
      return;
    }
    allTenants = await res.json();
    renderTenantList(allTenants);
  } catch (e) {
    console.error("Refresh error", e);
  }
}

function renderTenantList(tenants) {
  tenantList.innerHTML = "";
  const ul = document.createElement("ul");
  ul.style.listStyle = "none";
  ul.style.padding = "0";
  ul.style.margin = "0";

  tenants.forEach((t) => {
    const li = document.createElement("li");
    li.style.borderBottom = "1px solid #2d3748";

    const btn = document.createElement("button");
    btn.className = "tenantBtn";
    btn.style.width = "100%";
    btn.style.textAlign = "left";
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.padding = "10px";
    btn.style.color = "#fff";
    btn.style.cursor = "pointer";
    btn.style.display = "flex";
    btn.style.justifyContent = "space-between";
    btn.style.alignItems = "center";

    // Hover effect (simple inline)
    btn.onmouseover = () => btn.style.background = "#2d3748";
    btn.onmouseout = () => btn.style.background = "transparent";

    const planBadge = t.plan === 'premium'
      ? '<span style="background:#ecc94b; color:#000; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-left:8px;">PREMIUM</span>'
      : '<span style="background:#718096; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:8px;">NORMAL</span>';

    btn.innerHTML = `
      <span>${t.name} <span style="color:#718096; font-size:0.9em;">(${t.slug})</span>${planBadge}</span>
      ${t.announcement ? '<span style="color:#fbbf24; font-size:12px;">★</span>' : ''}
    `;

    btn.onclick = () => openEdit(t);

    li.appendChild(btn);
    ul.appendChild(li);
  });
  tenantList.appendChild(ul);
}

// Search Filter
tenantSearch.addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allTenants.filter(t =>
    t.name.toLowerCase().includes(term) ||
    t.slug.toLowerCase().includes(term)
  );
  renderTenantList(filtered);
});

function openEdit(t) {
  editTenantPanel.classList.remove("hidden");
  editSlug.value = t.slug;
  editName.value = t.name;
  editPowered.value = t.powered_by || "";
  document.getElementById("editTenantSlugRef").value = t.slug;
  document.getElementById("editUsername").value = t.username || "";
  document.getElementById("editTenantSlugRef").value = t.slug;
  document.getElementById("editUsername").value = t.username || "";
  // password handling moved to below
  editAnnouncement.value = t.announcement || "";
  editAnnouncement.value = t.announcement || "";

  // Set Plan Radio
  const plan = t.plan || "normal";
  const radios = document.getElementsByName("editPlan");
  for (const r of radios) {
    r.checked = (r.value === plan);
  }

  // URL Display
  const origin = location.origin;
  document.getElementById("editAdminUrl").value = `${origin}/admin/${t.slug}`;
  document.getElementById("editGameUrl").value = `${origin}/g/${t.slug}`;



  // Note: We don't auto-fill user password for security/policy, and user requested "change only".
  // So we just leave it blank and disabled.


  editMsg.textContent = "";
  window.scrollTo({ top: editTenantPanel.offsetTop - 20, behavior: "smooth" });
}

document.getElementById("broadcastBtn").addEventListener("click", async () => {
  const msgEl = document.getElementById("broadcastMsg");
  msgEl.textContent = "";
  const announcement = document.getElementById("broadcastAnnouncement").value.trim();

  if (!confirm("全ての店舗のお知らせを上書きします。よろしいですか？")) return;

  const res = await fetch("/api/master/tenants/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ announcement }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    msgEl.textContent = data.error || "一斉送信失敗";
    return;
  }

  msgEl.textContent = "一斉送信しました";
  await refreshTenants();
});

document.getElementById("saveTenantBtn").addEventListener("click", async () => {
  editMsg.textContent = "";
  const slug = editSlug.value;
  const name = editName.value.trim();
  const powered_by = editPowered.value.trim();
  const announcement = editAnnouncement.value.trim();
  const username = document.getElementById("editUsername").value.trim();
  const plan = document.querySelector('input[name="editPlan"]:checked')?.value || "normal";

  const res = await fetch("/api/master/tenants/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, name, plan, powered_by, announcement, username }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    editMsg.textContent = data.error || "保存失敗";
    return;
  }

  editMsg.textContent = "保存しました";
  await refreshTenants();
  setTimeout(() => {
    editTenantPanel.classList.add("hidden");
  }, 1000);
});

document.getElementById("deleteTenantBtn").addEventListener("click", async () => {
  const slug = editSlug.value;
  if (!slug) return;

  if (!confirm(`店舗「${editName.value} (${slug})」を本当に削除しますか？\nこの操作は取り消せません。\nユーザー、画像など全てのデータが削除されます。`)) {
    return;
  }

  if (!confirm("本当に削除してよろしいですか？")) return;

  const res = await fetch(`/api/master/tenants/${slug}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error || "削除失敗");
    return;
  }

  alert("削除しました");
  editTenantPanel.classList.add("hidden");
  await refreshTenants();
});

document.getElementById("cancelEditBtn").addEventListener("click", () => {
  editTenantPanel.classList.add("hidden");
});

document.getElementById("backFromEditBtn").addEventListener("click", () => {
  editTenantPanel.classList.add("hidden");
});



document.getElementById("masterLoginBtn").addEventListener("click", async () => {
  masterMsg.textContent = "";
  const password = document.getElementById("masterPass").value;

  const res = await fetch("/api/master/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) return (masterMsg.textContent = "ログイン失敗");

  masterLogin.classList.add("hidden");
  masterPanel.classList.remove("hidden");
  await refreshTenants();
});

document.getElementById("masterLogoutBtn").addEventListener("click", async () => {
  await fetch("/api/master/logout", { method: "POST" });
  masterPanel.classList.add("hidden");
  editTenantPanel.classList.add("hidden");
  masterLogin.classList.remove("hidden");
});

document.getElementById("createTenantBtn").addEventListener("click", async () => {
  try {
    tenantMsg.textContent = "";
    const slug = document.getElementById("tSlug").value.trim();
    const name = document.getElementById("tName").value.trim();
    const powered_by = document.getElementById("tPowered").value.trim();
    const plan = document.querySelector('input[name="tPlan"]:checked').value;

    const res = await fetch("/api/master/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, name, powered_by, plan }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      tenantMsg.textContent = data.error || "作成失敗";
      return;
    }

    document.getElementById("tSlug").value = "";
    document.getElementById("tName").value = "";
    document.getElementById("tPowered").value = "BUKIKORE KIKAKU"; // Reset to default
    await refreshTenants();
  } catch (e) {
    tenantMsg.textContent = "エラーが発生しました: " + e.message;
    console.error(e);
  }
});

document.getElementById("createUserBtn").addEventListener("click", async () => {
  userMsg.textContent = "";
  const tenant_slug = document.getElementById("uTenant").value.trim();
  const username = document.getElementById("uName").value.trim();
  const password = document.getElementById("uPass").value.trim();

  const res = await fetch("/api/master/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenant_slug, username, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return (userMsg.textContent = data.error || "発行失敗");

  // Save for auto-fill in Edit Tenant
  lastIssued = { slug: tenant_slug, password: password };

  userMsg.textContent = "発行しました（このusername/パスを相手に渡してください）";
  await refreshTenants();
});

document.getElementById("resetBtn").addEventListener("click", async () => {
  resetMsg.textContent = "";
  const username = document.getElementById("resetUser").value.trim();
  const new_password = document.getElementById("resetPass").value.trim();

  const res = await fetch("/api/master/users/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, new_password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return (resetMsg.textContent = data.error || "再発行失敗");

  resetMsg.textContent = "再発行しました";
});

document.getElementById("refreshBtn").addEventListener("click", refreshTenants);

// セッションが残っていれば自動表示
(async () => {
  const res = await fetch("/api/master/tenants", { cache: "no-store" });
  if (res.ok) {
    masterLogin.classList.add("hidden");
    masterPanel.classList.remove("hidden");
    await refreshTenants();
  }
})();
