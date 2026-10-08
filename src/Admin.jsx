import React, { useEffect, useState, useCallback } from "react";
import "./Admin.css";
import {
  API_BASE, health, getCollection, getProfile, login,
  saveItem, deleteItem, saveProfile, uploadPhoto,
} from "./api";

const PUB_TYPES = ["Conference Paper", "Journal Article", "Book", "Patent"];

// k = field name · area = textarea · opts = dropdown · hint = help text under the field
const FIELDS = {
  publications: [
    { k: "title", wide: true },
    { k: "type", opts: PUB_TYPES },
    { k: "year" },
    { k: "description", area: true },
    { k: "doi", hint: "Only the DOI, e.g. 10.1109/XXXXX — becomes a doi.org link" },
    { k: "url", hint: "Direct link to the paper (optional)" },
  ],
  experience:   [{ k: "role" }, { k: "organization" }, { k: "year" }, { k: "desc", area: true }],
  education:    [{ k: "degree", wide: true }, { k: "institution" }, { k: "year" }],
  awards:       [{ k: "title", wide: true }, { k: "description", area: true }],
  certificates: [{ k: "title", wide: true }, { k: "issuer" }],
  gallery:      [{ k: "title" }, { k: "caption" }],
  interests:    [{ k: "label", wide: true }, { k: "icon", hint: "An emoji, e.g. 🧠" }],
  links: [
    { k: "label", wide: true },
    { k: "url", wide: true, hint: "https://… or mailto:you@example.com" },
    { k: "icon", hint: "Emoji or short text, e.g. ✉  in  RG" },
    { k: "style", opts: ["", "li", "orcid", "rg"], hint: "Optional brand colour: li = LinkedIn, orcid, rg = ResearchGate" },
  ],
};

const IMAGE = ["awards", "certificates", "gallery"];

const NAV = [
  { group: "Site", items: [{ id: "profile", icon: "👤", label: "Profile & About", sub: "Name, photo, about text and sidebar stats" }] },
  {
    group: "Content",
    items: [
      { id: "publications", icon: "📄", label: "Publications", sub: "Papers, books and patents" },
      { id: "experience",   icon: "💼", label: "Experience",   sub: "Your professional timeline" },
      { id: "education",    icon: "🎓", label: "Education",    sub: "Degrees and institutions" },
      { id: "interests",    icon: "🧠", label: "Research interests", sub: "The tag cloud in the Research section" },
    ],
  },
  {
    group: "Media",
    items: [
      { id: "awards",       icon: "🏆", label: "Awards",       sub: "Award images with a caption" },
      { id: "certificates", icon: "📜", label: "Certificates", sub: "Certificate images and issuers" },
      { id: "gallery",      icon: "🖼️", label: "Gallery",      sub: "Photos shown in the gallery carousel" },
    ],
  },
  { group: "Links", items: [{ id: "links", icon: "🔗", label: "Social links", sub: "Contact and profile links in the sidebar" }] },
];
const ALL = NAV.flatMap((g) => g.items);

const LABELS = { desc: "Description", doi: "DOI", url: "URL", icon: "Icon", style: "Icon style" };
const labelOf = (k) => LABELS[k] || k.charAt(0).toUpperCase() + k.slice(1);
const nameOf = (it) => it.title || it.role || it.degree || it.label || "(untitled)";
const subOf = (it) =>
  [it.organization, it.institution, it.issuer, it.type, it.year, it.caption, it.url]
    .filter(Boolean).join(" · ");

// ───────────────────────── small pieces ─────────────────────────
function Field({ f, value, onChange }) {
  const common = { value: value ?? "", onChange: (e) => onChange(e.target.value) };
  const wide = f.area || f.wide;
  return (
    <label className={`adm-field${wide ? " adm-span" : ""}`}>
      <span className="adm-label">{labelOf(f.k)}</span>
      {f.opts ? (
        <select {...common}>
          {f.opts.map((o) => <option key={o} value={o}>{o || "(none)"}</option>)}
        </select>
      ) : f.area ? (
        <textarea rows={4} {...common} />
      ) : (
        <input type="text" {...common} />
      )}
      {f.hint && <span className="adm-hint">{f.hint}</span>}
    </label>
  );
}

function FileInput({ label = "Image", file, current, onChange }) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const shown = preview || current;
  return (
    <div className="adm-field adm-span">
      <span className="adm-label">{label}</span>
      <label className="adm-drop">
        <input type="file" accept="image/*" onChange={(e) => onChange(e.target.files[0] || null)} />
        {shown ? <img className="adm-drop-img" src={shown} alt="" /> : <span className="adm-drop-ico">⬆</span>}
        <span className="adm-drop-text">
          <b>{file ? file.name : current ? "Click to replace the image" : "Click to choose an image"}</b>
          {file ? "Will be uploaded to Cloudinary when you save" : "JPG, PNG or WebP · max 8 MB"}
        </span>
      </label>
    </div>
  );
}

function Toast({ banner, onClose }) {
  if (!banner) return null;
  return (
    <div className={`adm-toast ${banner.ok ? "ok" : "err"}`} role="status">
      <span className="adm-toast-ico">{banner.ok ? "✅" : "⚠️"}</span>
      <span className="adm-toast-msg">{banner.text}</span>
      <button className="adm-toast-x" onClick={onClose} aria-label="Dismiss">×</button>
    </div>
  );
}

const Btn = ({ busy, children, ...p }) => (
  <button {...p} disabled={busy || p.disabled}>
    {busy && <span className="adm-spin" />}
    {children}
  </button>
);

// ───────────────────────── list editor ─────────────────────────
function ListEditor({ col, token, notify, onAuthFail }) {
  const meta = ALL.find((n) => n.id === col);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editSrc, setEditSrc] = useState("");
  const [busy, setBusy] = useState(false);

  const blank = useCallback(() => {
    const f = { order: 0 };
    FIELDS[col].forEach(({ k, opts }) => (f[k] = opts ? opts[0] : ""));
    return f;
  }, [col]);

  const reset = useCallback(() => {
    setForm(blank()); setFile(null); setEditId(null); setEditSrc("");
  }, [blank]);

  const load = useCallback(
    () => getCollection(col).then((d) => { setItems(d); setLoaded(true); }).catch((e) => notify(e.message, false)),
    [col, notify]
  );

  useEffect(() => { reset(); load(); }, [reset, load]);

  const fail = (err) => { if (err.status === 401) onAuthFail(); notify(err.message, false); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveItem(token, col, { ...form, ...(file ? { image: file } : {}) }, editId);
      notify(editId ? "Changes saved" : "Item added", true);
      reset(); load();
    } catch (err) { fail(err); }
    setBusy(false);
  };

  const edit = (it) => {
    const f = { order: it.order ?? 0 };
    FIELDS[col].forEach(({ k }) => (f[k] = it[k] ?? ""));
    setForm(f); setEditId(it._id); setFile(null); setEditSrc(it.src || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (it) => {
    if (!window.confirm(`Delete "${nameOf(it)}"? This cannot be undone.`)) return;
    try {
      await deleteItem(token, col, it._id);
      notify("Item deleted", true);
      if (editId === it._id) reset();
      load();
    } catch (err) { fail(err); }
  };

  return (
    <div className="adm-split">
      <form onSubmit={submit} className="adm-card adm-sticky">
        <div className="adm-card-title">
          {editId ? "Edit item" : "Add new item"}
          <span className="adm-tag">{editId ? "Editing" : "New"}</span>
        </div>

        <div className="adm-grid">
          {FIELDS[col].map((f) => (
            <Field key={f.k} f={f} value={form[f.k]} onChange={(v) => setForm({ ...form, [f.k]: v })} />
          ))}
          <label className="adm-field">
            <span className="adm-label">Order</span>
            <input
              type="number"
              value={form.order ?? 0}
              onChange={(e) => setForm({ ...form, order: e.target.value })}
            />
            <span className="adm-hint">Lower number = shown first</span>
          </label>
          {IMAGE.includes(col) && <FileInput file={file} current={editSrc} onChange={setFile} />}
        </div>

        <div className="adm-actions">
          <Btn className="adm-btn adm-btn-primary" busy={busy}>
            {busy ? "Saving…" : editId ? "Save changes" : "Add item"}
          </Btn>
          {editId && (
            <button type="button" className="adm-btn adm-btn-ghost" onClick={reset}>Cancel</button>
          )}
        </div>
      </form>

      <div className="adm-card">
        <div className="adm-card-title">
          {meta?.label}
          <span className="adm-tag">{items.length} item{items.length === 1 ? "" : "s"}</span>
        </div>

        {loaded && items.length === 0 ? (
          <div className="adm-empty">
            <div className="adm-empty-ico">{meta?.icon}</div>
            Nothing here yet — add your first item using the form.
          </div>
        ) : (
          <ul className="adm-list">
            {items.map((it) => (
              <li key={it._id} className={`adm-item${editId === it._id ? " editing" : ""}`}>
                {it.src
                  ? <img className="adm-thumb" src={it.src} alt="" />
                  : <span className="adm-thumb-ico">{it.icon || meta?.icon}</span>}
                <div className="adm-item-body">
                  <div className="adm-item-title">{nameOf(it)}</div>
                  {subOf(it) && <div className="adm-item-sub">{subOf(it)}</div>}
                </div>
                <span className="adm-item-order" title="Order">#{it.order ?? 0}</span>
                <div className="adm-item-actions">
                  <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => edit(it)}>Edit</button>
                  <button className="adm-btn adm-btn-danger adm-btn-sm" onClick={() => remove(it)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── profile editor ─────────────────────────
function ProfileEditor({ token, notify, onAuthFail }) {
  const [f, setF] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getProfile()
      .then((p) => {
        p = p || {};
        setF({
          name: p.name || "", initials: p.initials || "", title: p.title || "",
          subtitle: p.subtitle || "", location: p.location || "",
          about: (p.about || []).join("\n\n"),
          stats: (p.stats || []).map((s) => `${s.value} | ${s.label}`).join("\n"),
          photo: p.photo || "",
        });
      })
      .catch((e) => notify(e.message, false));
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (v) => setF((cur) => ({ ...cur, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveProfile(token, {
        name: f.name, initials: f.initials, title: f.title, subtitle: f.subtitle, location: f.location,
        about: f.about.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean),
        stats: f.stats.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
          const [value, ...rest] = l.split("|");
          return { value: value.trim(), label: rest.join("|").trim() };
        }),
      });
      if (file) await uploadPhoto(token, file);
      notify("Profile saved", true);
      setFile(null); load();
    } catch (err) { if (err.status === 401) onAuthFail(); notify(err.message, false); }
    setBusy(false);
  };

  if (!f) return <div className="adm-card">Loading…</div>;

  return (
    <form onSubmit={save}>
      <div className="adm-card">
        <div className="adm-card-title">Identity</div>
        <div className="adm-grid">
          <Field f={{ k: "name" }} value={f.name} onChange={set("name")} />
          <Field f={{ k: "initials", hint: "Shown in the header logo, e.g. CH" }} value={f.initials} onChange={set("initials")} />
          <Field f={{ k: "title", hint: "e.g. Student · Researcher · Innovator" }} value={f.title} onChange={set("title")} />
          <Field f={{ k: "subtitle" }} value={f.subtitle} onChange={set("subtitle")} />
          <Field f={{ k: "location", wide: true }} value={f.location} onChange={set("location")} />
          <FileInput label="Profile photo" file={file} current={f.photo} onChange={setFile} />
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-title">Sidebar stats</div>
        <label className="adm-field">
          <span className="adm-label">One stat per line</span>
          <textarea
            rows={4}
            value={f.stats}
            onChange={(e) => set("stats")(e.target.value)}
            placeholder={"10+ | Publications\n3+ | Yrs Exp"}
          />
          <span className="adm-hint">Format: value | label</span>
        </label>
      </div>

      <div className="adm-card">
        <div className="adm-card-title">About</div>
        <label className="adm-field">
          <span className="adm-label">Biography</span>
          <textarea rows={16} value={f.about} onChange={(e) => set("about")(e.target.value)} />
          <span className="adm-hint">
            Separate paragraphs with a blank line. Wrap text in **double stars** to make it bold.
          </span>
        </label>
      </div>

      <div className="adm-savebar">
        <span>Changes go live on the site as soon as you save.</span>
        <Btn className="adm-btn adm-btn-primary" busy={busy}>{busy ? "Saving…" : "Save profile"}</Btn>
      </div>
    </form>
  );
}

// ───────────────────────── admin shell ─────────────────────────
export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");
  const [pw, setPw] = useState("");
  const [tab, setTab] = useState("profile");
  const [apiOk, setApiOk] = useState(null);
  const [banner, setBanner] = useState(null);
  const [logging, setLogging] = useState(false);

  const notify = useCallback((text, ok) => setBanner({ text, ok }), []);
  const logout = useCallback(() => { localStorage.removeItem("adminToken"); setToken(""); }, []);

  useEffect(() => { health().then(() => setApiOk(true)).catch(() => setApiOk(false)); }, []);

  useEffect(() => {
    if (!banner) return undefined;
    const t = setTimeout(() => setBanner(null), banner.ok ? 3500 : 9000);
    return () => clearTimeout(t);
  }, [banner]);

  const doLogin = async (e) => {
    e.preventDefault();
    setLogging(true);
    try {
      const res = await login(pw);
      localStorage.setItem("adminToken", res.token);
      setToken(res.token); setPw(""); setBanner(null);
    } catch (err) { notify(err.message, false); }
    setLogging(false);
  };

  // ── login screen ──
  if (!token)
    return (
      <div className="adm adm-login-wrap">
        <Toast banner={banner} onClose={() => setBanner(null)} />
        <form className="adm-card adm-login" onSubmit={doLogin}>
          <div className="adm-logo">CH</div>
          <h2>Portfolio admin</h2>
          <p className="adm-sub">Sign in to edit your portfolio content</p>

          <div className="adm-status" title={API_BASE}>
            <span className={`adm-dot ${apiOk === null ? "" : apiOk ? "ok" : "err"}`} />
            {apiOk === null ? "Checking server…"
              : apiOk ? "Server connected"
              : "Server not reachable — run “npm run dev” in /server"}
          </div>

          <label className="adm-field">
            <span className="adm-label">Password</span>
            <input
              type="password"
              placeholder="Admin password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoFocus
            />
          </label>
          <Btn className="adm-btn adm-btn-primary" busy={logging}>{logging ? "Signing in…" : "Sign in"}</Btn>
        </form>
      </div>
    );

  // ── dashboard ──
  const current = ALL.find((n) => n.id === tab);

  return (
    <div className="adm">
      <Toast banner={banner} onClose={() => setBanner(null)} />

      <aside className="adm-side">
        <div className="adm-brand">
          <div className="adm-logo">CH</div>
          <div><strong>Portfolio</strong><small>Admin panel</small></div>
        </div>

        <nav className="adm-nav">
          {NAV.map((g) => (
            <React.Fragment key={g.group}>
              <div className="adm-nav-label">{g.group}</div>
              {g.items.map((n) => (
                <button
                  key={n.id}
                  className={`adm-nav-item${tab === n.id ? " active" : ""}`}
                  onClick={() => { setTab(n.id); setBanner(null); }}
                >
                  <span className="adm-ico">{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>

        <div className="adm-side-foot">
          <a className="adm-btn adm-btn-side" href="#/">↗ View site</a>
          <button className="adm-btn adm-btn-side" onClick={logout}>Log out</button>
        </div>
      </aside>

      <main className="adm-main">
        <header className="adm-top">
          <h1>{current?.icon} {current?.label}</h1>
          <p>{current?.sub}</p>
        </header>

        {tab === "profile"
          ? <ProfileEditor token={token} notify={notify} onAuthFail={logout} />
          : <ListEditor key={tab} col={tab} token={token} notify={notify} onAuthFail={logout} />}
      </main>
    </div>
  );
}