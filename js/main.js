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
  go(0); setInterval(() => go(cur + 1), 4500);

  /* Lightbox แกลเลอรี */
  const lb = $("#lightbox");
  $$(".g").forEach((f) => f.addEventListener("click", () => {
    $("img", lb).src = $("img", f).src; lb.classList.add("is-open");
  }));
  lb.addEventListener("click", () => lb.classList.remove("is-open"));
  addEventListener("keydown", (e) => { if (e.key === "Escape") lb.classList.remove("is-open"); });
})();
