/* Stay @Phukphol — Dashboard หลังบ้าน */
(function () {
  const { C, U, DB } = window.SP;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TOTAL = C.houses.length;
  const ST = { pending: "รอยืนยัน", confirmed: "ยืนยันแล้ว", cancelled: "ยกเลิก" };
  // สถานะที่แสดง: รวมสถานะการจอง + การชำระเงิน
  function stateOf(b) {
    if (b.status === "confirmed") return ["confirmed", "ยืนยันแล้ว"];
    if (b.status === "cancelled") return ["cancelled", "ยกเลิก"];
    if (b.payment === "slip") return ["slip", "ส่งสลิปแล้ว · รอตรวจ"];
    if (b.payment === "unpaid") return ["pending", "รอชำระเงิน"];
    return ["pending", "รอยืนยัน"];
  }
  const tag = (b) => { const [c, t] = typeof b === "string" ? [b, ST[b] || b] : stateOf(b); return `<span class="tag tag--${c}">${t}</span>`; };
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
  let payState = new Map(), seeding = false;
  function onData(list) {
    ALL = list; DB._last = list;
    if (known && !seeding) {
      const fresh = list.filter((b) => !known.has(b.id));
      if (fresh.length > 3) toast(`🔔 มีการจองใหม่ ${fresh.length} รายการ`, "เปิดดูได้ที่รายการจอง", () => show("bookings"));
      else fresh.forEach(notifyNew);
      list.filter((b) => known.has(b.id) && b.payment === "slip" && payState.get(b.id) !== "slip").forEach(notifySlip);
    }
    known = new Set(list.map((b) => b.id));
    payState = new Map(list.map((b) => [b.id, b.payment]));
    renderAll();
    if (modal.classList.contains("is-open") && openId) openBooking(openId, true);
  }
  function notifySlip(b) {
    const text = `${b.name} · ${b.rooms.map(U.houseName).join(", ")} · ${U.money(b.total)}`;
    toast("💳 ลูกค้าส่งสลิปแล้ว " + b.code, text, () => openBooking(b.id));
    ring(text, "ลูกค้าส่งสลิปแล้ว · Stay @Phukphol");
  }
  function ring(text, title) {
    chime();
    $("#bell").classList.remove("ring"); void $("#bell").offsetWidth; $("#bell").classList.add("ring");
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body: text, icon: "images/favicon.png" }); } catch (e) {}
    }
    flashTitle();
  }

  function notifyNew(b) {
    const text = `${b.name} · ${short(b.checkIn)}–${short(b.checkOut)} · ${b.rooms.map(U.houseName).join(", ")} · ${U.money(b.total)}`;
    toast("🔔 มีการจองใหม่ " + b.code + " (รอชำระเงิน)", text, () => openBooking(b.id));
    ring(text, "มีการจองใหม่ · Stay @Phukphol");
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
    const pend = ALL.filter((b) => b.status === "pending").sort((a, z) => (z.payment === "slip") - (a.payment === "slip"));
    $("#pendingPill").hidden = !pend.length; $("#pendingPill").textContent = pend.length;
    $("#bellCount").hidden = !pend.length; $("#bellCount").textContent = pend.length;
    $("#bellPanel").innerHTML = pend.length
      ? pend.map((b) => `<div class="item" data-id="${b.id}"><b>${U.esc(b.name)} <span class="code">${b.code}</span></b><span class="muted">${short(b.checkIn)}–${short(b.checkOut)} · ${U.money(b.total)}</span>${tag(b)}</div>`).join("")
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
    const mStart = U.toKey(new Date(now.getFullYear(), now.getMonth(), 1)), mEnd = U.toKey(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    const rev = computeStats(mStart, mEnd).rev;
    const pend = ALL.filter((b) => b.status === "pending").length;
    const arr = arrivalsToday(), roomsIn = arr.reduce((n, b) => n + b.rooms.length, 0), waiting = arr.filter((b) => !b.checkedIn);
    const free = freeOn(t);
    const monthCount = ALL.filter((b) => b.status !== "cancelled" && (b.createdAt && new Date(b.createdAt).toISOString().slice(0, 7) === ym)).length;
    $("#kpis").innerHTML = `
      <div class="kpi kpi--hl"><span>รอดำเนินการ</span><b>${pend}</b><small>ส่งสลิปแล้ว ${ALL.filter((b) => b.status === "pending" && b.payment === "slip").length} · รอชำระ ${ALL.filter((b) => b.status === "pending" && b.payment !== "slip").length}</small></div>
      <div class="kpi"><span>ห้องว่างคืนนี้</span><b>${free}/${TOTAL}</b><small>ไม่ว่าง ${TOTAL - free} ห้อง</small></div>
      <div class="kpi"><span>เช็กอินวันนี้</span><b>${roomsIn} ห้อง</b><small>รอเช็กอิน ${waiting.reduce((n, b) => n + b.rooms.length, 0)} ห้อง</small></div>
      <div class="kpi"><span>รายได้เดือนนี้</span><b>${U.money(Math.round(rev))}</b><small>จองใหม่เดือนนี้ ${monthCount} รายการ</small></div>`;

    $("#tonightText").textContent = U.thDate(t, { weekday: "short", day: "numeric", month: "short" });
    const rm = roomsOn(t);
    $("#tonight").innerHTML = C.houses.map((h) => {
      const b = rm[h.id];
      if (!b) return `<div class="house"><b>${U.esc(h.name)}</b>ว่าง<br><span class="st">พร้อมขาย</span></div>`;
      const pendingB = b.status === "pending";
      return `<div class="house busy ${pendingB ? "busy--pending" : ""}" data-id="${b.id}"><b>${U.esc(h.name)}</b>${U.esc(b.name.split(" ")[0])}<br><span class="st">${pendingB ? (b.payment === "slip" ? "รอตรวจสลิป" : "รอชำระ") : "ไม่ว่าง"}</span><small class="out">ออก ${short(b.checkOut)}</small></div>`;
    }).join("");

    // เช็กอินวันนี้ เรียงตามเวลา
    $("#todayCount").textContent = `${roomsIn} ห้อง`;
    $("#todayRooms").innerHTML = arr.length
      ? `รอเช็กอิน <b>${waiting.reduce((n, b) => n + b.rooms.length, 0)}</b> ห้อง${waiting.length ? ": " + waiting.flatMap((b) => b.rooms).map(U.houseName).join(", ") : ""}`
      : "";
    $("#todayIn").innerHTML = arr.length ? arr.map((b) => `
      <li data-id="${b.id}" class="${b.checkedIn ? "is-in" : ""}">
        <div class="d"><b>${arrTime(b)}</b><small>${b.earlyCheckIn ? "ก่อนเวลา" : "มาถึง"}</small></div>
        <div class="x"><div><b>${b.rooms.map(U.houseName).join(", ")}</b> · ${U.esc(b.name)}</div>
          <div class="muted small">${b.adults + b.children} ท่าน · ${b.nights} คืน${b.breakfastTime ? " · 🍳 " + U.esc(b.breakfastTime) : ""} · ${U.esc(b.phone)}</div></div>
        ${b.checkedIn ? `<span class="tag tag--confirmed">เช็กอินแล้ว ${U.esc(b.checkedIn)}</span>` : b.status === "confirmed" ? `<button class="btn btn--sm btn--ok" data-checkin="${b.id}">✓ เช็กอินแล้ว</button>` : tag(b)}
      </li>`).join("") : `<p class="empty">ไม่มีเช็กอินวันนี้</p>`;

    const week = U.addDays(t, 7);
    const up = active().filter((b) => b.checkIn > t && b.checkIn < week).sort((a, z) => a.checkIn.localeCompare(z.checkIn) || arrTime(a).localeCompare(arrTime(z)));
    $("#upcoming").innerHTML = up.length ? up.map((b) => {
      const d = U.fromKey(b.checkIn);
      return `<li data-id="${b.id}"><div class="d"><b>${d.getDate()}</b><small>${d.toLocaleDateString("th-TH", { month: "short" })}</small></div>
        <div class="x"><div><b>${U.esc(b.name)}</b> · ${b.nights} คืน</div><div class="muted small">${b.rooms.map(U.houseName).join(", ")} · ${b.adults + b.children} ท่าน · มาถึง ${arrTime(b)}${b.breakfastTime ? " · 🍳 " + U.esc(b.breakfastTime) : ""}</div></div>${tag(b)}</li>`;
    }).join("") : `<p class="empty">ไม่มีเช็กอินใน 7 วันข้างหน้า</p>`;

    $("#latestTable").innerHTML = tableHTML(ALL.slice(0, 6));
  }
  function arrTime(b) { const m = String(b.earlyCheckIn || b.arrivalTime || C.checkInTime).match(/\d{1,2}:\d{2}/); return m ? m[0].padStart(5, "0") : C.checkInTime; }
  function arrivalsToday() {
    const t = U.today();
    return active().filter((b) => b.checkIn === t).sort((a, z) => (a.checkedIn ? 1 : 0) - (z.checkedIn ? 1 : 0) || arrTime(a).localeCompare(arrTime(z)));
  }
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-checkin]"); if (!btn) return;
    e.stopPropagation(); btn.disabled = true;
    const time = new Date().toTimeString().slice(0, 5);
    try { await DB.patch(btn.dataset.checkin, { checkedIn: time }); toast("บันทึกเช็กอินแล้ว", time + " น."); }
    catch (ex) { toast("บันทึกไม่สำเร็จ", ex.message); btn.disabled = false; }
  }, true);

  /* ================= ค้นหาอัจฉริยะ ================= */
  const TH_MONTHS = [["ม.ค.", "มกราคม", "jan"], ["ก.พ.", "กุมภาพันธ์", "feb"], ["มี.ค.", "มีนาคม", "mar"], ["เม.ย.", "เมษายน", "apr"], ["พ.ค.", "พฤษภาคม", "may"], ["มิ.ย.", "มิถุนายน", "jun"],
    ["ก.ค.", "กรกฎาคม", "jul"], ["ส.ค.", "สิงหาคม", "aug"], ["ก.ย.", "กันยายน", "sep"], ["ต.ค.", "ตุลาคม", "oct"], ["พ.ย.", "พฤศจิกายน", "nov"], ["ธ.ค.", "ธันวาคม", "dec"]];
  const normYear = (y) => { y = +y; if (y < 100) y += 2500; if (y > 2400) y -= 543; return y; };
  const near = (m, d) => { // ไม่ระบุปี: เลือกปีที่ใกล้วันนี้ที่สุด
    const n = new Date(), c = [n.getFullYear() - 1, n.getFullYear(), n.getFullYear() + 1].map((y) => new Date(y, m, d));
    return c.sort((a, z) => Math.abs(a - n) - Math.abs(z - n))[0];
  };
  function parseDateQ(q) {
    q = q.trim().toLowerCase();
    if (q === "วันนี้" || q === "today") return { day: U.today() };
    if (q === "พรุ่งนี้" || q === "tomorrow") return { day: U.addDays(U.today(), 1) };
    if (q === "เมื่อวาน" || q === "yesterday") return { day: U.addDays(U.today(), -1) };
    let m;
    if ((m = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return { day: U.toKey(new Date(normYear(m[1]), m[2] - 1, +m[3])) };
    if ((m = q.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/))) {
      const d = +m[1], mo = +m[2] - 1; if (mo > 11 || d > 31) return null;
      return { day: U.toKey(m[3] ? new Date(normYear(m[3]), mo, d) : near(mo, d)) };
    }
    // รูปแบบ: [วัน] เดือน [ปี] เช่น "12 พ.ย.", "พฤศจิกายน 2569", "nov"
    for (let mi = 0; mi < 12; mi++) {
      for (const n of [...TH_MONTHS[mi], TH_MONTHS[mi][0].replace(/\./g, "")]) {
        const esc = n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const mm = q.match(new RegExp("^(?:(\\d{1,2})\\s*)?" + esc + "\\s*(\\d{2,4})?$"));
        if (!mm) continue;
        const y = mm[2] ? normYear(mm[2]) : null;
        if (mm[1]) return { day: U.toKey(y ? new Date(y, mi, +mm[1]) : near(mi, +mm[1])) };
        return { month: mi, year: y };
      }
    }
    return null;
  }
  function haystack(b) {
    return [b.code, b.name, b.email, b.phone, b.phone.replace(/\D/g, ""), b.rooms.map((r) => U.houseName(r) + " @" + r + " ห้อง" + r).join(" "),
      b.rateName, stateOf(b)[1], b.note, (b.requests || []).join(" "), b.doorCode].join(" ").toLowerCase();
  }
  function matchBooking(b, q) {
    const toks = q.trim().toLowerCase().split(/\s+(?=\S)/).filter(Boolean);
    if (!toks.length) return null;
    const why = [];
    // ลองทั้งข้อความเป็นวันที่ก่อน (เช่น "12 พ.ย. 2569")
    const whole = parseDateQ(q);
    const parts = whole ? [{ date: whole }] : toks.map((t) => ({ t, date: parseDateQ(t) }));
    const H = haystack(b), created = b.createdAt ? U.toKey(new Date(b.createdAt)) : "";
    for (const p of parts) {
      if (p.date && p.date.day) {
        const k = p.date.day;
        if (b.checkIn <= k && k < b.checkOut) why.push(b.checkIn === k ? "เช็กอินวันนี้" : "พักวันที่นี้");
        else if (b.checkOut === k) why.push("เช็กเอาต์วันที่นี้");
        else if (created === k) why.push("จองวันที่นี้");
        else return null;
      } else if (p.date && p.date.month != null) {
        const ok = [b.checkIn, b.checkOut, created].some((k) => k && +k.slice(5, 7) - 1 === p.date.month && (!p.date.year || +k.slice(0, 4) === p.date.year));
        if (!ok) return null; why.push("เดือน " + TH_MONTHS[p.date.month][0]);
      } else {
        const t = p.t.replace(/^stay/, ""), digits = t.replace(/\D/g, "");
        if (H.includes(p.t) || H.includes(t)) why.push(b.code.toLowerCase() === p.t ? "รหัสจอง" : "");
        else if (digits.length >= 3 && b.phone.replace(/\D/g, "").includes(digits)) why.push("เบอร์โทร");
        else return null;
      }
    }
    return why.filter(Boolean);
  }
  function searchAll(q) {
    return ALL.map((b) => ({ b, why: matchBooking(b, q) })).filter((x) => x.why)
      .sort((a, z) => (z.b.checkIn >= U.today()) - (a.b.checkIn >= U.today()) || Math.abs(U.fromKey(a.b.checkIn) - Date.now()) - Math.abs(U.fromKey(z.b.checkIn) - Date.now()));
  }
  let smartSel = 0, smartRes = [];
  function renderSmart() {
    const q = $("#smart").value, P = $("#smartPanel");
    if (!q.trim()) { P.classList.remove("is-open"); return; }
    smartRes = searchAll(q); smartSel = 0;
    const d = parseDateQ(q);
    const hint = d && d.day ? `วันที่ ${U.thDate(d.day, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}` : d && d.month != null ? `เดือน ${TH_MONTHS[d.month][1]}` : "";
    P.innerHTML = `<div class="smart__head">${smartRes.length ? `พบ ${smartRes.length} รายการ` : "ไม่พบการจองที่ตรงกับคำค้นหา"}${hint ? ` · ค้นหา${hint}` : ""}</div>` +
      smartRes.slice(0, 8).map((x, i) => `<button class="smart__item ${i === 0 ? "is-sel" : ""}" data-id="${x.b.id}" role="option">
        <span class="smart__main"><b>${U.esc(x.b.name)}</b> <span class="code">${U.esc(x.b.code)}</span>${x.why.length ? `<em>${U.esc([...new Set(x.why)].join(" · "))}</em>` : ""}</span>
        <span class="muted small">${x.b.rooms.map(U.houseName).join(", ")} · ${short(x.b.checkIn)}–${short(x.b.checkOut)} · ${U.esc(x.b.phone)}</span>
        ${tag(x.b)}</button>`).join("") +
      (smartRes.length > 8 ? `<button class="smart__more" data-more="1">ดูทั้งหมด ${smartRes.length} รายการในหน้ารายการจอง →</button>` : "");
    P.classList.add("is-open");
  }
  $("#smart").addEventListener("input", renderSmart);
  $("#smart").addEventListener("focus", renderSmart);
  $("#smart").addEventListener("keydown", (e) => {
    const items = $$("#smartPanel .smart__item");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); if (!items.length) return;
      smartSel = (smartSel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((x, i) => x.classList.toggle("is-sel", i === smartSel));
    } else if (e.key === "Enter") { e.preventDefault(); if (items[smartSel]) { openBooking(items[smartSel].dataset.id); closeSmart(); } }
    else if (e.key === "Escape") closeSmart();
  });
  function closeSmart() { $("#smartPanel").classList.remove("is-open"); }
  $("#smartPanel").addEventListener("click", (e) => {
    e.stopPropagation();
    const it = e.target.closest(".smart__item");
    if (it) { openBooking(it.dataset.id); closeSmart(); return; }
    if (e.target.closest("[data-more]")) { $("#q").value = $("#smart").value; filter = "all"; show("bookings"); closeSmart(); }
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("#smartWrap")) closeSmart(); });

  /* ================= ตาราง ================= */
  function tableHTML(rows) {
    if (!rows.length) return `<tr><td class="empty">ยังไม่มีการจอง</td></tr>`;
    return `<thead><tr><th>รหัส</th><th>ลูกค้า</th><th>เข้าพัก</th><th>บ้าน</th><th>ผู้เข้าพัก</th><th>ยอด</th><th>สถานะ</th><th>จองเมื่อ</th></tr></thead><tbody>` +
      rows.map((b) => `<tr class="row ${Date.now() - b.createdAt < 8000 ? "new" : ""}" data-id="${b.id}">
        <td class="code">${b.code}</td><td><b>${U.esc(b.name)}</b><br><span class="muted small">${U.esc(b.phone)}</span></td>
        <td>${short(b.checkIn)} – ${short(b.checkOut)}<br><span class="muted small">${b.nights} คืน${b.rateName ? " · " + U.esc(b.rateName) : ""}</span></td>
        <td>${b.rooms.map(U.houseName).join("<br>")}</td><td>${b.adults} / ${b.children}${b.extraBeds ? " +เตียง" : ""}</td>
        <td><b>${U.money(b.total)}</b></td><td>${tag(b)}</td>
        <td class="muted small">${new Date(b.createdAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td></tr>`).join("") + "</tbody>";
  }
  function filtered() {
    const q = $("#q").value.trim();
    return ALL.filter((b) => (filter === "all" || b.status === filter) && (!q || matchBooking(b, q)));
  }
  function renderTable() { $("#allTable").innerHTML = tableHTML(filtered()); }
  $("#q").addEventListener("input", renderTable);
  $$("#statusFilter button").forEach((b) => (b.onclick = () => {
    filter = b.dataset.s; $$("#statusFilter button").forEach((x) => x.classList.toggle("is-active", x === b)); renderTable();
  }));
  $("#btnCsv").onclick = () => {
    const head = ["รหัส", "ชื่อ", "โทร", "อีเมล", "เช็กอิน", "เช็กเอาต์", "คืน", "ผู้ใหญ่", "เด็ก", "บ้าน", "แพ็กเกจ", "คำขอ", "หมายเหตุ", "ยอด", "สถานะ", "รหัสเปิดห้อง"];
    const rows = filtered().map((b) => [b.code, b.name, b.phone, b.email, b.checkIn, b.checkOut, b.nights, b.adults, b.children,
      b.rooms.map(U.houseName).join(" / "), b.rateName || "", b.requests.join(" / "), b.note, b.total, stateOf(b)[1], b.doorCode || ""]);
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
      html += `<div class="day ${d.getMonth() !== m ? "out" : ""} ${k === t ? "today" : ""} ${f === 0 ? "is-full" : ""}" data-day="${k}">
        <div class="day__n">${d.getDate()}<small class="lv${lv(f)}">${f === 0 ? "เต็ม" : "ว่าง " + f}</small></div>
        <div class="bar"><i style="width:${((TOTAL - f) / TOTAL) * 100}%"></i></div>
        <div class="chips">${bs.flatMap((b) => b.rooms.map((r) => ({ b, r }))).sort((x, y) => x.r - y.r).map(({ b, r }) => `<span class="${b.status === "pending" ? "p" : ""}" title="${U.esc(b.name)}"><b>${U.esc(U.houseName(r))}</b> ${U.esc(b.name.split(" ")[0])}</span>`).join("")}</div></div>`;
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

  /* ================= ยอดขาย / รายงาน ================= */
  let saleMode = "month", saleAnchor = U.today(), cFrom = U.addDays(U.today(), -29), cTo = U.today(), chartT;
  const TH_M = (d, o) => d.toLocaleDateString("th-TH", o);
  function saleRange() {
    const a = U.fromKey(saleAnchor), y = a.getFullYear(), m = a.getMonth();
    if (saleMode === "day") return { s: saleAnchor, e: U.addDays(saleAnchor, 1), title: TH_M(a, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) };
    if (saleMode === "week") {
      const s = U.addDays(saleAnchor, -((a.getDay() + 6) % 7));
      return { s, e: U.addDays(s, 7), title: "สัปดาห์ " + U.thDate(s, { day: "numeric", month: "short" }) + " – " + U.thDate(U.addDays(s, 6), { day: "numeric", month: "short", year: "numeric" }) };
    }
    if (saleMode === "month") return { s: U.toKey(new Date(y, m, 1)), e: U.toKey(new Date(y, m + 1, 1)), title: TH_M(a, { month: "long", year: "numeric" }) };
    if (saleMode === "quarter") {
      const q = Math.floor(m / 3);
      return { s: U.toKey(new Date(y, q * 3, 1)), e: U.toKey(new Date(y, q * 3 + 3, 1)),
        title: `ไตรมาส ${q + 1}/${y + 543} (${TH_M(new Date(y, q * 3, 1), { month: "short" })} – ${TH_M(new Date(y, q * 3 + 2, 1), { month: "short" })})` };
    }
    if (saleMode === "year") return { s: U.toKey(new Date(y, 0, 1)), e: U.toKey(new Date(y + 1, 0, 1)), title: "ปี " + (y + 543) };
    const f = cFrom <= cTo ? cFrom : cTo, t = cFrom <= cTo ? cTo : cFrom;
    return { s: f, e: U.addDays(t, 1), title: U.thDate(f) + " – " + U.thDate(t) };
  }
  function shiftSale(dir) {
    const a = U.fromKey(saleAnchor);
    if (saleMode === "day") saleAnchor = U.addDays(saleAnchor, dir);
    else if (saleMode === "week") saleAnchor = U.addDays(saleAnchor, 7 * dir);
    else if (saleMode === "month") saleAnchor = U.toKey(new Date(a.getFullYear(), a.getMonth() + dir, 1));
    else if (saleMode === "quarter") saleAnchor = U.toKey(new Date(a.getFullYear(), a.getMonth() + 3 * dir, 1));
    else if (saleMode === "year") saleAnchor = U.toKey(new Date(a.getFullYear() + dir, 0, 1));
    else { const n = U.nightsBetween(cFrom, U.addDays(cTo, 1)).length; cFrom = U.addDays(cFrom, n * dir); cTo = U.addDays(cTo, n * dir); }
    renderSales();
  }
  function renderSalePick() {
    const a = U.fromKey(saleAnchor), y = a.getFullYear(), m = a.getMonth();
    let h = "";
    if (saleMode === "day" || saleMode === "week") h = `<input type="date" id="spDate" value="${saleAnchor}" aria-label="เลือกวันที่" />`;
    else if (saleMode === "month" || saleMode === "quarter") h = `<input type="month" id="spMonth" value="${y}-${String(m + 1).padStart(2, "0")}" aria-label="เลือกเดือน" />`;
    else if (saleMode === "year") {
      const ys = new Set(ALL.map((b) => +b.checkIn.slice(0, 4))); ys.add(new Date().getFullYear()); ys.add(y);
      h = `<select id="spYear" aria-label="เลือกปี">${[...ys].sort().map((v) => `<option value="${v}" ${v === y ? "selected" : ""}>${v + 543}</option>`).join("")}</select>`;
    } else h = `<input type="date" id="spFrom" value="${cFrom}" aria-label="ตั้งแต่วันที่" /><span class="muted">ถึง</span><input type="date" id="spTo" value="${cTo}" aria-label="ถึงวันที่" />`;
    $("#salePick").innerHTML = h;
    const on = (id, fn) => { const el = $("#" + id); if (el) el.onchange = () => { if (el.value) { fn(el.value); renderSales(); } }; };
    on("spDate", (v) => (saleAnchor = v));
    on("spMonth", (v) => (saleAnchor = v + "-01"));
    on("spYear", (v) => (saleAnchor = v + "-01-01"));
    on("spFrom", (v) => (cFrom = v)); on("spTo", (v) => (cTo = v));
  }
  $$("#salePeriod button").forEach((b) => (b.onclick = () => {
    saleMode = b.dataset.p; $$("#salePeriod button").forEach((x) => x.classList.toggle("is-active", x === b)); renderSales();
  }));
  $("#salePrev").onclick = () => shiftSale(-1);
  $("#saleNext").onclick = () => shiftSale(1);

  /* คำนวณสถิติในช่วง [s, e) — นับตามคืนจริง แบ่งรายได้ต่อคืนต่อห้อง */
  function computeStats(s, e) {
    const days = U.nightsBetween(s, e);
    const room = {}; C.houses.forEach((h) => (room[h.id] = { id: h.id, name: h.name, nights: 0, rev: 0, bookings: new Set() }));
    const daily = {}; days.forEach((k) => (daily[k] = { rev: 0, rooms: {} }));
    const list = []; let pendingRev = 0, pendingNights = 0;
    ALL.forEach((b) => {
      if (b.status === "cancelled" || b.checkOut <= s || b.checkIn >= e) return;
      const ks = U.nightsBetween(b.checkIn > s ? b.checkIn : s, b.checkOut < e ? b.checkOut : e);
      const perNight = b.total / b.nights, per = perNight / b.rooms.length;
      if (b.status !== "confirmed") { pendingRev += perNight * ks.length; pendingNights += ks.length * b.rooms.length; return; }
      ks.forEach((k) => b.rooms.forEach((r) => {
        const R = room[r]; if (!R) return;
        R.nights++; R.rev += per; R.bookings.add(b.id);
        daily[k].rev += per; daily[k].rooms[r] = b.code;
      }));
      list.push({ b, nightsIn: ks.length, revIn: perNight * ks.length });
    });
    const rooms = Object.values(room);
    const rev = rooms.reduce((t, r) => t + r.rev, 0), sold = rooms.reduce((t, r) => t + r.nights, 0);
    const cap = days.length * TOTAL;
    return { days, rooms, daily, list, rev, sold, cap, occ: cap ? (sold / cap) * 100 : 0, adr: sold ? rev / sold : 0, pendingRev, pendingNights };
  }

  let lastReport = null;
  function renderSales() {
    renderSalePick();
    const R = saleRange(), st = computeStats(R.s, R.e);
    lastReport = { R, st };
    $("#saleTitle").textContent = R.title;
    $("#saleRange").textContent = `${U.thDate(R.s)} – ${U.thDate(U.addDays(R.e, -1))} · ${st.days.length} วัน`;
    $("#saleKpis").innerHTML = `
      <div class="kpi kpi--hl"><span>รายได้รวม (ยืนยันแล้ว)</span><b>${U.money(Math.round(st.rev))}</b><small>${st.list.length} การจอง</small></div>
      <div class="kpi"><span>จำนวนคืนที่ขายได้</span><b>${st.sold}</b><small>จาก ${st.cap} ห้อง-คืน · เข้าพัก ${st.occ.toFixed(0)}%</small></div>
      <div class="kpi"><span>ราคาเฉลี่ย / ห้อง / คืน</span><b>${U.money(Math.round(st.adr))}</b><small>ADR</small></div>
      <div class="kpi"><span>รอยืนยัน (คาดการณ์)</span><b>${U.money(Math.round(st.pendingRev))}</b><small>${st.pendingNights} ห้อง-คืน · ยังไม่นับในรายได้</small></div>`;

    // อันดับห้องยอดนิยม
    const ranked = [...st.rooms].sort((a, z) => z.nights - a.nights || z.rev - a.rev).slice(0, 5);
    const maxN = Math.max(1, ...ranked.map((r) => r.nights));
    $("#rank").innerHTML = ranked.map((r, i) => `
      <li><span class="rank__n">${i + 1}</span>
        <div class="rank__body"><div class="rank__top"><b>${U.esc(r.name)}</b><span>${r.nights} คืน · ${U.money(Math.round(r.rev))}</span></div>
        <div class="rank__bar"><i style="width:${(r.nights / maxN) * 100}%"></i></div>
        <small>${r.bookings.size} การจอง · เข้าพัก ${st.days.length ? ((r.nights / st.days.length) * 100).toFixed(0) : 0}% ของช่วงนี้</small></div></li>`).join("");

    // ตารางรายห้อง
    $("#roomTableNote").textContent = R.title;
    $("#roomTable").innerHTML = `<thead><tr><th>ห้อง</th><th class="r">คืนที่เข้าพัก</th><th class="r">จำนวนการจอง</th><th class="r">อัตราเข้าพัก</th><th class="r">รายได้</th><th class="r">สัดส่วนรายได้</th></tr></thead><tbody>` +
      st.rooms.map((r) => `<tr><td><b>${U.esc(r.name)}</b></td><td class="r">${r.nights}</td><td class="r">${r.bookings.size}</td>
        <td class="r">${st.days.length ? ((r.nights / st.days.length) * 100).toFixed(0) : 0}%</td><td class="r"><b>${U.money(Math.round(r.rev))}</b></td>
        <td class="r">${st.rev ? ((r.rev / st.rev) * 100).toFixed(0) : 0}%</td></tr>`).join("") +
      `</tbody><tfoot><tr><td>รวมทั้งหมด</td><td class="r">${st.sold}</td><td class="r">${st.list.length}</td><td class="r">${st.occ.toFixed(0)}%</td><td class="r">${U.money(Math.round(st.rev))}</td><td class="r">100%</td></tr></tfoot>`;

    // กราฟรายได้
    if (typeof Chart === "undefined") return;
    let buckets = [], unit;
    if (saleMode === "day") { unit = "แยกตามห้อง"; buckets = st.rooms.map((r) => [r.name, r.rev]); }
    else if (st.days.length <= 62) { unit = "รายวัน"; buckets = st.days.map((k) => [U.thDate(k, { day: "numeric", month: "short" }), st.daily[k].rev]); }
    else {
      unit = "รายเดือน"; const mm = {};
      st.days.forEach((k) => { const mk = k.slice(0, 7); mm[mk] = (mm[mk] || 0) + st.daily[k].rev; });
      buckets = Object.keys(mm).map((mk) => [TH_M(U.fromKey(mk + "-01"), { month: "short", year: "2-digit" }), mm[mk]]);
    }
    $("#trendUnit").textContent = unit;
    const css = getComputedStyle(document.documentElement), forest = css.getPropertyValue("--forest").trim();
    chartT && chartT.destroy();
    chartT = new Chart($("#chartTrend"), { type: "bar",
      data: { labels: buckets.map((b) => b[0]), datasets: [{ data: buckets.map((b) => Math.round(b[1])), backgroundColor: forest, borderRadius: 6, maxBarThickness: 38 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => U.money(c.raw) } } },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => "฿" + Number(v).toLocaleString() }, grid: { color: "rgba(46,74,44,.08)" } },
                  x: { grid: { display: false }, ticks: { autoSkip: true, maxRotation: 0 } } } } });
  }

  /* ---------- ส่งออก Excel ---------- */
  $("#btnXlsx").onclick = () => {
    if (typeof XLSX === "undefined") { toast("ส่งออกไม่ได้", "โหลดเครื่องมือ Excel ไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่"); return; }
    if (!lastReport) renderSales();
    const { R, st } = lastReport, last = U.addDays(R.e, -1), r0 = (n) => Math.round(n);
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
    const wb = XLSX.utils.book_new();
    const add = (name, rows, widths) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = widths.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
    add("สรุป", [
      ["รายงานยอดขาย Stay@Phukphol"], ["ช่วงรายงาน", R.title], ["ตั้งแต่", R.s], ["ถึง", last], ["จำนวนวัน", st.days.length], [],
      ["รายได้รวม (บาท) - ยืนยันแล้ว", r0(st.rev)], ["จำนวนการจอง", st.list.length], ["จำนวนคืนที่ขายได้ (ห้อง-คืน)", st.sold],
      ["ห้อง-คืนทั้งหมดที่ขายได้", st.cap], ["อัตราการเข้าพัก (%)", pct(st.sold, st.cap)], ["ราคาเฉลี่ยต่อห้องต่อคืน (บาท)", r0(st.adr)], [],
      ["รอยืนยัน - คาดการณ์ (บาท)", r0(st.pendingRev)], ["รอยืนยัน (ห้อง-คืน)", st.pendingNights], [],
      ["ออกรายงานเมื่อ", new Date().toLocaleString("th-TH")]
    ], [34, 30]);
    add("แยกรายห้อง", [["ห้อง", "คืนที่เข้าพัก", "จำนวนการจอง", "อัตราเข้าพัก (%)", "รายได้ (บาท)", "สัดส่วนรายได้ (%)"],
      ...st.rooms.map((r) => [r.name, r.nights, r.bookings.size, pct(r.nights, st.days.length), r0(r.rev), pct(r.rev, st.rev)]),
      ["รวมทั้งหมด", st.sold, st.list.length, pct(st.sold, st.cap), r0(st.rev), 100]], [14, 14, 14, 16, 16, 18]);
    add("อันดับห้องยอดนิยม", [["อันดับ", "ห้อง", "คืนที่เข้าพัก", "รายได้ (บาท)"],
      ...[...st.rooms].sort((a, z) => z.nights - a.nights || z.rev - a.rev).map((r, i) => [i + 1, r.name, r.nights, r0(r.rev)])], [8, 14, 14, 16]);
    add("รายวัน", [["วันที่", "ห้องที่ขายได้", "รายได้ (บาท)", ...C.houses.map((h) => h.name + " (รหัสจอง)")],
      ...st.days.map((k) => [k, Object.keys(st.daily[k].rooms).length, r0(st.daily[k].rev), ...C.houses.map((h) => st.daily[k].rooms[h.id] || "")])],
      [12, 14, 14, ...C.houses.map(() => 16)]);
    add("รายการจอง", [["รหัสจอง", "ชื่อ", "โทร", "เช็กอิน", "เช็กเอาต์", "คืนทั้งหมด", "คืนในช่วงนี้", "ห้อง", "แพ็กเกจ", "ยอดทั้งการจอง (บาท)", "รายได้ในช่วงนี้ (บาท)"],
      ...st.list.sort((a, z) => a.b.checkIn.localeCompare(z.b.checkIn)).map(({ b, nightsIn, revIn }) =>
        [b.code, b.name, b.phone, b.checkIn, b.checkOut, b.nights, nightsIn, b.rooms.map(U.houseName).join(", "), b.rateName || "", b.total, r0(revIn)])],
      [10, 22, 14, 12, 12, 10, 12, 18, 16, 18, 18]);
    XLSX.writeFile(wb, `StayPhukphol-report-${R.s}_to_${last}.xlsx`);
    toast("ส่งออกแล้ว", "ไฟล์ Excel อยู่ในโฟลเดอร์ดาวน์โหลด");
  };

  /* ================= Modal ================= */
  const modal = $("#modal");
  function openModal(html) { $("#modalBody").innerHTML = html; modal.classList.add("is-open"); }
  function closeModal() { modal.classList.remove("is-open"); openId = null; }
  modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", (e) => e.key === "Escape" && closeModal());

  // คลิกที่ใดก็ได้ที่มี data-id / data-day
  document.addEventListener("click", (e) => {
    if (e.target.closest("#bellPanel, .modal__box .actions")) return;
    const r = e.target.closest("[data-id]"); if (r && !r.closest("#bellPanel")) return openBooking(r.dataset.id);
    const d = e.target.closest("[data-day]"); if (d) openDay(d.dataset.day);
  });

  let openId = null;
  function openBooking(id, refresh) {
    const b = ALL.find((x) => x.id === id); if (!b) return;
    if (refresh && document.activeElement && document.activeElement.id === "doorInput") return;
    openId = id;
    const tel = b.phone.replace(/[^0-9+]/g, "");
    const pay = { unpaid: "ยังไม่แนบสลิป", slip: "แนบสลิปแล้ว รอตรวจสอบ", paid: "ชำระแล้ว" }[b.payment] || "-";
    const v = { code: b.code, rooms: b.rooms, checkIn: b.checkIn, checkOut: b.checkOut, doorCode: b.doorCode };
    const mailBody = b.status === "confirmed" ? U.confirmText(v) : "";
    openModal(`
      <div class="mh"><h2>${U.esc(b.name)}</h2>${tag(b)}</div>
      <p class="code">รหัสการจอง ${U.esc(b.code)}</p>
      <div class="mgrid">
        <dl class="dl">
          <dt>เช็กอิน</dt><dd>${U.thDate(b.checkIn, { weekday: "short", day: "numeric", month: "long", year: "numeric" })} · มาถึงประมาณ ${U.esc(b.arrivalTime || "-")}</dd>
          <dt>เช็กเอาต์</dt><dd>${U.thDate(b.checkOut, { weekday: "short", day: "numeric", month: "long", year: "numeric" })} (${b.nights} คืน)</dd>
          <dt>ห้องพัก</dt><dd><b>${b.rooms.map(U.houseName).join(", ")}</b></dd>
          <dt>แพ็กเกจ</dt><dd><b>${U.esc(b.rateName || "-")}</b>${b.breakfastTime ? ` · 🍳 รับอาหารเช้า ${U.esc(b.breakfastTime)} น.` : ""}</dd>
          ${b.earlyCheckIn ? `<dt>เช็กอินก่อนเวลา</dt><dd><b>${U.esc(b.earlyCheckIn)} น.</b></dd>` : ""}
          <dt>ผู้เข้าพัก</dt><dd>ผู้ใหญ่ ${b.adults} · เด็ก ${b.children}</dd>
          <dt>คำขอเพิ่มเติม</dt><dd>${U.esc(b.requests.join(", ") || "-")}</dd>
          <dt>ข้อความ</dt><dd>${U.esc(b.note || "-")}</dd>
          <dt>โทร</dt><dd><a href="tel:${tel}">${U.esc(b.phone)}</a></dd>
          <dt>อีเมล</dt><dd><a href="mailto:${U.esc(b.email)}">${U.esc(b.email)}</a></dd>
          <dt>ยอดรวม</dt><dd><b style="font-size:1.3rem;color:var(--forest)">${U.money(b.total)}</b></dd>
          <dt>การชำระเงิน</dt><dd>${pay}</dd>
          ${b.doorCode ? `<dt>รหัสเปิดห้อง</dt><dd><b class="door">${U.esc(b.doorCode)}</b></dd>` : ""}
          <dt>จองเมื่อ</dt><dd>${new Date(b.createdAt).toLocaleString("th-TH")}</dd>
        </dl>
        <div class="slipbox" id="slipBox">${b.payment === "unpaid" ? `<p class="empty">ลูกค้ายังไม่ได้แนบสลิป</p>` : `<p class="empty">กำลังโหลดสลิป...</p>`}</div>
      </div>
      ${b.status === "pending" ? `
      <div class="confirmbox">
        <h3>ยืนยันการจอง</h3>
        <p class="muted small">${b.payment === "slip" ? "ตรวจยอดเงินในสลิปให้ตรงกับยอดรวมก่อนยืนยัน" : "⚠️ ลูกค้ายังไม่ได้แนบสลิป ยืนยันได้ถ้าตรวจการชำระเงินทางอื่นแล้ว"}</p>
        <label class="doorfield"><span>รหัสเปิดห้อง 6 หลัก (ตั้งรหัสนี้ที่ประตู ${b.rooms.map(U.houseName).join(", ")} ด้วย)</span>
          <span class="doorrow"><input id="doorInput" inputmode="numeric" maxlength="6" value="${U.doorCode()}" /><button type="button" class="btn btn--ghost btn--sm" id="doorNew">สุ่มใหม่</button></span></label>
        <button class="btn btn--ok" data-act="confirm">✓ ยืนยันการจอง และส่งรหัสให้ลูกค้า</button>
      </div>` : ""}
      ${b.status === "confirmed" ? `
      <div class="confirmbox confirmbox--done">
        <h3>ส่งข้อมูลยืนยันให้ลูกค้า</h3>
        <p class="muted small">ลูกค้าเห็นรหัสการจองและรหัสเปิดห้องบนหน้าเว็บแล้ว ส่งซ้ำทาง LINE หรืออีเมลได้</p>
        <div class="actions" style="border:0;padding:0;margin:0">
          <button class="btn btn--sm" data-act="copy">📋 คัดลอกข้อความยืนยัน (วางใน LINE)</button>
          <a class="btn btn--ghost btn--sm" href="mailto:${U.esc(b.email)}?subject=${encodeURIComponent("ยืนยันการจอง " + b.code + " · สเตย์@บ้านปลูกผล")}&body=${encodeURIComponent(mailBody)}">✉️ ส่งทางอีเมล</a>
        </div>
      </div>` : ""}
      <div class="actions">
        ${b.status !== "cancelled" ? `<button class="btn btn--bad btn--sm" data-act="cancelled">ยกเลิก (คืนห้องว่าง)</button>` : ""}
        <a class="btn btn--ghost btn--sm" href="tel:${tel}">📞 โทร</a>
        <button class="btn btn--ghost btn--sm" data-act="delete" style="margin-left:auto">ลบ</button>
      </div>`);
    if (b.payment !== "unpaid") DB.getSlip(b.id).then((img) => {
      if (openId !== b.id || !$("#slipBox")) return;
      $("#slipBox").innerHTML = img ? `<p class="small muted">สลิปการโอน (แตะเพื่อขยาย)</p><img src="${img}" alt="สลิปการโอนของ ${U.esc(b.name)}" class="slipimg" />` : `<p class="empty">ไม่มีสลิปในระบบ</p>`;
      const im = $(".slipimg"); if (im) im.onclick = () => im.classList.toggle("zoom");
    }).catch(() => { if ($("#slipBox")) $("#slipBox").innerHTML = `<p class="empty">โหลดสลิปไม่สำเร็จ</p>`; });
    const dn = $("#doorNew"); if (dn) dn.onclick = () => ($("#doorInput").value = U.doorCode());
    $$("[data-act]", modal).forEach((btn) => (btn.onclick = async () => {
      const a = btn.dataset.act;
      if (a === "copy") {
        const t = U.confirmText(v);
        try { await navigator.clipboard.writeText(t); toast("คัดลอกแล้ว", "นำไปวางในแชท LINE ของลูกค้าได้เลย"); }
        catch (e) { prompt("คัดลอกข้อความนี้", t); }
        return;
      }
      if (a === "confirm") {
        const code = $("#doorInput").value.trim();
        if (!/^\d{6}$/.test(code)) { toast("รหัสเปิดห้องไม่ถูกต้อง", "ต้องเป็นตัวเลข 6 หลัก"); return; }
        btn.disabled = true;
        try { await DB.confirm(b, code); toast("ยืนยันการจองแล้ว", b.code + " · ลูกค้าเห็นรหัสเปิดห้องบนหน้าเว็บแล้ว"); openBooking(b.id); }
        catch (ex) { toast("ทำรายการไม่สำเร็จ", ex.message); btn.disabled = false; }
        return;
      }
      if (a === "cancelled" && !confirm("ยืนยันยกเลิกการจองนี้? ห้องจะกลับมาว่างให้จองได้")) return;
      if (a === "delete" && !confirm("ลบการจองนี้ถาวร? (สลิปจะถูกลบด้วย)")) return;
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
        return b ? `<div class="house busy ${b.status === "pending" ? "pending" : ""}" data-id="${b.id}"><b>${U.esc(h.name)}</b>${U.esc(b.name)}<br><span class="st">${stateOf(b)[1]}</span></div>`
          : `<div class="house"><b>${U.esc(h.name)}</b>ว่าง</div>`;
      }).join("")}</div>
      ${bs.length ? `<ul class="list">${bs.map((b) => `<li data-id="${b.id}"><div class="x"><div><b>${U.esc(b.name)}</b> <span class="code">${b.code}</span></div><div class="muted small">${short(b.checkIn)}–${short(b.checkOut)} · ${b.rooms.map(U.houseName).join(", ")}</div></div>${tag(b)}</li>`).join("")}</ul>` : `<p class="empty">ไม่มีผู้เข้าพักคืนนี้</p>`}`);
  }

  /* ================= เครื่องมือโหมดทดลอง ================= */
  if (DB.mode === "demo") {
    $("#btnSeed").onclick = async () => { seeding = true; await DB.seed(); seeding = false; toast("เพิ่มข้อมูลตัวอย่างแล้ว", "ลองเปิดปฏิทินและยอดขายดูได้เลย"); };
    $("#btnClear").onclick = () => { if (confirm("ล้างข้อมูลทดลองทั้งหมด?")) DB.clear(); };
  }
})();
