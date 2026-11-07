/* Stay @Phukphol — Dashboard หลังบ้าน */
(function () {
  const { C, U, DB } = window.SP;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TOTAL = C.houses.length;
  const ST = { pending: "รอยืนยัน", confirmed: "ยืนยันแล้ว", cancelled: "ยกเลิก" };
  const tag = (s) => `<span class="tag tag--${s}">${ST[s] || s}</span>`;
  const short = (k) => U.thDate(k, { day: "numeric", month: "short" });

  let ALL = [], known = null, unsub = null, view = "overview";
  let calMonth = new Date(), calMode = "month", saleMonth = new Date(), filter = "all";
  let chartY, chartH;

  /* ================= เข้าสู่ระบบ ================= */
  if (DB.mode === "demo") { $("#demoTip").hidden = false; $("#demoTools").hidden = false; }
  $("#modeTag").textContent = DB.mode === "demo" ? "🧪 โหมดทดลอง" : "🟢 เชื่อมต่อ Firebase";

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; $("#loginErr").textContent = "";
    try { await DB.signIn(f.email.value.trim(), f.password.value); }
    catch (ex) { $("#loginErr").textContent = "อีเมลหรือรหัสผ่านไม่ถูกต้อง"; }
  });
  $("#btnLogout").onclick = () => DB.signOut();

  DB.onAuth((user) => {
    const allowed = user && (DB.mode === "demo" ||
      C.adminEmails.map((x) => x.toLowerCase()).includes((user.email || "").toLowerCase()));
    if (user && !allowed) { $("#loginErr").textContent = "บัญชีนี้ไม่มีสิทธิ์เข้าระบบหลังบ้าน"; DB.signOut(); return; }
    $("#login").hidden = !!allowed; $("#app").hidden = !allowed;
    if (allowed) {
      $("#userEmail").textContent = user.email;
      if (!unsub) unsub = DB.subscribeBookings(onData, (err) => toast("โหลดข้อมูลไม่สำเร็จ", err.message));
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } else if (unsub) { unsub(); unsub = null; known = null; }
  });

  /* ================= รับข้อมูล + แจ้งเตือน ================= */
  function onData(list) {
    ALL = list;
    if (known) {
      const fresh = list.filter((b) => !known.has(b.id));
      fresh.forEach(notifyNew);
    }
    known = new Set(list.map((b) => b.id));
    renderAll();
  }

  function notifyNew(b) {
    const text = `${b.name} · ${short(b.checkIn)}–${short(b.checkOut)} · ${b.rooms.length} หลัง · ${U.money(b.total)}`;
    toast("🔔 มีการจองใหม่ " + b.code, text, () => openBooking(b.id));
    chime();
    $("#bell").classList.remove("ring"); void $("#bell").offsetWidth; $("#bell").classList.add("ring");
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification("มีการจองใหม่ · Stay @Phukphol", { body: text, icon: "images/favicon.png" }); } catch (e) {}
    }
    flashTitle();
  }
  function chime() {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880].forEach((f, i) => {
        const o = a.createOscillator(), g = a.createGain();
        o.frequency.value = f; o.connect(g); g.connect(a.destination);
        g.gain.setValueAtTime(.0001, a.currentTime + i * .18);
        g.gain.exponentialRampToValueAtTime(.2, a.currentTime + i * .18 + .02);
        g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + i * .18 + .5);
        o.start(a.currentTime + i * .18); o.stop(a.currentTime + i * .18 + .55);
      });
    } catch (e) {}
  }
  let titleTimer;
  function flashTitle() {
    const base = "Dashboard · Stay @Phukphol"; let on = false; clearInterval(titleTimer);
    titleTimer = setInterval(() => { document.title = (on = !on) ? "🔔 จองใหม่!" : base; }, 900);
    const stop = () => { clearInterval(titleTimer); document.title = base; removeEventListener("focus", stop); };
    addEventListener("focus", stop);
  }
  function toast(title, body, onClick) {
    const t = document.createElement("div"); t.className = "toast";
    t.innerHTML = `<b>${U.esc(title)}</b>${U.esc(body || "")}`;
    t.onclick = () => { onClick && onClick(); t.remove(); };
    $("#toasts").appendChild(t); setTimeout(() => t.remove(), 9000);
  }

  /* ================= คำนวณ ================= */
  const active = () => ALL.filter((b) => b.status !== "cancelled");
  function onNight(k) { return active().filter((b) => b.checkIn <= k && k < b.checkOut); }
  function roomsOn(k) { const m = {}; onNight(k).forEach((b) => b.rooms.forEach((r) => (m[r] = b))); return m; }
  function freeOn(k) { return TOTAL - Object.keys(roomsOn(k)).length; }
  function lv(free) { return free === TOTAL ? 0 : free > 0 ? 1 : 2; }
  // รายได้ต่อเดือน (กระจายตามคืน) เฉพาะที่ยืนยันแล้ว
  function revenueByMonth(year) {
    const m = Array(12).fill(0), byHouse = {};
    ALL.filter((b) => b.status === "confirmed").forEach((b) => {
      const per = b.total / b.nights;
      U.nightsBetween(b.checkIn, b.checkOut).forEach((k) => {
        const d = U.fromKey(k); if (d.getFullYear() !== year) return;
        m[d.getMonth()] += per;
        const mk = d.getMonth();
        b.rooms.forEach((r) => { byHouse[mk] = byHouse[mk] || {}; byHouse[mk][r] = (byHouse[mk][r] || 0) + per / b.rooms.length; });
      });
    });
    return { months: m, byHouse };
  }

  /* ================= สลับหน้า ================= */
  const titles = { overview: "ภาพรวม", calendar: "ปฏิทินการจอง", bookings: "รายการจอง", sales: "สรุปยอดขาย" };
  function show(v) {
    view = v;
    $$(".side__nav button").forEach((b) => b.classList.toggle("is-active", b.dataset.view === v));
    $$(".view").forEach((s) => s.classList.toggle("is-active", s.dataset.view === v));
    $("#viewTitle").textContent = titles[v]; $("#side").classList.remove("is-open");
    renderAll();
  }
  $$(".side__nav button").forEach((b) => (b.onclick = () => show(b.dataset.view)));
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) show(g.dataset.goto); });
  $("#menuBtn").onclick = () => $("#side").classList.toggle("is-open");
  $("#todayText").textContent = new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  function renderAll() {
    const pend = ALL.filter((b) => b.status === "pending");
    $("#pendingPill").hidden = !pend.length; $("#pendingPill").textContent = pend.length;
    $("#bellCount").hidden = !pend.length; $("#bellCount").textContent = pend.length;
    $("#bellPanel").innerHTML = pend.length
      ? pend.map((b) => `<div class="item" data-id="${b.id}"><b>${U.esc(b.name)} <span class="code">${b.code}</span></b><span class="muted">${short(b.checkIn)}–${short(b.checkOut)} · ${U.money(b.total)}</span></div>`).join("")
      : `<p class="empty">ไม่มีการจองที่รอยืนยัน 🎉</p>`;
    if (view === "overview") renderOverview();
    if (view === "calendar") renderCalendar();
    if (view === "bookings") renderTable();
    if (view === "sales") renderSales();
  }
  $("#bell").onclick = (e) => { e.stopPropagation(); $("#bellPanel").classList.toggle("is-open"); };
  $("#bellPanel").onclick = (e) => { const i = e.target.closest(".item"); if (i) { openBooking(i.dataset.id); $("#bellPanel").classList.remove("is-open"); } };
  document.addEventListener("click", () => $("#bellPanel").classList.remove("is-open"));

  /* ================= ภาพรวม ================= */
  function renderOverview() {
    const t = U.today(), now = new Date();
    const ym = t.slice(0, 7);
    const rev = revenueByMonth(now.getFullYear()).months[now.getMonth()];
    const pend = ALL.filter((b) => b.status === "pending").length;
    const ci = active().filter((b) => b.checkIn === t).length;
    const free = freeOn(t);
    const monthCount = ALL.filter((b) => b.status !== "cancelled" && (b.createdAt && new Date(b.createdAt).toISOString().slice(0, 7) === ym)).length;
    $("#kpis").innerHTML = `
      <div class="kpi kpi--hl"><span>รอยืนยัน</span><b>${pend}</b><small>การจองใหม่ที่ต้องตอบกลับ</small></div>
      <div class="kpi"><span>บ้านว่างคืนนี้</span><b>${free}/${TOTAL}</b><small>เข้าพัก ${TOTAL - free} หลัง</small></div>
      <div class="kpi"><span>เช็กอินวันนี้</span><b>${ci}</b><small>การจอง</small></div>
      <div class="kpi"><span>รายได้เดือนนี้</span><b>${U.money(Math.round(rev))}</b><small>จองใหม่เดือนนี้ ${monthCount} รายการ</small></div>`;

    $("#tonightText").textContent = U.thDate(t, { weekday: "short", day: "numeric", month: "short" });
    const rm = roomsOn(t);
    $("#tonight").innerHTML = C.houses.map((h) => {
      const b = rm[h.id];
      if (!b) return `<div class="house"><b>${U.esc(h.name)}</b>ว่าง<br><span class="st">พร้อมขาย</span></div>`;
      return `<div class="house busy ${b.status === "pending" ? "pending" : ""}" data-id="${b.id}"><b>${U.esc(h.name)}</b>${U.esc(b.name.split(" ")[0])}<br><span class="st">ออก ${short(b.checkOut)}</span></div>`;
    }).join("");

    const week = U.addDays(t, 7);
    const up = active().filter((b) => b.checkIn >= t && b.checkIn < week).sort((a, z) => a.checkIn.localeCompare(z.checkIn));
    $("#upcoming").innerHTML = up.length ? up.map((b) => {
      const d = U.fromKey(b.checkIn);
      return `<li data-id="${b.id}"><div class="d"><b>${d.getDate()}</b><small>${d.toLocaleDateString("th-TH", { month: "short" })}</small></div>
        <div class="x"><div><b>${U.esc(b.name)}</b> · ${b.nights} คืน</div><div class="muted small">${b.rooms.map(U.houseName).join(", ")} · ${b.adults + b.children} ท่าน${b.requests.length ? " · " + U.esc(b.requests.join(", ")) : ""}</div></div>${tag(b.status)}</li>`;
    }).join("") : `<p class="empty">ไม่มีเช็กอินในสัปดาห์นี้</p>`;

    $("#strip").innerHTML = Array.from({ length: 14 }, (_, i) => {
      const k = U.addDays(t, i), f = freeOn(k), d = U.fromKey(k);
      return `<div class="lvl${lv(f)}" data-day="${k}">${d.toLocaleDateString("th-TH", { weekday: "short" })}<b>${f}</b>${d.getDate()}</div>`;
    }).join("");

    $("#latestTable").innerHTML = tableHTML(ALL.slice(0, 6));
  }

  /* ================= ตาราง ================= */
  function tableHTML(rows) {
    if (!rows.length) return `<tr><td class="empty">ยังไม่มีการจอง</td></tr>`;
    return `<thead><tr><th>รหัส</th><th>ลูกค้า</th><th>เข้าพัก</th><th>บ้าน</th><th>ผู้เข้าพัก</th><th>ยอด</th><th>สถานะ</th><th>จองเมื่อ</th></tr></thead><tbody>` +
      rows.map((b) => `<tr class="row ${Date.now() - b.createdAt < 8000 ? "new" : ""}" data-id="${b.id}">
        <td class="code">${b.code}</td><td><b>${U.esc(b.name)}</b><br><span class="muted small">${U.esc(b.phone)}</span></td>
        <td>${short(b.checkIn)} – ${short(b.checkOut)}<br><span class="muted small">${b.nights} คืน</span></td>
        <td>${b.rooms.map(U.houseName).join("<br>")}</td><td>${b.adults} / ${b.children}${b.extraBeds ? " +เตียง" : ""}</td>
        <td><b>${U.money(b.total)}</b></td><td>${tag(b.status)}</td>
        <td class="muted small">${new Date(b.createdAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td></tr>`).join("") + "</tbody>";
  }
  function filtered() {
    const q = $("#q").value.trim().toLowerCase();
    return ALL.filter((b) => (filter === "all" || b.status === filter) &&
      (!q || [b.code, b.name, b.phone, b.email].join(" ").toLowerCase().includes(q)));
  }
  function renderTable() { $("#allTable").innerHTML = tableHTML(filtered()); }
  $("#q").addEventListener("input", renderTable);
  $$("#statusFilter button").forEach((b) => (b.onclick = () => {
    filter = b.dataset.s; $$("#statusFilter button").forEach((x) => x.classList.toggle("is-active", x === b)); renderTable();
  }));
  $("#btnCsv").onclick = () => {
    const head = ["รหัส", "ชื่อ", "โทร", "อีเมล", "เช็กอิน", "เช็กเอาต์", "คืน", "ผู้ใหญ่", "เด็ก", "บ้าน", "คำขอ", "หมายเหตุ", "ยอด", "สถานะ"];
    const rows = filtered().map((b) => [b.code, b.name, b.phone, b.email, b.checkIn, b.checkOut, b.nights, b.adults, b.children,
      b.rooms.map(U.houseName).join(" / "), b.requests.join(" / "), b.note, b.total, ST[b.status]]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "bookings-" + U.today() + ".csv"; a.click();
  };

  /* ================= ปฏิทิน ================= */
  function renderCalendar() {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    $("#calTitle").textContent = calMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    if (calMode === "timeline") return renderTimeline(y, m);
    const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay()), t = U.today();
    let html = `<div class="cal">` + ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => `<div class="cal__dow">${d}</div>`).join("");
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = U.toKey(d), bs = onNight(k), f = TOTAL - new Set(bs.flatMap((b) => b.rooms)).size;
      html += `<div class="day ${d.getMonth() !== m ? "out" : ""} ${k === t ? "today" : ""}" data-day="${k}">
        <div class="day__n">${d.getDate()}<small class="lv${lv(f)}">ว่าง ${f}</small></div>
        <div class="bar"><i style="width:${((TOTAL - f) / TOTAL) * 100}%"></i></div>
        <div class="chips">${bs.slice(0, 3).map((b) => `<span class="${b.status === "pending" ? "p" : ""}">${U.esc(b.name.split(" ")[0])}</span>`).join("")}${bs.length > 3 ? `<span>+${bs.length - 3}</span>` : ""}</div></div>`;
      if (i === 34 && new Date(start.getTime() + 35 * 864e5).getMonth() !== m) break;
    }
    $("#calBody").innerHTML = html + "</div>";
  }
  function renderTimeline(y, m) {
    const days = new Date(y, m + 1, 0).getDate(), cols = `110px repeat(${days}, minmax(30px,1fr))`;
    const mStart = U.toKey(new Date(y, m, 1)), mEnd = U.toKey(new Date(y, m + 1, 1));
    let html = `<div class="tl" style="min-width:${110 + days * 32}px"><div class="tl__row" style="grid-template-columns:${cols}"><div></div>`;
    for (let d = 1; d <= days; d++) { const w = new Date(y, m, d).getDay(); html += `<div class="tl__h ${w === 5 || w === 6 ? "we" : ""}">${d}</div>`; }
    html += `</div>`;
    C.houses.forEach((h) => {
      html += `<div class="tl__row" style="grid-template-columns:${cols}"><div class="tl__name">${U.esc(h.name)}</div>`;
      for (let d = 1; d <= days; d++) html += `<div class="tl__cell" style="grid-column:${d + 1};grid-row:1" data-day="${U.toKey(new Date(y, m, d))}"></div>`;
      active().filter((b) => b.rooms.includes(h.id) && b.checkIn < mEnd && b.checkOut > mStart).forEach((b) => {
        const s = b.checkIn < mStart ? 1 : U.fromKey(b.checkIn).getDate();
        const e = b.checkOut > mEnd ? days + 1 : U.fromKey(b.checkOut).getDate();
        html += `<div class="tl__bk ${b.status === "pending" ? "p" : ""}" data-id="${b.id}" style="grid-column:${s + 1}/${e + 1};grid-row:1" title="${U.esc(b.name)}">${U.esc(b.name)}</div>`;
      });
      html += `</div>`;
    });
    $("#calBody").innerHTML = `<div class="table-wrap">${html}</div></div>`;
  }
  $("#calPrev").onclick = () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); };
  $("#calNext").onclick = () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); };
  $("#calToday").onclick = () => { calMonth = new Date(); renderCalendar(); };
  $$("#calMode button").forEach((b) => (b.onclick = () => {
    calMode = b.dataset.m; $$("#calMode button").forEach((x) => x.classList.toggle("is-active", x === b)); renderCalendar();
  }));

  /* ================= ยอดขาย ================= */
  function renderSales() {
    const y = saleMonth.getFullYear(), m = saleMonth.getMonth();
    $("#saleTitle").textContent = saleMonth.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    $("#yearText").textContent = "ปี " + (y + 543);
    const { months, byHouse } = revenueByMonth(y);
    const days = new Date(y, m + 1, 0).getDate();
    let sold = 0, pendingRev = 0;
    for (let d = 1; d <= days; d++) {
      const k = U.toKey(new Date(y, m, d));
      ALL.forEach((b) => {
        if (b.checkIn <= k && k < b.checkOut) {
          if (b.status === "confirmed") sold += b.rooms.length;
          if (b.status === "pending") pendingRev += b.total / b.nights;
        }
      });
    }
    const rev = months[m], occ = (sold / (days * TOTAL)) * 100, adr = sold ? rev / sold : 0;
    const prev = m ? months[m - 1] : null, diff = prev ? ((rev - prev) / prev) * 100 : null;
    $("#saleKpis").innerHTML = `
      <div class="kpi kpi--hl"><span>รายได้ (ยืนยันแล้ว)</span><b>${U.money(Math.round(rev))}</b><small>${diff == null ? "&nbsp;" : (diff >= 0 ? "▲ " : "▼ ") + Math.abs(diff).toFixed(0) + "% จากเดือนก่อน"}</small></div>
      <div class="kpi"><span>รอยืนยัน (คาดการณ์)</span><b>${U.money(Math.round(pendingRev))}</b><small>ยังไม่นับในรายได้</small></div>
      <div class="kpi"><span>อัตราการเข้าพัก</span><b>${occ.toFixed(0)}%</b><small>${sold} จาก ${days * TOTAL} หลัง-คืน</small></div>
      <div class="kpi"><span>ราคาเฉลี่ย / หลัง / คืน</span><b>${U.money(Math.round(adr))}</b><small>ADR</small></div>`;

    if (typeof Chart === "undefined") return;
    const css = getComputedStyle(document.documentElement), forest = css.getPropertyValue("--forest").trim(), wheat = css.getPropertyValue("--wheat").trim();
    const labels = Array.from({ length: 12 }, (_, i) => new Date(y, i, 1).toLocaleDateString("th-TH", { month: "short" }));
    const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => U.money(Math.round(c.raw)) } } },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => "฿" + Number(v).toLocaleString() }, grid: { color: "rgba(46,74,44,.08)" } }, x: { grid: { display: false } } } };
    chartY && chartY.destroy();
    chartY = new Chart($("#chartYear"), { type: "bar", data: { labels, datasets: [{ data: months, backgroundColor: months.map((_, i) => (i === m ? forest : wheat)), borderRadius: 8 }] }, options: opts });
    const hm = byHouse[m] || {};
    chartH && chartH.destroy();
    chartH = new Chart($("#chartHouse"), { type: "bar", data: { labels: C.houses.map((h) => h.name), datasets: [{ data: C.houses.map((h) => hm[h.id] || 0), backgroundColor: forest, borderRadius: 8 }] },
      options: Object.assign({}, opts, { indexAxis: "y", scales: { x: opts.scales.y, y: { grid: { display: false } } } }) });
  }
  $("#salePrev").onclick = () => { saleMonth = new Date(saleMonth.getFullYear(), saleMonth.getMonth() - 1, 1); renderSales(); };
  $("#saleNext").onclick = () => { saleMonth = new Date(saleMonth.getFullYear(), saleMonth.getMonth() + 1, 1); renderSales(); };

  /* ================= Modal ================= */
  const modal = $("#modal");
  function openModal(html) { $("#modalBody").innerHTML = html; modal.classList.add("is-open"); }
  function closeModal() { modal.classList.remove("is-open"); }
  modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", (e) => e.key === "Escape" && closeModal());

  // คลิกที่ใดก็ได้ที่มี data-id / data-day
  document.addEventListener("click", (e) => {
    if (e.target.closest("#bellPanel, .modal__box .actions")) return;
    const r = e.target.closest("[data-id]"); if (r && !r.closest("#bellPanel")) return openBooking(r.dataset.id);
    const d = e.target.closest("[data-day]"); if (d) openDay(d.dataset.day);
  });

  function openBooking(id) {
    const b = ALL.find((x) => x.id === id); if (!b) return;
    const tel = b.phone.replace(/[^0-9+]/g, "");
    openModal(`
      <div class="mh"><h2>${U.esc(b.name)}</h2>${tag(b.status)}</div>
      <p class="code">${b.code}</p>
      <dl class="dl">
        <dt>เช็กอิน</dt><dd>${U.thDate(b.checkIn, { weekday: "short", day: "numeric", month: "long", year: "numeric" })} · มาถึงประมาณ ${U.esc(b.arrivalTime || "-")}</dd>
        <dt>เช็กเอาต์</dt><dd>${U.thDate(b.checkOut, { weekday: "short", day: "numeric", month: "long", year: "numeric" })} (${b.nights} คืน)</dd>
        <dt>บ้านพัก</dt><dd>${b.rooms.map(U.houseName).join(", ")}</dd>
        <dt>ผู้เข้าพัก</dt><dd>ผู้ใหญ่ ${b.adults} · เด็ก ${b.children}</dd>
        <dt>คำขอเพิ่มเติม</dt><dd>${U.esc(b.requests.join(", ") || "-")}</dd>
        <dt>ข้อความ</dt><dd>${U.esc(b.note || "-")}</dd>
        <dt>โทร</dt><dd><a href="tel:${tel}">${U.esc(b.phone)}</a></dd>
        <dt>อีเมล</dt><dd><a href="mailto:${U.esc(b.email)}">${U.esc(b.email)}</a></dd>
        <dt>ยอดรวม</dt><dd><b style="font-size:1.3rem;color:var(--forest)">${U.money(b.total)}</b></dd>
        <dt>จองเมื่อ</dt><dd>${new Date(b.createdAt).toLocaleString("th-TH")}</dd>
      </dl>
      <div class="actions">
        ${b.status !== "confirmed" && b.status !== "cancelled" ? `<button class="btn btn--ok btn--sm" data-act="confirmed">✓ ยืนยันการจอง</button>` : ""}
        ${b.status !== "cancelled" ? `<button class="btn btn--bad btn--sm" data-act="cancelled">ยกเลิก (คืนห้องว่าง)</button>` : ""}
        <a class="btn btn--ghost btn--sm" href="tel:${tel}">📞 โทร</a>
        <a class="btn btn--ghost btn--sm" href="mailto:${U.esc(b.email)}?subject=${encodeURIComponent("ยืนยันการจอง " + b.code + " · Stay @Phukphol")}">✉️ อีเมล</a>
        <button class="btn btn--ghost btn--sm" data-act="delete" style="margin-left:auto">ลบ</button>
      </div>`);
    $$("[data-act]", modal).forEach((btn) => (btn.onclick = async () => {
      const a = btn.dataset.act;
      if (a === "cancelled" && !confirm("ยืนยันยกเลิกการจองนี้? บ้านจะกลับมาว่างให้จองได้")) return;
      if (a === "delete" && !confirm("ลบการจองนี้ถาวร?")) return;
      btn.disabled = true;
      try {
        if (a === "delete") { await DB.remove(b.id); closeModal(); }
        else { await DB.setStatus(b.id, a); openBooking(b.id); }
        toast("บันทึกแล้ว", b.code);
      } catch (ex) { toast("ทำรายการไม่สำเร็จ", ex.message); btn.disabled = false; }
    }));
  }

  function openDay(k) {
    const rm = roomsOn(k), bs = onNight(k), arr = active().filter((b) => b.checkIn === k), dep = active().filter((b) => b.checkOut === k);
    openModal(`
      <h2>${U.thDate(k, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>
      <p class="muted">ว่าง ${TOTAL - Object.keys(rm).length} จาก ${TOTAL} หลัง · เช็กอิน ${arr.length} · เช็กเอาต์ ${dep.length}</p>
      <div class="houses" style="margin:16px 0">${C.houses.map((h) => {
        const b = rm[h.id];
        return b ? `<div class="house busy ${b.status === "pending" ? "pending" : ""}" data-id="${b.id}"><b>${U.esc(h.name)}</b>${U.esc(b.name)}<br><span class="st">${ST[b.status]}</span></div>`
          : `<div class="house"><b>${U.esc(h.name)}</b>ว่าง</div>`;
      }).join("")}</div>
      ${bs.length ? `<ul class="list">${bs.map((b) => `<li data-id="${b.id}"><div class="x"><div><b>${U.esc(b.name)}</b> <span class="code">${b.code}</span></div><div class="muted small">${short(b.checkIn)}–${short(b.checkOut)} · ${b.rooms.map(U.houseName).join(", ")}</div></div>${tag(b.status)}</li>`).join("")}</ul>` : `<p class="empty">ไม่มีผู้เข้าพักคืนนี้</p>`}`);
  }

  /* ================= เครื่องมือโหมดทดลอง ================= */
  if (DB.mode === "demo") {
    $("#btnSeed").onclick = async () => { await DB.seed(); toast("เพิ่มข้อมูลตัวอย่างแล้ว", "ลองเปิดปฏิทินและยอดขายดูได้เลย"); };
    $("#btnClear").onclick = () => { if (confirm("ล้างข้อมูลทดลองทั้งหมด?")) DB.clear(); };
  }
})();
