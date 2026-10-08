// ResearchPortfolio.jsx
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import "./App.css";

import { getPortfolio } from "./api";

// ─── TRANSLATION ──────────────────────────────────────────────────────────────
const translateText = async (text, targetLang) => {
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );
    const data = await res.json();
    return data[0].map((item) => item[0]).join("");
  } catch {
    return text;
  }
};

const translatePage = async (targetLang) => {
  const els = document.querySelectorAll("h1, h2, h3, p, li, button");
  for (const el of els) {
    const orig = el.innerText.trim();
    if (orig && orig.length < 500) {
      el.innerText = await translateText(orig, targetLang);
    }
  }
};

// ─── NORMALISE item from any shape ────────────────────────────────────────────
const normaliseItem = (item, srcKey, titleKey, captionKey) => ({
  src:     item[srcKey]     || item.src     || item.image || "",
  title:   item[titleKey]   || item.title   || "",
  caption: item[captionKey] || item.caption || item.description || item.issuer || "",
});

// Smaller, auto-format Cloudinary thumbnails for the carousel cards
const thumb = (url) =>
  url && url.includes("res.cloudinary.com") && url.includes("/upload/")
    ? url.replace("/upload/", "/upload/f_auto,q_auto,w_600/")
    : url;

// **bold** support for About text
const renderRich = (text = "") =>
  text.split("**").map((part, i) =>
    i % 2 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
  );

// ─── LIGHTBOX — rendered via Portal onto document.body ────────────────────────
function Lightbox({ images, startIndex, srcKey, titleKey, captionKey, onClose }) {
  const [idx, setIdx]     = useState(startIndex);
  const touchStartX       = useRef(null);
  const item              = normaliseItem(images[idx], srcKey, titleKey, captionKey);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape")                                  onClose();
      if (e.key === "ArrowRight" && idx < images.length - 1)  setIdx((i) => i + 1);
      if (e.key === "ArrowLeft"  && idx > 0)                   setIdx((i) => i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, images.length, onClose]);

  const modal = (
    <div
      className="lb-overlay"
      onClick={onClose}
      onTouchStart={(e) => (touchStartX.current = e.changedTouches[0].screenX)}
      onTouchEnd={(e) => {
        const diff = touchStartX.current - e.changedTouches[0].screenX;
        if (diff >  50 && idx < images.length - 1) setIdx((i) => i + 1);
        if (diff < -50 && idx > 0)                 setIdx((i) => i - 1);
      }}
    >
      <button className="lb-close" onClick={onClose} aria-label="Close">✕</button>

      {idx > 0 && (
        <button
          className="lb-nav lb-prev"
          onClick={(e) => { e.stopPropagation(); setIdx((i) => i - 1); }}
          aria-label="Previous"
        >‹</button>
      )}

      <div className="lb-content" onClick={(e) => e.stopPropagation()}>
        <img src={item.src} alt={item.title || item.caption} className="lb-img" />
        {(item.title || item.caption) && (
          <div className="lb-caption">
            {item.title   && <strong>{item.title}</strong>}
            {item.caption && <span>{item.caption}</span>}
          </div>
        )}
        <p className="lb-counter">{idx + 1} / {images.length}</p>
      </div>

      {idx < images.length - 1 && (
        <button
          className="lb-nav lb-next"
          onClick={(e) => { e.stopPropagation(); setIdx((i) => i + 1); }}
          aria-label="Next"
        >›</button>
      )}
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}

// ─── CAROUSEL ─────────────────────────────────────────────────────────────────
function Carousel({ id, title, items, srcKey = "src", titleKey = "title", captionKey = "caption" }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const trackRef   = useRef(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const didDrag    = useRef(false);

  const onMouseDown = (e) => {
    isDragging.current   = true;
    didDrag.current      = false;
    dragStartX.current   = e.pageX - trackRef.current.offsetLeft;
    dragScrollLeft.current = trackRef.current.scrollLeft;
    trackRef.current.style.cursor = "grabbing";
  };

  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x    = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - dragStartX.current) * 1.2;
    if (Math.abs(walk) > 5) didDrag.current = true;
    trackRef.current.scrollLeft = dragScrollLeft.current - walk;
  };

  const stopDrag = () => {
    isDragging.current = false;
    if (trackRef.current) trackRef.current.style.cursor = "grab";
  };

  const handleCardClick = (i) => {
    if (!didDrag.current) setLightboxIndex(i);
  };

  return (
    <section className="rp-section" id={id}>
      <SectionHeading>{title}</SectionHeading>

      <div
        className="carousel-track"
        ref={trackRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        {items.map((item, i) => {
          const norm = normaliseItem(item, srcKey, titleKey, captionKey);
          return (
            <div
              key={item._id || i}
              className="carousel-card"
              onClick={() => handleCardClick(i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setLightboxIndex(i)}
              aria-label={norm.title || norm.caption || `Image ${i + 1}`}
            >
              <div className="carousel-img-wrap">
                <img
                  src={thumb(norm.src)}
                  alt={norm.title || norm.caption}
                  loading="lazy"
                  draggable="false"
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.parentElement.classList.add("img-error");
                  }}
                />
                <div className="carousel-overlay">
                  <span className="zoom-icon">⊕</span>
                </div>
              </div>
              {(norm.title || norm.caption) && (
                <div className="carousel-caption">
                  {norm.title   && <strong>{norm.title}</strong>}
                  {norm.caption && <span>{norm.caption}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={items}
          startIndex={lightboxIndex}
          srcKey={srcKey}
          titleKey={titleKey}
          captionKey={captionKey}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}

// ─── SECTION HEADING ──────────────────────────────────────────────────────────
function SectionHeading({ children }) {
  return (
    <div className="section-heading">
      <h2>{children}</h2>
      <div className="heading-rule" />
    </div>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────
export default function ResearchPortfolio() {
  const [pubFilter, setPubFilter] = useState("all");
  const [theme,     setTheme]     = useState("light");
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [data,      setData]      = useState(null);
  const [error,     setError]     = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Load all content from the API (MongoDB)
  useEffect(() => {
    getPortfolio().then(setData).catch(() => setError(true));
  }, []);

  // Early returns MUST stay below all hooks
  if (error) return <p style={{ padding: 40 }}>Couldn't load content. Please refresh.</p>;
  if (!data) return <p style={{ padding: 40 }}>Loading…</p>;

  const {
    publications = [],
    experience   = [],
    education    = [],
    awards       = [],
    certificates = [],
    gallery      = [],
    interests    = [],
    links        = [],
  } = data;
  const profile = data.profile || {};
  const name = profile.name || "Chandramouli Haldar";

  const filteredPubs =
    pubFilter === "all"
      ? publications
      : publications.filter((p) => p.type === pubFilter);

  const pubTypes = ["all", "Conference Paper", "Journal Article", "Book", "Patent"];

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const navLinks = [
    { id: "about",        label: "About"        },
    { id: "experience",   label: "Experience"   },
    { id: "education",    label: "Education"    },
    { id: "interests",    label: "Research"     },
    { id: "publications", label: "Publications" },
    { id: "awards",       label: "Awards"       },
    { id: "certificates", label: "Certificates" },
    { id: "gallery",      label: "Gallery"      },
  ];

  return (
    <>
      {/* ══════════════════════════════════ HEADER ══ */}
      <header className="rp-header">
        <div className="header-inner">

          <div className="header-brand" onClick={() => scrollTo("about")}>
            <span className="brand-initials">{profile.initials || "CH"}</span>
            <span className="brand-name">{name}</span>
          </div>

          <nav className={`header-nav${menuOpen ? " open" : ""}`}>
            {navLinks.map((l) => (
              <button key={l.id} className="nav-item" onClick={() => scrollTo(l.id)}>
                {l.label}
              </button>
            ))}
          </nav>

          <div className="header-controls">
            <div className="lang-flags">
              <img
                src="https://upload.wikimedia.org/wikipedia/en/4/41/Flag_of_India.svg"
                alt="English" title="English"
                onClick={() => window.location.reload()}
              />
              <img
                src="https://upload.wikimedia.org/wikipedia/en/9/9e/Flag_of_Japan.svg"
                alt="日本語" title="Japanese"
                onClick={() => translatePage("ja")}
              />
            </div>
            <button
              className="theme-toggle"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              title="Toggle theme"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <button
              className="hamburger"
              onClick={() => setMenuOpen((m) => !m)}
              aria-label="Menu"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>

        </div>
      </header>

      {/* ══════════════════════════════════ LAYOUT ══ */}
      <div className="rp-layout">

        {/* ════════════════ SIDEBAR ════ */}
        <aside className="rp-sidebar">

          <div className="profile-photo-wrap">
            <img
              src={profile.photo || "/img/dp.png"}
              alt={name}
              className="profile-photo"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  "https://api.dicebear.com/7.x/initials/svg?seed=CH&backgroundColor=1b2d4f&textColor=ffffff&fontSize=38";
              }}
            />
          </div>

          <h1 className="sidebar-name">{name}</h1>
          <p className="sidebar-title">{profile.title}</p>
          <p className="sidebar-sub">{profile.subtitle}</p>

          <hr className="sidebar-divider" />

          <div className="sidebar-meta">
            <div className="meta-row"><span>📍</span><span>{profile.location}</span></div>
          </div>

          <div className="sidebar-stats">
            {(profile.stats || []).map((st, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className="stat-div" />}
                <div className="stat-item">
                  <span className="stat-val">{st.value}</span>
                  <span className="stat-lbl">{st.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <hr className="sidebar-divider" />

          <nav className="sidebar-links">
            {links.map((l, i) => {
              const external = !l.url.startsWith("mailto:");
              return (
                <a
                  key={l._id || i}
                  href={l.url}
                  className="s-link"
                  {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  <span className={`s-icon${l.style ? ` s-${l.style}` : ""}`}>{l.icon}</span>
                  <span className="s-label">{l.label}</span>
                </a>
              );
            })}
          </nav>

        </aside>

        {/* ════════════════ MAIN ═══════ */}
        <main className="rp-main">

          {/* ABOUT */}
          <section className="rp-section" id="about">
            <SectionHeading>About</SectionHeading>
            <div className="bio-text">
              {(profile.about || []).map((para, i) => (
                <p key={i}>{renderRich(para)}</p>
              ))}
            </div>
          </section>

          {/* EXPERIENCE */}
          <section className="rp-section" id="experience">
            <SectionHeading>Professional Experience</SectionHeading>
            <div className="timeline">
              {experience.map((exp, i) => (
                <div key={exp._id || i} className="tl-item">
                  <div className="tl-marker">
                    <div className="tl-dot" />
                    {i < experience.length - 1 && <div className="tl-line" />}
                  </div>
                  <div className="tl-body">
                    <div className="tl-top">
                      <div>
                        <h3 className="tl-role">{exp.role}</h3>
                        <p className="tl-org">{exp.organization}</p>
                      </div>
                      <span className="tl-year">{exp.year}</span>
                    </div>
                    <p className="tl-desc">{exp.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* EDUCATION */}
          <section className="rp-section" id="education">
            <SectionHeading>Education</SectionHeading>
            <div className="edu-list">
              {education.map((edu, i) => (
                <div key={edu._id || i} className="edu-card">
                  <div className="edu-icon">🎓</div>
                  <div className="edu-info">
                    <h3 className="edu-degree">{edu.degree}</h3>
                    <p className="edu-inst">{edu.institution}</p>
                    <div className="edu-pills">
                      <span className="pill pill-yr">{edu.year}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* RESEARCH INTERESTS */}
          <section className="rp-section" id="interests">
            <SectionHeading>Research Interests</SectionHeading>
            <div className="interest-grid">
              {interests.map((r, i) => (
                <div key={r._id || i} className="interest-tag">
                  <span>{r.icon}</span>
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* PUBLICATIONS */}
          <section className="rp-section" id="publications">
            <SectionHeading>Publications</SectionHeading>
            <div className="pub-filters">
              {pubTypes.map((t) => (
                <button
                  key={t}
                  className={`pub-filter${pubFilter === t ? " active" : ""}`}
                  onClick={() => setPubFilter(t)}
                >
                  {t === "all" ? "All Publications" : t}
                </button>
              ))}
            </div>
            <ol className="pub-list">
              {filteredPubs.map((pub, i) => (
                <li key={pub._id || i} className="pub-item">
                  <div className="pub-num">{String(i + 1).padStart(2, "0")}</div>
                  <div className="pub-body">
                    <span className="pub-type-badge">{pub.type}</span>
                    <h3 className="pub-title">{pub.title}</h3>
                    <p className="pub-desc">{pub.description}</p>
                    <div className="pub-foot">
                      <span className="pub-year">{pub.year}</span>
                      {pub.doi && (
                        <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noreferrer" className="pub-link">
                          DOI: {pub.doi}
                        </a>
                      )}
                      {pub.url && (
                        <a href={pub.url} target="_blank" rel="noreferrer" className="pub-link">
                          View Publication →
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* AWARDS — { title, description, src } */}
          <Carousel
            id="awards"
            title="Awards & Recognitions"
            items={awards}
            srcKey="src"
            titleKey="title"
            captionKey="description"
          />

          {/* CERTIFICATES — { title, issuer, src } */}
          <Carousel
            id="certificates"
            title="Certificates"
            items={certificates}
            srcKey="src"
            titleKey="title"
            captionKey="issuer"
          />

          {/* GALLERY — { title, caption, src } */}
          <Carousel
            id="gallery"
            title="Gallery"
            items={gallery}
            srcKey="src"
            titleKey="title"
            captionKey="caption"
          />

          {/* FOOTER */}
          <footer className="rp-footer">
            <p>© {new Date().getFullYear()} {name} &nbsp;·&nbsp; All rights reserved</p>
            <p className="footer-sub">
              {profile.location} &nbsp;|&nbsp; chandramouli@novatech-is.in &nbsp;|&nbsp;
              <a href="https://orcid.org/0009-0004-9759-194X" target="_blank" rel="noreferrer">
                ORCID: 0009-0004-9759-194X
              </a>
            </p>
          </footer>

        </main>
      </div>
    </>
  );
}