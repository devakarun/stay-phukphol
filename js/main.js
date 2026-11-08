/* Stay @Phukphol — ลูกเล่นหน้าเว็บ (เมนู, เอฟเฟกต์, สไลด์, แกลเลอรี) */
(function () {
  const { C, U } = window.SP;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ใส่ข้อมูลจาก config ลงในหน้าเว็บ */
  $$("[data-cfg]").forEach((el) => {
    const v = el.dataset.cfg.split(".").reduce((o, k) => (o ? o[k] : ""), C);
    if (v) el.textContent = v;
  });
  $("#rateList").innerHTML = C.rates.map((r) => `
    <li><span class="rates__name">${U.esc(r.name)}${r.regular > r.price ? ' <span class="promo-tag">โปรโมชัน</span>' : ""}</span>
      <span class="rates__price">${r.regular > r.price ? `<s>${U.money(r.regular)}</s>` : ""}<b>${U.money(r.price)}</b><small>/คืน</small></span></li>`).join("");
  const soc = C.socials || [];
  $("#socialLinks").innerHTML = soc.map((x) =>
    `<a class="social" href="${U.esc(x.url)}" target="_blank" rel="noopener"><b>${U.esc(x.type)}</b>${U.esc(x.name)}</a>`).join("");
  $("#footSocial").innerHTML = soc.map((x) =>
    `<a href="${U.esc(x.url)}" target="_blank" rel="noopener">${U.esc(x.type)} · ${U.esc(x.name)}</a>`).join("");
  $("#houseNames").innerHTML = C.houses.map((h) => `<span>${U.esc(h.name)}</span>`).join("");
  $("#cPhone").href = "tel:" + C.contact.phone.replace(/[^0-9+]/g, "");
  $("#cLine").href = "https://line.me/R/ti/p/" + encodeURIComponent(C.contact.line);
  $("#cMap").href = C.mapLink;
  $("#mapFrame").src = C.mapEmbedUrl;
  $("#year").textContent = new Date().getFullYear();

  /* ---------- TikTok: สตอรี่ + คลิปล่าสุดของช่อง ---------- */
  (function tiktok() {
    const T = C.tiktok || {};
    const accs = (T.accounts || (T.user ? [{ user: T.user, label: "" }] : []))
      .map((x) => ({ user: String(x.user || "").replace(/^@/, "").replace(/[^\w.]/g, ""), label: x.label || "" })).filter((x) => x.user);
    const sec = $("#tiktok");
    if (!accs.length) { sec.hidden = true; return; }
    const user = accs[0].user, link = (u) => "https://www.tiktok.com/@" + u;
    const vids = (T.videos || []).filter((u) => /^https:\/\/(www\.|vm\.|vt\.)?tiktok\.com\//.test(u));
    if (vids.length) {
      $("#ttStories").hidden = false;
      const track = $("#ttTrack");
      track.innerHTML = vids.map((u, i) => `
        <a class="story" href="${U.esc(u)}" target="_blank" rel="noopener" data-i="${i}">
          <span class="story__img"></span>
          <span class="story__ring"><img src="images/favicon.png" alt="" /></span>
          <span class="story__play">▶</span>
          <span class="story__cap">@${U.esc((u.match(/@([\w.]+)/) || [, user])[1])}</span>
        </a>`).join("");
      vids.forEach((u, i) => {
        fetch("https://www.tiktok.com/oembed?url=" + encodeURIComponent(u))
          .then((r) => r.json()).then((d) => {
            const a = $(`.story[data-i="${i}"]`, track);
            if (d.thumbnail_url) $(".story__img", a).style.backgroundImage = `url("${d.thumbnail_url.replace(/"/g, "")}")`;
            if (d.title) $(".story__cap", a).textContent = d.title;
          }).catch(() => {});
      });
      $("#ttMore").onclick = () => track.scrollBy({ left: track.clientWidth * 0.8, behavior: "smooth" });
    }
    /* คลิปล่าสุดของช่อง (ตัวฝังทางการของ TikTok อัปเดตอัตโนมัติ) โหลดเมื่อเลื่อนมาถึง */
    const load = () => {
      $("#ttFeed").innerHTML = accs.map((x) => `
        <div class="ttacc">
          <a class="ttacc__head" href="${link(x.user)}" target="_blank" rel="noopener">
            <span class="ttacc__name">${U.esc(x.label || "@" + x.user)}</span><span class="ttacc__at">@${x.user} · ดูทั้งหมด →</span></a>
          <blockquote class="tiktok-embed" cite="${link(x.user)}" data-unique-id="${x.user}" data-embed-type="creator" style="max-width:780px;min-width:288px;margin:0"><section><a target="_blank" rel="noopener" href="${link(x.user)}?refer=creator_embed">@${x.user}</a></section></blockquote>
        </div>`).join("");
      const sc = document.createElement("script"); sc.async = true; sc.src = "https://www.tiktok.com/embed.js";
      document.body.appendChild(sc);
    };
    const tio = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { tio.disconnect(); load(); } }, { rootMargin: "400px" });
    tio.observe(sec);
  })();

  /* แถบจองติดล่างจอบนมือถือ: ซ่อนเมื่ออยู่หน้าแรกหรือส่วนจองอยู่บนจอ */
  $("#mbarPrice").textContent = U.money(Math.min(...C.rates.map((r) => r.price)));
  const mbar = $("#mbar"), vis = new Map();
  const mio = new IntersectionObserver((es) => {
    es.forEach((e) => vis.set(e.target.id, e.isIntersecting));
    mbar.classList.toggle("is-hidden", !!(vis.get("top") || vis.get("booking")));
  }, { threshold: 0.12 });
  ["top", "booking"].forEach((id) => mio.observe($("#" + id)));

  /* เมนูเปลี่ยนสีเมื่อเลื่อน + parallax */
  const nav = $("#nav"), heroBg = $(".hero__bg");
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 60);
    if (y < innerHeight) heroBg.style.transform = `translateY(${y * 0.3}px) scale(1.06)`;
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  $("#burger").addEventListener("click", () => nav.classList.toggle("is-open"));
  $$("#navLinks a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("is-open")));

  /* เอฟเฟกต์ค่อย ๆ ปรากฏ + ตัวเลขวิ่ง */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      $$("[data-count]", e.target).forEach((b) => {
        const to = +b.dataset.count; let n = 0;
        const t = setInterval(() => { b.textContent = ++n; if (n >= to) clearInterval(t); }, 160);
      });
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });
  $$(".reveal").forEach((el, i) => { el.style.transitionDelay = (i % 4) * 80 + "ms"; io.observe(el); });

  /* สไลด์รูปบ้านพัก */
  const slides = $$("#houseSlides img"), dots = $(".house-card__dots");
  let cur = 0;
  slides.forEach((_, i) => {
    const b = document.createElement("button");
    b.setAttribute("aria-label", "รูปที่ " + (i + 1));
    b.onclick = () => go(i); dots.appendChild(b);
  });
  function go(i) {
    cur = (i + slides.length) % slides.length;
    slides.forEach((s, j) => s.classList.toggle("is-active", j === cur));
    $$("button", dots).forEach((d, j) => d.classList.toggle("is-active", j === cur));
  }
  go(0);
  let timer = setInterval(() => go(cur + 1), 4500);
  const step = (d) => { go(cur + d); clearInterval(timer); timer = setInterval(() => go(cur + 1), 6000); };
  $(".house-card__nav--prev").onclick = () => step(-1);
  $(".house-card__nav--next").onclick = () => step(1);
  const box = $("#houseSlides"); let sx = null;
  box.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
  box.addEventListener("touchend", (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); sx = null; });

  /* Lightbox แกลเลอรี */
  const lb = $("#lightbox");
  $$(".g").forEach((f) => f.addEventListener("click", () => {
    $("img", lb).src = $("img", f).src; lb.classList.add("is-open");
  }));
  lb.addEventListener("click", () => lb.classList.remove("is-open"));
  addEventListener("keydown", (e) => { if (e.key === "Escape") lb.classList.remove("is-open"); });
})();
