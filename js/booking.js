/* Stay @Phukphol — ระบบจองห้องพัก (ฝั่งลูกค้า)
   ขั้นตอน: 1 เลือกวันและห้อง → 2 ข้อมูลผู้จอง → 3 ชำระเงิน/แนบสลิป → 4 ยืนยันการจอง */
(function () {
  const { C, U, DB, sendEmails, notifyBot } = window.SP;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TOTAL = C.houses.length;
  const LAST = "sp_last_booking";
  const telHref = "tel:" + C.contact.phone.replace(/[^0-9+]/g, "");
  const lineHref = "https://line.me/R/ti/p/" + encodeURIComponent(C.contact.line);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

  if (DB.mode === "demo") $("#demoNote").hidden = false;
  $("#extraBedHint").textContent = "+" + U.money(C.extraBedPrice) + " / คืน / เตียง";

  const S = { checkIn: null, checkOut: null, adults: 2, children: 0, extraBeds: 0, rooms: [], free: null,
              quote: null, rate: C.defaultRate || C.rates[0].id, cart: [] };
  let fullDates = new Set(), unwatch = null;

  /* ---------- ปฏิทินเลือกวัน ---------- */
  const fp = flatpickr("#dates", {
    mode: "range", minDate: "today", dateFormat: "Y-m-d", locale: "th",
    showMonths: innerWidth > 760 ? 2 : 1, disableMobile: true,
    altInput: true, altFormat: "j M Y",
    onDayCreate(_, __, ___, el) {
      if (fullDates.has(U.toKey(el.dateObj))) { el.classList.add("is-full"); el.title = "เต็มแล้ว"; }
    },
    onChange(d) {
      if (d.length === 2) { S.checkIn = U.toKey(d[0]); S.checkOut = U.toKey(d[1]); if (S.free) search(); }
      else { S.checkIn = S.checkOut = null; }
    }
  });
  (async () => {
    try {
      const t = U.today(), occ = await DB.getOccupied(t, U.addDays(t, 186)), cnt = {};
      occ.forEach((n) => (cnt[n.date] = (cnt[n.date] || 0) + 1));
      fullDates = new Set(Object.keys(cnt).filter((k) => cnt[k] >= TOTAL));
      fp.redraw();
    } catch (e) { console.warn(e); }
  })();
  const st = document.createElement("style");
  st.textContent = ".flatpickr-day.is-full{text-decoration:line-through;color:#b9a99a}";
  document.head.appendChild(st);

  /* ---------- ปุ่ม + / − ---------- */
  const limits = { adults: [1, 15], children: [0, 10], extraBeds: [0, 5] };
  $$(".counter").forEach((c) => c.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const k = c.dataset.for, [mn, mx] = limits[k];
    let max = mx;
    if (k === "extraBeds") max = Math.max(1, S.rooms.length) * (C.maxGuestsPerHouse - C.baseGuestsPerHouse);
    S[k] = Math.max(mn, Math.min(max, S[k] + Number(b.dataset.d)));
    $("#" + k).textContent = S[k];
    if (k === "extraBeds") renderSummary();
    else if (S.free) search();
  }));

  /* ================= แผนที่ห้อง ================= */
  $("#mapImg").src = C.roomMapImage;
  const guests = () => S.adults + S.children;
  const need = () => U.housesNeeded(guests());

  function roomState(id) {
    if (!S.free) return "idle";
    if (!S.free.includes(id)) return "full";
    return S.rooms.includes(id) ? "pick" : "free";
  }
  const label = { idle: "", free: "ว่าง", pick: "✓ เลือกแล้ว", full: "เต็ม" };
  // ป้ายบนภาพ: ชื่อห้อง (บนมือถือย่อเหลือ @1) สีบอกสถานะ
  const pinText = (h, s) => (s === "pick" ? "✓ " : "") + U.esc(h.name).replace(/^([^@]+)@/, '<span class="pin__pre">$1</span>@');

  function renderMap() {
    $("#mapPins").innerHTML = C.houses.map((h) => {
      const s = roomState(h.id);
      return `<button type="button" class="pin pin--${s}" data-room="${h.id}" style="left:${h.x}%;top:${h.y}%"
        aria-label="${U.esc(h.name)} ${label[s] || ""}" ${s === "full" ? 'aria-disabled="true"' : ""}>${pinText(h, s)}</button>`;
    }).join("");
    $("#roomPick").innerHTML = C.houses.map((h) => {
      const s = roomState(h.id);
      return `<button type="button" class="rp rp--${s}" data-room="${h.id}" aria-pressed="${s === "pick"}" ${s === "full" ? 'aria-disabled="true"' : ""}>
        <b>${U.esc(h.name)}</b><span>${s === "idle" ? "เลือกวันก่อน" : label[s]}</span></button>`;
    }).join("");
    if (S.free) {
      $("#mapHint").textContent = `ว่าง ${S.free.length} จาก ${TOTAL} ห้อง · ผู้เข้าพัก ${guests()} ท่าน ต้องใช้อย่างน้อย ${need()} ห้อง · กดที่ห้องเพื่อเลือก`;
    }
  }
  $("#roomMap").addEventListener("click", (e) => {
    const b = e.target.closest("[data-room]"); if (!b) return;
    const id = Number(b.dataset.room), s = roomState(id);
    if (s === "idle") { $("#plans").innerHTML = `<p class="form__error">กรุณาเลือกวันเข้าพักแล้วกด "ค้นหาห้องว่าง" ก่อนเลือกห้อง</p>`; fp.open(); return; }
    if (s === "full") { flash(b); toastMsg(`${U.houseName(id)} เต็มในวันที่เลือก กรุณาเลือกห้องอื่น`); return; }
    if (s === "pick") S.rooms = S.rooms.filter((r) => r !== id);
    else if (need() === 1 && S.rooms.length >= 1) S.rooms = [id];
    else S.rooms = [...S.rooms, id].sort((a, z) => a - z);
    fitExtraBeds(); renderMap(); renderPlans();
  });
  function flash(el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
  function toastMsg(t) {
    const p = $("#plans"); const old = $(".map-msg", p); if (old) old.remove();
    p.insertAdjacentHTML("afterbegin", `<p class="form__error map-msg">${U.esc(t)}</p>`);
  }
  function fitExtraBeds() {
    const cap = S.rooms.length * (C.maxGuestsPerHouse - C.baseGuestsPerHouse);
    S.extraBeds = Math.min(cap, Math.max(0, guests() - S.rooms.length * C.baseGuestsPerHouse));
    $("#extraBeds").textContent = S.extraBeds;
  }

  /* ================= ค้นหาห้องว่าง ================= */
  $("#btnSearch").addEventListener("click", () => search());

  async function search(msg) {
    const out = $("#result");
    if (!S.checkIn || !S.checkOut) { out.innerHTML = `<p class="form__error">กรุณาเลือกวันเข้าพักและวันออก</p>`; fp.open(); return; }
    const nights = U.nightsBetween(S.checkIn, S.checkOut).length;
    if (nights > C.maxNights) { out.innerHTML = `<p class="form__error">จองออนไลน์ได้สูงสุด ${C.maxNights} คืน กรุณาติดต่อเราโดยตรง</p>`; return; }
    if (need() > TOTAL) { out.innerHTML = `<p class="form__error">ผู้เข้าพักเกิน ${TOTAL * C.maxGuestsPerHouse} ท่าน กรุณาติดต่อเราโดยตรง</p>`; return; }
    out.innerHTML = `<div class="loader">กำลังค้นหาห้องว่าง...</div>`;

    try {
      const occ = await DB.getOccupied(S.checkIn, U.addDays(S.checkIn, 30 + nights));
      S.free = freeHouses(occ, S.checkIn, S.checkOut);
      S.rooms = S.rooms.filter((r) => S.free.includes(r));
      if (S.free.length >= need()) {
        if (S.rooms.length < need()) S.rooms = pickRooms(S.free, need());
        fitExtraBeds();
        out.innerHTML = `
          <div class="res res--ok res--slim">
            ${typeof msg === "string" ? `<p class="form__error">${msg}</p>` : ""}
            <h4>🎉 มีห้องว่าง ${S.free.length} จาก ${TOTAL} ห้อง</h4>
            <p class="muted">${U.thDate(S.checkIn)} – ${U.thDate(S.checkOut)} · ${nights} คืน · ${guests()} ท่าน · ระบบเลือกห้องให้แล้ว เปลี่ยนได้จากแผนที่ด้านล่าง</p>
          </div>`;
      } else {
        S.rooms = [];
        const alts = findAlternatives(occ, nights, need());
        out.innerHTML = `
          <div class="res res--no">
            <div><h4>ขออภัย ช่วงวันที่นี้ห้องว่างไม่พอ</h4>
            <p class="muted">ว่าง ${S.free.length} ห้อง แต่ต้องใช้ ${need()} ห้องสำหรับ ${guests()} ท่าน</p></div>
            ${alts.length ? `<div class="res__alt"><span class="muted" style="width:100%">ลองวันอื่นที่ว่าง:</span>${alts.map((a) =>
              `<button data-ci="${a}">${U.thDate(a, { day: "numeric", month: "short" })} – ${U.thDate(U.addDays(a, nights), { day: "numeric", month: "short" })}</button>`).join("")}</div>` : ""}
          </div>`;
        $$(".res__alt button", out).forEach((b) => b.onclick = () => {
          S.checkIn = b.dataset.ci; S.checkOut = U.addDays(S.checkIn, nights);
          fp.setDate([U.fromKey(S.checkIn), U.fromKey(S.checkOut)], false); search();
        });
      }
      renderMap(); renderPlans();
    } catch (e) {
      console.error(e);
      out.innerHTML = `<p class="form__error">เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>`;
    }
  }

  function renderPlans() {
    const p = $("#plans");
    if (!S.free || S.free.length < need()) { p.innerHTML = ""; return; }
    if (S.rooms.length < need()) {
      p.innerHTML = `<p class="plans-hint">ผู้เข้าพัก ${guests()} ท่าน ต้องเลือกอย่างน้อย <b>${need()} ห้อง</b> (เลือกแล้ว ${S.rooms.length} ห้อง) กดเลือกห้องที่ว่างจากแผนที่</p>`;
      return;
    }
    const nights = U.nightsBetween(S.checkIn, S.checkOut).length, n = S.rooms.length;
    S.quote = U.quote(S.checkIn, S.checkOut, n, S.extraBeds, S.rate);
    p.innerHTML = `
      <div class="res res--ok">
        <p class="picked">ห้องที่เลือก: ${S.rooms.map((r) => `<b>${U.esc(U.houseName(r))}</b>`).join(" ")}${S.extraBeds ? ` · เตียงเสริม ${S.extraBeds}` : ""}</p>
        <div class="plans" role="radiogroup" aria-label="เลือกแพ็กเกจ">${C.rates.map((r) => {
          const q = U.quote(S.checkIn, S.checkOut, n, S.extraBeds, r.id);
          return `<label class="plan"><input type="radio" name="rate" value="${r.id}" ${r.id === S.rate ? "checked" : ""} />
            <span class="plan__box"><span class="plan__name">${U.esc(r.name)}</span>
            <span class="plan__per">${U.money(r.price)} / คืน / ห้อง</span>
            <span class="plan__total">${q.regular > q.total ? `<s>${U.money(q.regular)}</s>` : ""}<b>${U.money(q.total)}</b></span>
            <span class="plan__note">รวม ${nights} คืน · ${n} ห้อง${S.extraBeds ? " + เตียงเสริม" : ""}</span></span></label>`; }).join("")}</div>
        <div class="res__next"><button class="btn" id="btnNext">จองห้องนี้ →</button></div>
      </div>`;
    $$('input[name="rate"]', p).forEach((i) => i.onchange = () => { S.rate = i.value; });
    $("#btnNext").onclick = () => goStep(2);
  }

  function regularHTML(q) {
    const save = q.regular - q.total;
    return save > 0 ? `<s>${U.money(q.regular)}</s> <span class="save">ประหยัด ${U.money(save)}</span>` : "";
  }
  function freeHouses(occ, a, b) {
    const busy = new Set(occ.filter((n) => n.date >= a && n.date < b).map((n) => Number(n.room)));
    return C.houses.map((h) => h.id).filter((id) => !busy.has(id));
  }
  function pickRooms(free, n) {
    const keep = S.rooms.filter((r) => free.includes(r));
    const rest = free.filter((r) => !keep.includes(r));
    for (let i = 0; i + (n - keep.length) <= rest.length && !keep.length; i++) {
      const s = rest.slice(i, i + n);
      if (s.length === n && s[n - 1] - s[0] === n - 1) return s;
    }
    return [...keep, ...rest].slice(0, n).sort((a, z) => a - z);
  }
  function findAlternatives(occ, nights, n) {
    const res = [];
    for (let d = 1; d <= 30 && res.length < 4; d++) {
      const ci = U.addDays(S.checkIn, d);
      if (freeHouses(occ, ci, U.addDays(ci, nights)).length >= n) res.push(ci);
    }
    return res;
  }

  /* ================= สลับขั้นตอน ================= */
  function goStep(n) {
    $$(".step").forEach((s) => s.classList.toggle("is-active", s.dataset.step == n));
    $$("#steps li").forEach((li, i) => {
      li.classList.toggle("is-active", i + 1 === n);
      li.classList.toggle("is-done", typeof n === "number" && i + 1 < n);
    });
    if (n === 2) { renderSummary(); syncTimes(); }
    $(".book").scrollIntoView({ behavior: "smooth" });
  }
  $("#btnBack").onclick = () => goStep(1);

  /* ---------- เวลาเช็กอินก่อนเวลา / เวลารับอาหารเช้า ---------- */
  $("#earlyTime").innerHTML = C.earlyCheckInTimes.map((t) => `<option>${t}</option>`).join("");
  const syncTimes = () => {
    $("#earlyField").hidden = !$("#earlyChk").checked;
    $("#bfField").hidden = ![S.rate, ...S.cart.map((x) => x.rate)].some((id) => U.rate(id).breakfast);
  };
  $("#earlyChk").addEventListener("change", syncTimes);

  /* รายการหลัก (จากขั้นที่ 1) + รายการที่จองเพิ่ม */
  function mainItem() {
    const q = U.quote(S.checkIn, S.checkOut, S.rooms.length, S.extraBeds, S.rate);
    return { checkIn: S.checkIn, checkOut: S.checkOut, nights: q.nights, rooms: S.rooms.slice(), adults: S.adults, children: S.children,
             extraBeds: S.extraBeds, rate: q.rate.id, rateName: q.rate.name, total: q.total, regular: q.regular, room: q.room, extra: q.extra };
  }
  const allItems = () => [mainItem(), ...S.cart];
  const pairsOf = (items) => items.flatMap((it) => it.rooms.flatMap((r) => U.nightsBetween(it.checkIn, it.checkOut).map((d) => d + "_" + r)));
  function cartClash() {
    const seen = new Set();
    return pairsOf(allItems()).some((k) => (seen.has(k) ? true : (seen.add(k), false)));
  }

  function renderSummary() {
    if (!S.checkIn || !S.rooms.length) return;
    S.quote = U.quote(S.checkIn, S.checkOut, S.rooms.length, S.extraBeds, S.rate);
    const items = allItems(), multi = items.length > 1;
    const total = items.reduce((t, x) => t + x.total, 0), regular = items.reduce((t, x) => t + (x.regular || x.total), 0);
    const block = (it, i) => `
      <div class="sumitem">
        ${multi ? `<div class="sumitem__head"><b>การจองที่ ${i + 1}</b>${i ? `<button type="button" class="sumitem__x" data-rm="${i - 1}" aria-label="ลบรายการนี้">ลบ ×</button>` : ""}</div>` : ""}
        <dl>
          <dt>เช็กอิน</dt><dd>${U.thDate(it.checkIn)} · ${C.checkInTime}</dd>
          <dt>เช็กเอาต์</dt><dd>${U.thDate(it.checkOut)} · ${C.checkOutTime}</dd>
          <dt>ผู้เข้าพัก</dt><dd>${it.adults} ผู้ใหญ่${it.children ? ", " + it.children + " เด็ก" : ""}</dd>
          <dt>ห้องพัก</dt><dd>${it.rooms.map(U.houseName).join(", ")}</dd>
          <dt>แพ็กเกจ</dt><dd>${U.esc(it.rateName)}</dd>
          <dt>ค่าห้อง ${it.nights} คืน</dt><dd>${U.money(it.total - (it.extraBeds ? it.nights * it.extraBeds * C.extraBedPrice : 0))}</dd>
          ${it.extraBeds ? `<dt>เตียงเสริม ×${it.extraBeds}</dt><dd>${U.money(it.nights * it.extraBeds * C.extraBedPrice)}</dd>` : ""}
          ${multi ? `<dt>รวมรายการนี้</dt><dd><b>${U.money(it.total)}</b></dd>` : ""}
        </dl>
      </div>`;
    $("#summary").innerHTML = `
      <h4>สรุปการจอง</h4>
      ${items.map(block).join("")}
      ${cartClash() ? `<p class="sum-warn">⚠️ มีห้องที่จองซ้ำวันกัน กรุณาลบรายการที่ซ้ำ</p>` : ""}
      <button type="button" class="addmore" id="btnAddMore">＋ จองห้องพักเพิ่ม</button>
      <div class="total"><span>ยอดชำระ${multi ? "ทั้งหมด" : ""} ${regularHTML({ regular, total })}</span><b>${U.money(total)}</b></div>
      <small>ขั้นตอนถัดไป: โอนชำระเงินและแนบสลิป</small>`;
    $("#btnAddMore").onclick = openAdd;
    $$("[data-rm]", $("#summary")).forEach((b) => (b.onclick = () => { S.cart.splice(+b.dataset.rm, 1); renderSummary(); syncTimes(); }));
  }

  /* ================= Popup จองห้องพักเพิ่ม ================= */
  const A = { checkIn: null, checkOut: null, adults: 2, children: 0, free: null, rooms: [], rate: C.defaultRate || C.rates[0].id, occ: [] };
  document.body.insertAdjacentHTML("beforeend", `
    <div class="bk-modal" id="addModal" hidden>
      <div class="bk-modal__card add-card" role="dialog" aria-modal="true" aria-labelledby="addTitle">
        <button type="button" class="bk-modal__x" id="addClose" aria-label="ปิด">×</button>
        <h3 id="addTitle">จองห้องพักเพิ่ม</h3>
        <p class="muted small">เลือกวัน จำนวนผู้เข้าพัก และห้องที่ต้องการ แล้วกด "เพิ่มเข้าการจอง" ใช้รหัสการจองเดียวกัน</p>
        <label class="field"><span>วันเข้าพัก – วันออก</span><input id="addDates" placeholder="แตะเพื่อเลือกวัน" readonly /></label>
        <div class="add-guests">
          <div class="extra"><div><b>ผู้ใหญ่</b></div><div class="counter" data-afor="adults"><button type="button" data-d="-1">−</button><b id="addAdults">2</b><button type="button" data-d="1">+</button></div></div>
          <div class="extra"><div><b>เด็ก</b></div><div class="counter" data-afor="children"><button type="button" data-d="-1">−</button><b id="addChildren">0</b><button type="button" data-d="1">+</button></div></div>
        </div>
        <button type="button" class="btn add-search" id="addSearch">ค้นหาห้องว่าง</button>
        <div id="addResult"></div>
        <div class="add-rooms" id="addRooms" hidden>
          <div class="roommap__img"><img src="${U.esc(C.roomMapImage)}" alt="แผนที่บ้านพัก" /><div id="addPins"></div></div>
          <div class="roompick" id="addPick"></div>
          <div class="plans add-plans" id="addPlans" role="radiogroup" aria-label="เลือกแพ็กเกจ"></div>
        </div>
        <p class="form__error" id="addErr"></p>
        <button type="button" class="btn add-go" id="addConfirm" disabled>เพิ่มเข้าการจอง</button>
      </div>
    </div>`);
  const AM = $("#addModal");
  const afp = flatpickr("#addDates", {
    mode: "range", minDate: "today", dateFormat: "Y-m-d", locale: "th", disableMobile: true, static: true,
    altInput: true, altFormat: "j M Y",
    onChange(d) { if (d.length === 2) { A.checkIn = U.toKey(d[0]); A.checkOut = U.toKey(d[1]); addSearch(); } else { A.checkIn = A.checkOut = null; } }
  });
  function openAdd() {
    A.free = null; A.rooms = []; $("#addErr").textContent = ""; $("#addResult").innerHTML = ""; $("#addRooms").hidden = true;
    A.checkIn = A.checkOut = null; afp.clear(); $("#addConfirm").disabled = true;
    AM.hidden = false; document.body.classList.add("no-scroll");
  }
  const closeAdd = () => { AM.hidden = true; document.body.classList.remove("no-scroll"); };
  $("#addClose").onclick = closeAdd;
  AM.addEventListener("click", (e) => { if (e.target === AM) closeAdd(); });
  $$("[data-afor]", AM).forEach((c) => c.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const k = c.dataset.afor, lim = k === "adults" ? [1, 15] : [0, 10];
    A[k] = Math.max(lim[0], Math.min(lim[1], A[k] + Number(b.dataset.d)));
    $(k === "adults" ? "#addAdults" : "#addChildren").textContent = A[k];
    if (A.free) addSearch();
  }));
  const aGuests = () => A.adults + A.children, aNeed = () => U.housesNeeded(aGuests());
  const aBeds = () => Math.min(A.rooms.length * (C.maxGuestsPerHouse - C.baseGuestsPerHouse), Math.max(0, aGuests() - A.rooms.length * C.baseGuestsPerHouse));
  $("#addSearch").onclick = () => addSearch();
  async function addSearch() {
    const out = $("#addResult"); $("#addErr").textContent = "";
    if (!A.checkIn || !A.checkOut) { out.innerHTML = `<p class="form__error">กรุณาเลือกวันเข้าพักและวันออก</p>`; afp.open(); return; }
    const n = U.nightsBetween(A.checkIn, A.checkOut).length;
    if (n > C.maxNights) { out.innerHTML = `<p class="form__error">จองออนไลน์ได้สูงสุด ${C.maxNights} คืน</p>`; return; }
    out.innerHTML = `<div class="loader">กำลังค้นหาห้องว่าง...</div>`;
    try {
      const occ = await DB.getOccupied(A.checkIn, A.checkOut);
      const mine = new Set(pairsOf(allItems()));
      const busy = new Set(occ.map((x) => Number(x.room)));
      U.nightsBetween(A.checkIn, A.checkOut).forEach((d) => C.houses.forEach((h) => { if (mine.has(d + "_" + h.id)) busy.add(h.id); }));
      A.free = C.houses.map((h) => h.id).filter((id) => !busy.has(id));
      A.rooms = A.rooms.filter((r) => A.free.includes(r));
      if (A.rooms.length < aNeed()) A.rooms = A.free.slice(0, aNeed());
      out.innerHTML = A.free.length >= aNeed()
        ? `<p class="add-ok">🎉 ว่าง ${A.free.length} จาก ${TOTAL} ห้อง · ${U.thDate(A.checkIn)} – ${U.thDate(A.checkOut)} · ${n} คืน · ${aGuests()} ท่าน</p>`
        : `<p class="form__error">ช่วงวันนี้ห้องว่างไม่พอ (ว่าง ${A.free.length} ห้อง ต้องใช้ ${aNeed()} ห้อง) ลองเลือกวันอื่นค่ะ</p>`;
      $("#addRooms").hidden = false; renderAdd();
    } catch (e) { console.error(e); out.innerHTML = `<p class="form__error">เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่</p>`; }
  }
  const aState = (id) => (!A.free ? "idle" : !A.free.includes(id) ? "full" : A.rooms.includes(id) ? "pick" : "free");
  function renderAdd() {
    $("#addPins").innerHTML = C.houses.map((h) => { const st = aState(h.id);
      return `<button type="button" class="pin pin--${st}" data-aroom="${h.id}" style="left:${h.x}%;top:${h.y}%">${pinText(h, st)}</button>`; }).join("");
    $("#addPick").innerHTML = C.houses.map((h) => { const st = aState(h.id);
      return `<button type="button" class="rp rp--${st}" data-aroom="${h.id}" aria-pressed="${st === "pick"}"><b>${U.esc(h.name)}</b><span>${label[st]}</span></button>`; }).join("");
    const ok = A.rooms.length >= aNeed() && A.rooms.length > 0;
    const nb = aBeds();
    $("#addPlans").innerHTML = !ok ? `<p class="plans-hint">ผู้เข้าพัก ${aGuests()} ท่าน ต้องเลือกอย่างน้อย <b>${aNeed()} ห้อง</b> (เลือกแล้ว ${A.rooms.length} ห้อง)</p>`
      : C.rates.map((r) => { const q = U.quote(A.checkIn, A.checkOut, A.rooms.length, nb, r.id);
        return `<label class="plan"><input type="radio" name="arate" value="${r.id}" ${r.id === A.rate ? "checked" : ""} />
          <span class="plan__box"><span class="plan__name">${U.esc(r.name)}</span><span class="plan__per">${U.money(r.price)} / คืน / ห้อง</span>
          <span class="plan__total">${q.regular > q.total ? `<s>${U.money(q.regular)}</s>` : ""}<b>${U.money(q.total)}</b></span>
          <span class="plan__note">${q.nights} คืน · ${A.rooms.length} ห้อง${nb ? " + เตียงเสริม " + nb : ""}</span></span></label>`; }).join("");
    $$('input[name="arate"]', AM).forEach((i) => (i.onchange = () => (A.rate = i.value)));
    $("#addConfirm").disabled = !ok;
  }
  $("#addRooms").addEventListener("click", (e) => {
    const b = e.target.closest("[data-aroom]"); if (!b) return;
    const id = Number(b.dataset.aroom), st = aState(id);
    if (st === "full" || st === "idle") return;
    if (st === "pick") A.rooms = A.rooms.filter((r) => r !== id);
    else if (aNeed() === 1 && A.rooms.length >= 1) A.rooms = [id];
    else A.rooms = [...A.rooms, id].sort((a, z) => a - z);
    renderAdd();
  });
  $("#addConfirm").onclick = () => {
    if (S.cart.length >= 5) { $("#addErr").textContent = "จองเพิ่มได้สูงสุด 5 รายการต่อครั้ง"; return; }
    const nb = aBeds(), q = U.quote(A.checkIn, A.checkOut, A.rooms.length, nb, A.rate);
    S.cart.push({ checkIn: A.checkIn, checkOut: A.checkOut, nights: q.nights, rooms: A.rooms.slice(), adults: A.adults, children: A.children,
                  extraBeds: nb, rate: q.rate.id, rateName: q.rate.name, total: q.total, regular: q.regular });
    closeAdd(); renderSummary(); syncTimes();
  };

  /* ================= ส่งข้อมูลการจอง ================= */
  $("#guestForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, err = $("#formError"), btn = $("#btnSubmit");
    const name = f.name.value.trim(), phone = f.phone.value.trim(), email = f.email.value.trim();
    err.textContent = "";
    if (name.length < 2) return (err.textContent = "กรุณากรอกชื่อ–นามสกุล");
    if (!/^[0-9+\-\s]{9,15}$/.test(phone)) return (err.textContent = "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง");
    if (!/^\S+@\S+\.\S+$/.test(email)) return (err.textContent = "กรุณากรอกอีเมลให้ถูกต้อง");
    if (!f.agree.checked) return (err.textContent = "กรุณายอมรับเงื่อนไขการเข้าพัก");

    const requests = $$('input[name="req"]:checked', f).map((c) => c.value);
    const earlyTime = $("#earlyChk").checked ? f.earlyTime.value : "";
    const breakfastTime = "";
    if (earlyTime) requests[requests.indexOf("เช็กอินก่อนเวลา")] = "เช็กอินก่อนเวลา " + earlyTime + " น.";
    if (cartClash()) return (err.textContent = "มีห้องที่จองซ้ำวันกัน กรุณาลบรายการที่ซ้ำในสรุปการจอง");
    const items = allItems().map((it) => ({ checkIn: it.checkIn, checkOut: it.checkOut, nights: it.nights, rooms: it.rooms,
      adults: it.adults, children: it.children, extraBeds: it.extraBeds, rate: it.rate, rateName: it.rateName, total: it.total }));
    const beds = items.reduce((t, x) => t + x.extraBeds, 0);
    if (beds) requests.unshift("เตียงเสริม ×" + beds);
    const sum = (k) => items.reduce((t, x) => t + (+x[k] || 0), 0);
    const booking = {
      name, phone, email,
      arrivalTime: f.arrivalTime.value, note: f.note.value.trim().slice(0, 1000),
      checkIn: items.map((x) => x.checkIn).sort()[0], checkOut: items.map((x) => x.checkOut).sort().pop(), nights: sum("nights"),
      adults: items.length > 1 ? Math.max(...items.map((x) => x.adults)) : S.adults, children: items.length > 1 ? Math.max(...items.map((x) => x.children)) : S.children,
      rooms: [...new Set(items.flatMap((x) => x.rooms))].sort((a, z) => a - z),
      extraBeds: beds, babyChair: requests.includes("เก้าอี้เด็ก"), requests,
      rate: items[0].rate, rateName: [...new Set(items.map((x) => x.rateName))].join(" / "),
      earlyCheckIn: earlyTime, breakfastTime,
      total: sum("total"), status: "pending"
    };
    if (items.length > 1) booking.items = items;

    btn.disabled = true; btn.textContent = "กำลังส่งข้อมูล...";
    try {
      const res = await DB.createBooking(booking);
      store.set(LAST, res.key);
      sendEmails(res.booking);
      notifyBot("new", res.key, booking);
      f.reset(); S.cart = [];
      openGuest(res.key);
    } catch (ex) {
      console.error(ex);
      if (ex.message === "ROOM_TAKEN") {
        goStep(1); S.rooms = [];
        search("มีผู้จองห้องที่เลือกไปก่อนหน้าเพียงไม่กี่วินาที ระบบเลือกห้องใหม่ให้แล้ว");
      } else err.textContent = "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อเราทางโทรศัพท์" + (ex.code ? " (" + String(ex.code).replace(/^firestore\//, "") + ")" : "");
    } finally { btn.disabled = false; btn.textContent = "ไปขั้นตอนชำระเงิน →"; }
  });
  $("#btnSubmit").textContent = "ไปขั้นตอนชำระเงิน →";

  /* ================= ติดตามสถานะการจอง (ขั้น 3–4) ================= */
  function openGuest(key) {
    if (unwatch) unwatch();
    let lastState = null;
    unwatch = DB.watchGuestView(key, (v) => {
      if (!v) return;
      if (v.state === lastState && v.state !== "awaiting_payment") return;
      if (v.state === "awaiting_payment" && lastState === "awaiting_payment") return;
      lastState = v.state;
      if (v.state === "awaiting_payment") { renderPay(key, v); goStep(3); }
      else if (v.state === "slip") { renderWaiting(key, v); goStep(3); }
      else if (v.state === "confirmed") { renderConfirm(v); goStep(4); }
      else { renderCancelled(v); goStep(4); }
    });
  }

  const codeBlock = (v) => `
    <div class="codebox">
      <span class="codebox__label">รหัสการจอง</span>
      <b class="codebox__code">${U.esc(v.code)}</b>
      <small>${U.esc(C.stayGuide.codeNote)}</small>
    </div>`;
  const stayLine = (v) => U.items(v).map((it) => `${it.rooms.map((r) => U.esc(U.houseName(r))).join(", ")} · ${U.span(it)}`).join("<br>");
  const contactBtns = `<div class="contact-btns"><a class="btn" href="${telHref}">📞 โทรหาเรา</a><a class="btn btn--line" href="${lineHref}" target="_blank" rel="noopener">💬 ติดต่อผ่านไลน์</a></div>`;

  /* รายการรหัสเปิดห้อง (หลายห้อง = หลายรหัส) */
  function doorList(v, cls) {
    const rows = U.items(v).flatMap((it, i, all) => it.rooms.map((r) => ({ r, code: U.doorFor(v, i, r), it, multi: all.length > 1 })));
    if (rows.length === 1) return `<b class="${cls === "cf" ? "cf__big cf__door" : ""}">${U.esc(rows[0].code || "------")}</b>`;
    return `<ul class="doors doors--${cls}">${rows.map((x) => `<li><span>${U.esc(U.houseName(x.r))}${x.multi ? ` <small>${U.thDate(x.it.checkIn, { day: "numeric", month: "short" })}–${U.thDate(x.it.checkOut, { day: "numeric", month: "short" })}</small>` : ""}</span><b>${U.esc(x.code || "------")}</b></li>`).join("")}</ul>`;
  }

  function renderPay(key, v) {
    const P = C.payment;
    $("#pay").innerHTML = `
      <div class="pay__grid">
        <div class="pay__bank">
          <img src="${U.esc(P.image)}" alt="บัญชีสำหรับโอนชำระ ${U.esc(P.bank)} ${U.esc(P.accountNo)}" />
          <div class="acct">
            <span class="muted small">${U.esc(P.bank)}</span>
            <div class="acct__row"><b class="acct__no">${U.esc(P.accountNo)}</b><button type="button" class="copy" data-copy="${U.esc(P.accountNo.replace(/-/g, ""))}">คัดลอกเลขบัญชี</button></div>
            <span>ชื่อบัญชี ${U.esc(P.accountName)}</span>
          </div>
        </div>
        <div class="pay__side">
          ${codeBlock(v)}
          <dl class="pay__dl">
            <dt>ห้องพักและวันที่</dt><dd>${stayLine(v)}</dd>
            ${v.rateName ? `<dt>แพ็กเกจ</dt><dd>${U.esc(v.rateName)}</dd>` : ""}
          </dl>
          <div class="pay__amount"><span>ยอดที่ต้องโอน</span><b>${U.money(v.total)}</b></div>
          <form class="slip" id="slipForm" method="post" action="javascript:void(0)">
            <label class="slip__drop" for="slipFile">
              <input type="file" id="slipFile" accept="image/*" />
              <img id="slipPreview" alt="ตัวอย่างสลิป" hidden />
              <span id="slipText"><b>แนบสลิปการโอน</b><small>แตะเพื่อเลือกรูปสลิป (JPG / PNG)</small></span>
            </label>
            <p class="form__error" id="slipErr"></p>
            <button type="submit" class="btn" id="slipBtn" disabled>ส่งสลิปยืนยันการชำระเงิน</button>
          </form>
          <p class="muted small">เก็บรหัสการจองไว้ หากปิดหน้านี้ไปก่อน กลับมาแนบสลิปได้ที่ “มีรหัสการจองแล้ว?” ในส่วนจองห้องพัก</p>
        </div>
      </div>`;
    let data = null;
    $("#slipFile").onchange = async (e) => {
      const file = e.target.files[0]; $("#slipErr").textContent = ""; if (!file) return;
      try {
        data = await U.compressImage(file);
        $("#slipPreview").src = data; $("#slipPreview").hidden = false;
        $("#slipText").innerHTML = `<b>${U.esc(file.name)}</b><small>แตะเพื่อเปลี่ยนรูป</small>`;
        $("#slipBtn").disabled = false;
      } catch (ex) { data = null; $("#slipErr").textContent = "ไฟล์นี้ไม่ใช่รูปภาพ กรุณาเลือกรูปสลิป"; $("#slipBtn").disabled = true; }
    };
    $("#slipForm").onsubmit = async (e) => {
      e.preventDefault(); if (!data) return;
      const b = $("#slipBtn"); b.disabled = true; b.textContent = "กำลังส่งสลิป...";
      try { await DB.uploadSlip(key, v, data); notifyBot("slip", key); }
      catch (ex) { console.error(ex); $("#slipErr").textContent = "ส่งสลิปไม่สำเร็จ กรุณาลองใหม่ หรือส่งสลิปทาง LINE"; b.disabled = false; b.textContent = "ส่งสลิปยืนยันการชำระเงิน"; }
    };
  }

  function renderWaiting(key, v) {
    $("#pay").innerHTML = `
      <div class="wait">
        <div class="wait__icon" aria-hidden="true"><span></span></div>
        <h3>ได้รับสลิปแล้ว ขอบคุณค่ะ</h3>
        <p class="muted">เจ้าหน้าที่กำลังตรวจสอบการชำระเงิน เมื่อยืนยันแล้ว หน้านี้จะแสดงรหัสเปิดห้องให้อัตโนมัติ<br />หรือกลับมาดูภายหลังด้วยรหัสการจองได้</p>
        ${codeBlock(v)}
        <p>${stayLine(v)} · ${U.money(v.total)}</p>
        ${contactBtns}
      </div>`;
  }

  function renderConfirm(v) {
    const G = C.stayGuide;
    const fmt = (t) => U.esc(t).replace(/\*\*\*(.+?)\*\*\*/g, "<b>$1</b>");
    $("#confirmBox").innerHTML = `
      <div class="cf">
        <div class="done__icon"><svg viewBox="0 0 52 52"><path d="M14 27l8 8 16-17"/></svg></div>
        <h3>ยืนยันการจองเรียบร้อยแล้ว</h3>
        <p class="cf__thanks">${U.esc(G.thanks)}</p>
        <div class="cf__cards">
          <div class="cf__card">
            <span class="cf__n">1</span><span class="cf__label">รหัสการจอง</span>
            <b class="cf__big">${U.esc(v.code)}</b>
            <small>${U.esc(G.codeNote)}</small>
          </div>
          <div class="cf__card">
            <span class="cf__n">2</span><span class="cf__label">ห้องพักและวันที่เข้าพัก</span>
            ${U.items(v).map((it) => `<b class="cf__room">${it.rooms.map((r) => U.esc(U.houseName(r))).join(", ")}</b>
            <span>เช็กอิน ${U.thDate(it.checkIn, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${C.checkInTime} น.</span>
            <span>เช็กเอาต์ ${U.thDate(it.checkOut, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${C.checkOutTime} น.</span>`).join('<hr class="cf__hr" />')}
          </div>
          <div class="cf__card cf__card--door">
            <span class="cf__n">3</span><span class="cf__label">รหัสเปิดห้อง</span>
            ${doorList(v, "cf")}
            <small>${U.esc(G.doorNote)}</small>
          </div>
        </div>
        <div class="cf__guide">
          <h4>${U.esc(G.title)}</h4>
          <ol>${G.steps.map((t) => `<li>${fmt(t)}</li>`).join("")}</ol>
        </div>
        ${contactBtns}
        <p class="cf__more"><button type="button" class="linkbtn" id="copyAll">คัดลอกข้อมูลการจองทั้งหมด</button> · <button type="button" class="linkbtn" onclick="location.reload()">จองห้องเพิ่ม</button></p>
      </div>`;
    $("#copyAll").onclick = (e) => copy(U.confirmText(v), e.target);
  }

  function renderCancelled(v) {
    $("#confirmBox").innerHTML = `
      <div class="wait">
        <h3>การจอง ${U.esc(v.code)} ถูกยกเลิกแล้ว</h3>
        <p class="muted">หากมีข้อสงสัย กรุณาติดต่อเจ้าหน้าที่</p>
        ${contactBtns}
      </div>`;
  }

  /* ---------- คัดลอก ---------- */
  function copy(text, btn) {
    const done = () => { const t = btn.textContent; btn.textContent = "คัดลอกแล้ว ✓"; setTimeout(() => (btn.textContent = t), 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {} ta.remove();
    }
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-copy]"); if (b) copy(b.dataset.copy, b); });

  /* ================= ดูสถานะด้วยรหัส ================= */
  $("#openLookup").onclick = () => goStep("lookup");
  $("#lkBack").onclick = () => goStep(1);
  $("#lookupForm").onsubmit = async (e) => {
    e.preventDefault();
    const code = $("#lkCode").value.trim().toUpperCase(), ph = $("#lkPhone").value.trim();
    const err = $("#lkError"); err.textContent = "";
    if (!/^[A-Z0-9]{4}$/.test(code)) return (err.textContent = "รหัสการจองมี 4 หลัก (ตัวอักษรภาษาอังกฤษและตัวเลข)");
    if (!/^\d{4}$/.test(ph)) return (err.textContent = "กรุณากรอกเบอร์โทร 4 ตัวท้าย");
    const key = code + "-" + ph;
    try {
      const v = await DB.getGuestView(key);
      if (!v) return (err.textContent = "ไม่พบการจองนี้ กรุณาตรวจสอบรหัสและเบอร์โทรอีกครั้ง");
      store.set(LAST, key); openGuest(key);
    } catch (ex) { console.error(ex); err.textContent = "เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่"; }
  };
  $("#lkCode").addEventListener("input", (e) => (e.target.value = e.target.value.toUpperCase()));

  // เตือนถ้ามีการจองค้างชำระในเครื่องนี้
  (async () => {
    const key = store.get(LAST); if (!key) return;
    try {
      const v = await DB.getGuestView(key);
      if (!v || !["awaiting_payment", "slip", "confirmed"].includes(v.state)) return;
      const txt = { awaiting_payment: "รอชำระเงิน", slip: "รอตรวจสอบสลิป", confirmed: "ยืนยันแล้ว" }[v.state];
      $("#openLookup").insertAdjacentHTML("beforebegin",
        `<button type="button" class="resume" id="resume">การจอง <b>${U.esc(v.code)}</b> ของคุณ · ${txt} — ดูรายละเอียด →</button><br />`);
      $("#resume").onclick = () => openGuest(key);
    } catch (e) {}
  })();

  /* ================= Popup เช็กข้อมูลการจอง (ปุ่มหน้าแรก) ================= */
  const M = $("#bkModal");
  const openM = () => {
    $("#bkmForm").hidden = false; $("#bkmResult").hidden = true; $("#bkmError").textContent = "";
    M.hidden = false; document.body.classList.add("no-scroll"); setTimeout(() => $("#bkmCode").focus(), 50);
  };
  const closeM = () => { M.hidden = true; document.body.classList.remove("no-scroll"); if (M._watch) { M._watch(); M._watch = null; } };
  $("#heroLookup").onclick = openM;
  $("#bkmClose").onclick = closeM;
  M.addEventListener("click", (e) => { if (e.target === M) closeM(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !M.hidden) closeM(); });
  $("#bkmCode").addEventListener("input", (e) => (e.target.value = e.target.value.toUpperCase()));
  $("#bkmForm").onsubmit = async (e) => {
    e.preventDefault();
    const code = $("#bkmCode").value.trim().toUpperCase(), ph = $("#bkmPhone").value.trim();
    const err = $("#bkmError"), btn = $(".bk-modal__go"); err.textContent = "";
    if (!/^[A-Z0-9]{4}$/.test(code)) return (err.textContent = "รหัสการจองมี 4 หลัก (ตัวอักษรภาษาอังกฤษและตัวเลข)");
    if (!/^\d{4}$/.test(ph)) return (err.textContent = "กรุณากรอกเบอร์โทร 4 ตัวท้าย");
    const key = code + "-" + ph;
    btn.disabled = true; btn.textContent = "กำลังค้นหา...";
    try {
      const v = await DB.getGuestView(key);
      if (!v) { err.textContent = "ไม่พบการจองนี้ กรุณาตรวจสอบรหัสและเบอร์โทรอีกครั้ง"; return; }
      store.set(LAST, key); showSummary(key, v);
    } catch (ex) { console.error(ex); err.textContent = "เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่"; }
    finally { btn.disabled = false; btn.textContent = "ยืนยัน"; }
  };
  function showSummary(key, v) {
    const ST = { awaiting_payment: ["รอชำระเงิน", "wait"], slip: ["รอตรวจสอบสลิป", "wait"], confirmed: ["ยืนยันแล้ว", "ok"], cancelled: ["ยกเลิกแล้ว", "no"] };
    const st = ST[v.state] || [v.state, "wait"], its = U.items(v);
    const d = (k) => U.thDate(k, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const ds = (k) => U.thDate(k, { day: "numeric", month: "short", year: "2-digit" });
    const guests = v.adults != null && (v.adults || v.children) ? "ผู้ใหญ่ " + v.adults + (v.children ? " · เด็ก " + v.children : "") : "";
    const bf = its.some((it) => /อาหารเช้า/.test(it.rateName || "") && !/ไม่รวม/.test(it.rateName || ""));
    const row = (ic, label, val) => val ? `<li><i>${ic}</i><span>${label}</span><b>${val}</b></li>` : "";
    const door = v.state === "confirmed" && v.doorCode;
    $("#bkmResult").innerHTML = `
      <div class="bks">
        <p class="bks__code">การจอง <b>#${U.esc(v.code)}</b> <span class="bks__st bks__st--${st[1]}">${st[0]}</span></p>
        ${door
          ? `<div class="bks__door"><span>🔑 รหัสเปิดห้อง</span>${doorList(v, "bks")}<small>${U.esc(C.stayGuide.doorNote)}</small></div>`
          : v.state === "cancelled" ? ""
          : `<div class="bks__door bks__door--wait"><span>🔑 รหัสเปิดห้อง</span><b>– – – – – –</b><small>${v.state === "slip"
              ? "รหัสจะแสดงที่นี่ทันทีเมื่อเจ้าหน้าที่ตรวจสลิปและยืนยันการจองแล้วค่ะ"
              : "รหัสจะแสดงที่นี่หลังชำระเงิน แนบสลิป และเจ้าหน้าที่ยืนยันการจองแล้วค่ะ"}</small></div>`}
        <ul class="bks__list">
          ${row("👤", "ชื่อผู้จอง", U.esc(v.guestName || ""))}
          ${its.length > 1 ? its.map((it, i) => row("🏡", "การจองที่ " + (i + 1), `${it.rooms.map((r) => U.esc(U.houseName(r))).join(", ")}<br><span class="bks__sub">เช็กอิน ${ds(it.checkIn)} · ${C.checkInTime} น.<br>เช็กเอาต์ ${ds(it.checkOut)} · ${C.checkOutTime} น. (${it.nights} คืน)<br>ผู้ใหญ่ ${it.adults}${it.children ? " · เด็ก " + it.children : ""} · ${U.esc(it.rateName)} · ${U.money(it.total)}</span>`)).join("") : `
          ${row("🏡", "ห้องพัก", (v.rooms || []).map((r) => U.esc(U.houseName(r))).join(", "))}
          ${row("📅", "เช็กอิน", d(v.checkIn) + " · " + C.checkInTime + " น.")}
          ${row("📅", "เช็กเอาต์", d(v.checkOut) + " · " + C.checkOutTime + " น.")}
          ${row("🌙", "จำนวนคืน", v.nights + " คืน")}
          ${row("👥", "ผู้เข้าพัก", guests)}
          ${row("🍽", "แพ็กเกจ", U.esc(v.rateName || ""))}`}
          ${row("⏰", "เวลามาถึง", v.earlyCheckIn ? "ขอเช็กอินก่อนเวลา " + U.esc(v.earlyCheckIn) + " น." : U.esc(v.arrivalTime || ""))}
          ${row("📝", "คำขอเพิ่มเติม", (v.requests || []).filter((x) => !/^เช็กอินก่อนเวลา/.test(x)).map(U.esc).join(", "))}
          ${row("💰", "ยอดรวม", U.money(v.total))}
        </ul>
        ${bf ? `<p class="bf-note">🍳 *อาหารเช้าสามารถเสิร์ฟได้ตั้งแต่ 08.30น. ค่ะ</p>` : ""}
        ${v.state === "awaiting_payment" ? `<button type="button" class="btn bks__pay" id="bkmPay">ไปชำระเงิน / แนบสลิป →</button>` : ""}
        ${v.state === "slip" ? `<p class="muted small center">ได้รับสลิปแล้ว เจ้าหน้าที่จะตรวจสอบและยืนยันการจองโดยเร็วที่สุดค่ะ</p>` : ""}
        ${contactBtns}
      </div>`;
    $("#bkmForm").hidden = true; $("#bkmResult").hidden = false;
    if (!M._watch && v.state !== "confirmed" && v.state !== "cancelled") {
      let first = true;
      M._watch = DB.watchGuestView(key, (nv) => {
        if (first) { first = false; return; }
        if (nv && !M.hidden && nv.state !== v.state) { M._watch(); M._watch = null; showSummary(key, nv); }
      });
    }
    const pay = $("#bkmPay");
    if (pay) pay.onclick = () => { closeM(); openGuest(key); };
  }

  renderMap();
})();
