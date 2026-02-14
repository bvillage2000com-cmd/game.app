const express = require("express");
const session = require("express-session");
const dotenv = require("dotenv");
const path = require("path");
const multer = require("multer");
const Database = require("better-sqlite3");
const fs = require("fs");
const bcrypt = require("bcryptjs");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const SESSION_SECRET = process.env.SESSION_SECRET || "dev_secret_change_me";
const MASTER_PASS = process.env.MASTER_PASS || "BUKIKORE2026Bv";

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(path.join(DATA_DIR, "uploads"))) fs.mkdirSync(path.join(DATA_DIR, "uploads"));

const db = new Database(path.join(DATA_DIR, "db.sqlite"));
db.exec(`
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  powered_by TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
`);



// 既存DBのアップデート（背景カラム追加）
try { db.exec("ALTER TABLE tenants ADD COLUMN plan TEXT DEFAULT 'normal'"); } catch (e) { }
try { db.exec("ALTER TABLE tenants ADD COLUMN bg_pc TEXT"); } catch (e) { }
try { db.exec("ALTER TABLE tenants ADD COLUMN bg_sp TEXT"); } catch (e) { }
try { db.exec("ALTER TABLE tenants ADD COLUMN announcement TEXT"); } catch (e) { }
try { db.exec("ALTER TABLE tenants ADD COLUMN effect_probs TEXT DEFAULT '{\"star1\":25,\"star2\":25,\"star3\":25,\"star4\":25}'"); } catch (e) { }
try { db.exec("ALTER TABLE images ADD COLUMN probability INTEGER DEFAULT 0"); } catch (e) { }

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

app.use("/uploads", express.static(path.join(DATA_DIR, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

function slugOk(slug) {
  return typeof slug === "string" && /^[a-z0-9_-]{1,32}$/.test(slug);
}

function requireMaster(req, res, next) {
  if (req.session && req.session.master === true) return next();
  return res.status(401).json({ error: "master unauthorized" });
}

function requireLoginForSlug(req, res, next) {
  const slug = req.params.slug;
  if (!slugOk(slug)) return res.status(400).json({ error: "invalid slug" });

  const s = req.session || {};
  if (!s.user_id || !s.tenant_id || s.tenant_slug !== slug) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

function tenantBySlug(slug) {
  return db.prepare("SELECT id, slug, name, plan, powered_by, bg_pc, bg_sp, announcement, effect_probs FROM tenants WHERE slug=?").get(slug);
}

// upload
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(DATA_DIR, "uploads")),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
    cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// pages
app.get("/g/:slug", (req, res) => {
  const { slug } = req.params;
  if (!slugOk(slug) || !tenantBySlug(slug)) return res.status(404).send("Not Found");
  res.sendFile(path.join(__dirname, "public", "game.html"));
});
app.get("/admin/:slug", (req, res) => {
  const { slug } = req.params;
  if (!slugOk(slug) || !tenantBySlug(slug)) return res.status(404).send("Not Found");
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});
app.get("/master", (req, res) => res.sendFile(path.join(__dirname, "public", "master.html")));

// master api
app.post("/api/master/login", (req, res) => {
  const { password } = req.body;
  if (password && password === MASTER_PASS) {
    req.session.master = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false });
});
app.post("/api/master/logout", (req, res) => {
  req.session.master = false;
  res.json({ ok: true });
});
app.get("/api/master/tenants", requireMaster, (req, res) => {
  // Join users to get the admin username (GROUP BY t.id to pick one if multiples exist, though schema says unique username)
  // Logic: picking first user found for the tenant
  const rows = db.prepare(`
    SELECT t.id, t.slug, t.name, t.plan, t.powered_by, t.announcement, t.created_at, u.username
    FROM tenants t
    LEFT JOIN users u ON t.id = u.tenant_id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all();
  res.json(rows);
});
app.post("/api/master/tenants", requireMaster, (req, res) => {
  const { slug, name, plan, powered_by } = req.body;
  if (!slugOk(slug)) return res.status(400).json({ error: "invalid slug" });
  if (!name || typeof name !== "string") return res.status(400).json({ error: "invalid name" });
  try {
    const info = db.prepare("INSERT INTO tenants (slug, name, plan, powered_by, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(slug, name, plan || "normal", powered_by || "", Date.now());
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: "slug already exists" });
  }
});
app.post("/api/master/tenants/update", requireMaster, (req, res) => {
  const { slug, name, plan, powered_by, announcement, username, password } = req.body;
  if (!slugOk(slug)) return res.status(400).json({ error: "invalid slug" });

  const tenant = tenantBySlug(slug);
  if (!tenant) return res.status(404).json({ error: "tenant not found" });

  // Update tenant info
  const updateTenant = db.prepare("UPDATE tenants SET name=?, plan=?, powered_by=?, announcement=? WHERE slug=?");
  updateTenant.run(name || tenant.name, plan || tenant.plan || "normal", powered_by || "", announcement || "", slug);

  // Update user info if provided
  if (username) {
    const user = db.prepare("SELECT id FROM users WHERE tenant_id=?").get(tenant.id);
    if (user) {
      // Update existing user
      if (password && password.length >= 6) {
        const hash = bcrypt.hashSync(password, 10);
        db.prepare("UPDATE users SET username=?, password_hash=? WHERE id=?").run(username, hash, user.id);
      } else {
        db.prepare("UPDATE users SET username=? WHERE id=?").run(username, user.id);
      }
    } else {
      // Create new user if not exists and password provided
      if (password && password.length >= 6) {
        try {
          const hash = bcrypt.hashSync(password, 10);
          db.prepare("INSERT INTO users (tenant_id, username, password_hash, created_at) VALUES (?, ?, ?, ?)")
            .run(tenant.id, username, hash, Date.now());
        } catch (e) {
          return res.status(400).json({ error: "username already exists" });
        }
      }
    }
  }

  res.json({ ok: true });
});
app.post("/api/master/tenants/broadcast", requireMaster, (req, res) => {
  const { announcement } = req.body;
  // Update ALL tenants
  db.prepare("UPDATE tenants SET announcement=?").run(announcement || "");
  res.json({ ok: true });
});

app.delete("/api/master/tenants/:slug", requireMaster, (req, res) => {
  const { slug } = req.params;
  if (!slugOk(slug)) return res.status(400).json({ error: "invalid slug" });

  const tenant = tenantBySlug(slug);
  if (!tenant) return res.status(404).json({ error: "tenant not found" });

  // CASCASE delete handles users and images if Foreign Keys are ON.
  // We verified PRAGMA foreign_keys = ON; in line 22.
  // But images files on disk won't be deleted by DB cascade.
  // We should manually delete image files first.

  const images = db.prepare("SELECT filename FROM images WHERE tenant_id=?").all(tenant.id);
  images.forEach(img => {
    const p = path.join(DATA_DIR, "uploads", img.filename);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch (e) { }
    }
  });

  db.prepare("DELETE FROM tenants WHERE id=?").run(tenant.id);
  res.json({ ok: true });
});

app.post("/api/master/users", requireMaster, (req, res) => {
  const { tenant_slug, username, password } = req.body;
  if (!slugOk(tenant_slug)) return res.status(400).json({ error: "invalid tenant slug" });
  if (!username || typeof username !== "string") return res.status(400).json({ error: "invalid username" });
  if (!password || typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "password too short" });

  const tenant = tenantBySlug(tenant_slug);
  if (!tenant) return res.status(404).json({ error: "tenant not found" });

  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db.prepare("INSERT INTO users (tenant_id, username, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(tenant.id, username, hash, Date.now());
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: "username already exists" });
  }
});
app.post("/api/master/users/reset", requireMaster, (req, res) => {
  const { username, new_password } = req.body;
  if (!username || typeof username !== "string") return res.status(400).json({ error: "invalid username" });
  if (!new_password || typeof new_password !== "string" || new_password.length < 6) return res.status(400).json({ error: "password too short" });
  const user = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  if (!user) return res.status(404).json({ error: "user not found" });
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hash, user.id);
  res.json({ ok: true });
});
app.post("/api/master/tenants/poweredby", requireMaster, (req, res) => {
  const { slug, powered_by } = req.body;
  if (!slugOk(slug)) return res.status(400).json({ error: "invalid slug" });
  if (typeof powered_by !== "string") return res.status(400).json({ error: "invalid powered_by" });
  const tenant = tenantBySlug(slug);
  if (!tenant) return res.status(404).json({ error: "tenant not found" });
  db.prepare("UPDATE tenants SET powered_by=? WHERE slug=?").run(powered_by, slug);
  res.json({ ok: true });
});

// tenant login
app.post("/api/:slug/login", (req, res) => {
  const { slug } = req.params;
  if (!slugOk(slug)) return res.status(400).json({ error: "invalid slug" });

  const { username, password } = req.body;
  const tenant = tenantBySlug(slug);
  if (!tenant) return res.status(404).json({ error: "tenant not found" });

  const user = db.prepare("SELECT id, tenant_id, password_hash FROM users WHERE username=? AND tenant_id=?")
    .get(username, tenant.id);
  if (!user) return res.status(401).json({ ok: false });

  const ok = bcrypt.compareSync(password || "", user.password_hash);
  if (!ok) return res.status(401).json({ ok: false });

  req.session.user_id = user.id;
  req.session.tenant_id = tenant.id;
  req.session.tenant_slug = slug;
  res.json({ ok: true });
});
app.post("/api/:slug/logout", (req, res) => {
  const { slug } = req.params;
  if (!slugOk(slug)) return res.status(400).json({ error: "invalid slug" });
  if (req.session && req.session.tenant_slug === slug) {
    req.session.user_id = null;
    req.session.tenant_id = null;
    req.session.tenant_slug = null;
  }
  res.json({ ok: true });
});
app.post("/api/:slug/change-password", requireLoginForSlug, (req, res) => {
  const { old_password, new_password } = req.body;
  if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
    return res.status(400).json({ error: "password too short" });
  }
  const user = db.prepare("SELECT id, password_hash FROM users WHERE id=?").get(req.session.user_id);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const ok = bcrypt.compareSync(old_password || "", user.password_hash);
  if (!ok) return res.status(401).json({ error: "old password wrong" });

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(hash, user.id);
  res.json({ ok: true });
});

// images per tenant
app.get("/api/:slug/images", requireLoginForSlug, (req, res) => {
  const tenant = tenantBySlug(req.params.slug);

  // Auto-delete older than 3 days
  const expireLimit = Date.now() - (3 * 24 * 60 * 60 * 1000);
  const expired = db.prepare("SELECT id, filename FROM images WHERE tenant_id=? AND created_at < ?").all(tenant.id, expireLimit);

  expired.forEach(row => {
    db.prepare("DELETE FROM images WHERE id=?").run(row.id);
    const p = path.join(DATA_DIR, "uploads", row.filename);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch (e) { }
    }
  });

  const rows = db.prepare("SELECT id, filename, start_at, end_at, probability, created_at FROM images WHERE tenant_id=? ORDER BY created_at DESC")
    .all(tenant.id)
    .map(r => ({ ...r, url: `/uploads/${r.filename}` }));
  res.json(rows);
});
app.post("/api/:slug/images", requireLoginForSlug, upload.single("image"), (req, res) => {
  const tenant = tenantBySlug(req.params.slug);
  const count = db.prepare("SELECT COUNT(*) as c FROM images WHERE tenant_id=?").get(tenant.id).c;
  if (count >= 5) {
    if (req.file?.path) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "max 5 images allowed" });
  }
  const start_at = Number(req.body.start_at);
  const end_at = Number(req.body.end_at);
  const probability = (req.body.probability !== undefined && req.body.probability !== "") ? Number(req.body.probability) : 100;

  if (!req.file) return res.status(400).json({ error: "no file" });
  if (!start_at || !end_at || end_at <= start_at) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "invalid schedule" });
  }
  const info = db.prepare("INSERT INTO images (tenant_id, filename, start_at, end_at, probability, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(tenant.id, req.file.filename, start_at, end_at, probability, Date.now());
  res.json({ ok: true, id: info.lastInsertRowid });
});
app.delete("/api/:slug/images/:id", requireLoginForSlug, (req, res) => {
  const tenant = tenantBySlug(req.params.slug);
  const id = Number(req.params.id);
  const row = db.prepare("SELECT filename FROM images WHERE id=? AND tenant_id=?").get(id, tenant.id);
  if (!row) return res.status(404).json({ error: "not found" });
  db.prepare("DELETE FROM images WHERE id=? AND tenant_id=?").run(id, tenant.id);
  const p = path.join(DATA_DIR, "uploads", row.filename);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  res.json({ ok: true });
});


// 背景画像設定（PC/SP）
app.post(
  "/api/:slug/backgrounds",
  requireLoginForSlug,
  upload.fields([{ name: "bg_pc", maxCount: 1 }, { name: "bg_sp", maxCount: 1 }]),
  (req, res) => {
    const tenant = tenantBySlug(req.params.slug);
    const pc = req.files && req.files.bg_pc ? req.files.bg_pc[0] : null;
    const sp = req.files && req.files.bg_sp ? req.files.bg_sp[0] : null;

    if (!pc && !sp) return res.status(400).json({ error: "no files" });

    if (pc && tenant.bg_pc) {
      const old = path.join(DATA_DIR, "uploads", tenant.bg_pc);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    if (sp && tenant.bg_sp) {
      const old = path.join(DATA_DIR, "uploads", tenant.bg_sp);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    const nextPc = pc ? pc.filename : tenant.bg_pc || null;
    const nextSp = sp ? sp.filename : tenant.bg_sp || null;

    db.prepare("UPDATE tenants SET bg_pc=?, bg_sp=? WHERE slug=?").run(nextPc, nextSp, tenant.slug);
    res.json({ ok: true, bg_pc_url: nextPc ? `/uploads/${nextPc}` : "", bg_sp_url: nextSp ? `/uploads/${nextSp}` : "" });
  }
);

app.post("/api/:slug/backgrounds/clear", requireLoginForSlug, (req, res) => {
  const tenant = tenantBySlug(req.params.slug);
  const target = (req.body && req.body.target) || "all"; // pc / sp / all

  let nextPc = tenant.bg_pc || null;
  let nextSp = tenant.bg_sp || null;

  if (target === "pc" || target === "all") {
    if (tenant.bg_pc) {
      const p = path.join(DATA_DIR, "uploads", tenant.bg_pc);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    nextPc = null;
  }
  if (target === "sp" || target === "all") {
    if (tenant.bg_sp) {
      const p = path.join(DATA_DIR, "uploads", tenant.bg_sp);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    nextSp = null;
  }

  db.prepare("UPDATE tenants SET bg_pc=?, bg_sp=? WHERE slug=?").run(nextPc, nextSp, tenant.slug);
  res.json({ ok: true, bg_pc_url: nextPc ? `/uploads/${nextPc}` : "", bg_sp_url: nextSp ? `/uploads/${nextSp}` : "" });
});

app.post("/api/:slug/effect-settings", requireLoginForSlug, (req, res) => {
  const tenant = tenantBySlug(req.params.slug);
  const { star1, star2, star3, star4 } = req.body;
  const probs = {
    star1: Number(star1) || 0,
    star2: Number(star2) || 0,
    star3: Number(star3) || 0,
    star4: Number(star4) || 0
  };
  // Ensure sum is reasonable? Not strictly necessary, but good practice. We'll strict to JSON.
  db.prepare("UPDATE tenants SET effect_probs=? WHERE slug=?").run(JSON.stringify(probs), tenant.slug);
  res.json({ ok: true });
});


// game meta + active
app.get("/api/:slug/meta", (req, res) => {
  const { slug } = req.params;
  if (!slugOk(slug)) return res.status(400).json({ error: "invalid slug" });
  const tenant = tenantBySlug(slug);
  if (!tenant) return res.status(404).json({ error: "tenant not found" });
  let effect_probs = { star1: 25, star2: 25, star3: 25, star4: 25 };
  try { if (tenant.effect_probs) effect_probs = JSON.parse(tenant.effect_probs); } catch (e) { }
  res.json({ slug: tenant.slug, name: tenant.name, powered_by: tenant.powered_by || "", announcement: tenant.announcement || "", bg_pc_url: tenant.bg_pc ? `/uploads/${tenant.bg_pc}` : "", bg_sp_url: tenant.bg_sp ? `/uploads/${tenant.bg_sp}` : "", effect_probs });
});
app.get("/api/:slug/active-images", (req, res) => {
  const { slug } = req.params;
  if (!slugOk(slug)) return res.status(400).json({ error: "invalid slug" });
  const tenant = tenantBySlug(slug);
  if (!tenant) return res.status(404).json({ error: "tenant not found" });
  const now = Date.now();
  const rows = db.prepare("SELECT id, filename, start_at, end_at, probability FROM images WHERE tenant_id=? AND start_at <= ? AND end_at >= ? ORDER BY start_at ASC")
    .all(tenant.id, now, now)
    .map(r => ({ id: r.id, url: `/uploads/${r.filename}`, start_at: r.start_at, end_at: r.end_at, probability: r.probability }));

  let effect_probs = { star1: 25, star2: 25, star3: 25, star4: 25 };
  try { if (tenant.effect_probs) effect_probs = JSON.parse(tenant.effect_probs); } catch (e) { }

  res.json({ now, tenant: { slug: tenant.slug, name: tenant.name, powered_by: tenant.powered_by || "", announcement: tenant.announcement || "", bg_pc_url: tenant.bg_pc ? `/uploads/${tenant.bg_pc}` : "", bg_sp_url: tenant.bg_sp ? `/uploads/${tenant.bg_sp}` : "", effect_probs }, images: rows });
});

app.get("/", (req, res) => res.send("OK. Use /master to create tenants/users. Game: /g/:slug  Admin: /admin/:slug"));
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
