/* Stay @Phukphol — ระบบจองห้องพัก (ฝั่งลูกค้า) */
(function () {
  const { C, U, DB, sendEmails } = window.SP;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TOTAL = C.houses.length;

  if (DB.mode === "demo") $("#demoNote").hidden = false;
  $("#extraBedHint").textContent = "+" + U.money(C.extraBedPrice) + " / คืน / เตียง";

  const S = { checkIn: null, checkOut: null, adults: 2, children: 0, extraBeds: 0, rooms: [], quote: null };
  let fullDates = new Set();

  /* ---------- ปฏิทินเลือกวัน ---------- */
  const fp = flatpickr("#dates", {
    mode: "range", minDate: "today", dateFormat: "Y-m-d", locale: "th",
    showMonths: innerWidth > 760 ? 2 : 1, disableMobile: true,
    altInput: true, altFormat: "j M Y",
    onDayCreate(_, __, ___, el) {
      if (fullDates.has(U.toKey(el.dateObj))) { el.classList.add("is-full"); el.title = "เต็มแล้ว"; }
    },
    onChange(d) {
      if (d.length === 2) { S.checkIn = U.toKey(d[0]); S.checkOut = U.toKey(d[1]); }
      else { S.checkIn = S.checkOut = null; }
    }
  });
  // วาดวันที่เต็มเป็นขีดฆ่า (โหลดล่วงหน้า 6 เดือน)
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
    if (k === "extraBeds") max = S.rooms.length || 1;
    S[k] = Math.max(mn, Math.min(max, S[k] + Number(b.dataset.d)));
    $("#" + k).textContent = S[k];
    if (k === "extraBeds") renderSummary();
    else $("#result").innerHTML = "";
  }));

  /* ---------- ค้นหาห้องว่าง ---------- */
  $("#btnSearch").addEventListener("click", search);

  async function search(msg) {
    const out = $("#result");
    if (!S.checkIn || !S.checkOut) { out.innerHTML = `<p class="form__error">กรุณาเลือกวันเข้าพักและวันออก</p>`; fp.open(); return; }
    const nights = U.nightsBetween(S.checkIn, S.checkOut).length;
    if (nights > C.maxNights) { out.innerHTML = `<p class="form__error">จองออนไลน์ได้สูงสุด ${C.maxNights} คืน กรุณาติดต่อเราโดยตรง</p>`; return; }

    const guests = S.adults + S.children, need = U.housesNeeded(guests);
    out.innerHTML = `<div class="loader">กำลังค้นหาบ้านว่าง...</div>`;
    if (need > TOTAL) { out.innerHTML = `<p class="form__error">ผู้เข้าพักเกิน ${TOTAL * C.maxGuestsPerHouse} ท่าน กรุณาติดต่อเราโดยตรง</p>`; return; }

    try {
      // ดึงข้อมูลช่วงกว้างครั้งเดียว เพื่อหา "วันอื่นที่ว่าง" ด้วย
      const end = U.addDays(S.checkIn, 30 + nights);
      const occ = await DB.getOccupied(S.checkIn, end);
      const free = freeHouses(occ, S.checkIn, S.checkOut);

      if (free.length >= need) {
        S.rooms = pickRooms(free, need);
        S.extraBeds = Math.max(0, guests - need * C.baseGuestsPerHouse);
        $("#extraBeds").textContent = S.extraBeds;
        S.quote = U.quote(S.checkIn, S.checkOut, need, S.extraBeds);
        out.innerHTML = `
          <div class="res res--ok">
            <div>
              ${typeof msg === "string" ? `<p class="form__error">${msg}</p>` : ""}
              <h4>🎉 มีบ้านว่าง ${free.length} จาก ${TOTAL} หลัง</h4>
              <p class="muted">${U.thDate(S.checkIn)} – ${U.thDate(S.checkOut)} · ${nights} คืน · ${guests} ท่าน → ใช้ ${need} หลัง</p>
              <div class="houses-free">${C.houses.map((h) =>
                `<span class="${S.rooms.includes(h.id) ? "pick" : ""}" style="${free.includes(h.id) ? "" : "opacity:.35;text-decoration:line-through"}">${U.esc(h.name)}</span>`).join("")}</div>
            </div>
            <div class="res__price"><span class="muted">ราคารวมโดยประมาณ</span><b>${U.money(S.quote.total)}</b>
              <button class="btn" id="btnNext" style="margin-top:.6rem">จองบ้านหลังนี้ →</button></div>
          </div>`;
        $("#btnNext").onclick = () => goStep(2);
      } else {
        const alts = findAlternatives(occ, nights, need);
        out.innerHTML = `
          <div class="res res--no">
            <div><h4>ขออภัย ช่วงวันที่นี้บ้านว่างไม่พอ</h4>
            <p class="muted">ว่าง ${free.length} หลัง แต่ต้องใช้ ${need} หลังสำหรับ ${guests} ท่าน</p></div>
            ${alts.length ? `<div class="res__alt"><span class="muted" style="width:100%">ลองวันอื่นที่ว่าง:</span>${alts.map((a) =>
              `<button data-ci="${a}">${U.thDate(a, { day: "numeric", month: "short" })} – ${U.thDate(U.addDays(a, nights), { day: "numeric", month: "short" })}</button>`).join("")}</div>` : ""}
          </div>`;
        $$(".res__alt button", out).forEach((b) => b.onclick = () => {
          S.checkIn = b.dataset.ci; S.checkOut = U.addDays(S.checkIn, nights);
          fp.setDate([U.fromKey(S.checkIn), U.fromKey(S.checkOut)], false); search();
        });
      }
    } catch (e) {
      console.error(e);
      out.innerHTML = `<p class="form__error">เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>`;
    }
  }

  function freeHouses(occ, a, b) {
    const busy = new Set(occ.filter((n) => n.date >= a && n.date < b).map((n) => Number(n.room)));
    return C.houses.map((h) => h.id).filter((id) => !busy.has(id));
  }
  // พยายามเลือกบ้านที่เลขติดกัน
  function pickRooms(free, need) {
    for (let i = 0; i + need <= free.length; i++) {
      const s = free.slice(i, i + need);
      if (s[need - 1] - s[0] === need - 1) return s;
    }
    return free.slice(0, need);
  }
  function findAlternatives(occ, nights, need) {
    const res = [];
    for (let d = 1; d <= 30 && res.length < 4; d++) {
      const ci = U.addDays(S.checkIn, d);
      if (freeHouses(occ, ci, U.addDays(ci, nights)).length >= need) res.push(ci);
    }
    return res;
  }

  /* ---------- ขั้นตอน ---------- */
  function goStep(n) {
    $$(".step").forEach((s) => s.classList.toggle("is-active", s.dataset.step == n));
    $$("#steps li").forEach((li, i) => {
      li.classList.toggle("is-active", i + 1 === n);
      li.classList.toggle("is-done", i + 1 < n);
    });
    if (n === 2) renderSummary();
    $("#booking").scrollIntoView({ behavior: "smooth" });
  }
  $("#btnBack").onclick = () => goStep(1);

  function renderSummary() {
    if (!S.checkIn || !S.rooms.length) return;
    S.quote = U.quote(S.checkIn, S.checkOut, S.rooms.length, S.extraBeds);
    const q = S.quote;
    $("#summary").innerHTML = `
      <h4>สรุปการจอง</h4>
      <dl>
        <dt>เช็กอิน</dt><dd>${U.thDate(S.checkIn)} · ${C.checkInTime}</dd>
        <dt>เช็กเอาต์</dt><dd>${U.thDate(S.checkOut)} · ${C.checkOutTime}</dd>
        <dt>ผู้เข้าพัก</dt><dd>${S.adults} ผู้ใหญ่${S.children ? ", " + S.children + " เด็ก" : ""}</dd>
        <dt>บ้านพัก</dt><dd>${S.rooms.map(U.houseName).join(", ")}</dd>
        <dt>ค่าห้อง ${q.nights} คืน</dt><dd>${U.money(q.room)}</dd>
        ${S.extraBeds ? `<dt>เตียงเสริม ×${S.extraBeds}</dt><dd>${U.money(q.extra)}</dd>` : ""}
      </dl>
      <div class="total"><span>รวม</span><b>${U.money(q.total)}</b></div>
      <small>* ยังไม่ต้องชำระเงินตอนนี้ ทีมงานจะติดต่อกลับเพื่อยืนยันภายใน 24 ชม.</small>`;
  }

  /* ---------- ส่งข้อมูลการจอง ---------- */
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
    if (S.extraBeds) requests.unshift("เตียงเสริม ×" + S.extraBeds);
    const booking = {
      code: U.makeCode(), name, phone, email,
      arrivalTime: f.arrivalTime.value, note: f.note.value.trim().slice(0, 1000),
      checkIn: S.checkIn, checkOut: S.checkOut, nights: S.quote.nights,
      adults: S.adults, children: S.children, rooms: S.rooms,
      extraBeds: S.extraBeds, babyChair: requests.includes("เก้าอี้เด็ก"), requests,
      total: S.quote.total, status: "pending"
    };

    btn.disabled = true; btn.textContent = "กำลังส่งข้อมูล...";
    try {
      await DB.createBooking(booking);
      sendEmails(booking);
      showDone(booking);
      f.reset();
    } catch (ex) {
      console.error(ex);
      if (ex.message === "ROOM_TAKEN") {
        goStep(1);
        search("มีผู้จองบ้านหลังที่เลือกไปก่อนหน้าเพียงไม่กี่วินาที ระบบเลือกบ้านใหม่ให้แล้ว");
      } else err.textContent = "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อเราทางโทรศัพท์";
    } finally { btn.disabled = false; btn.textContent = "ยืนยันการจอง"; }
  });

  function showDone(b) {
    $("#done").innerHTML = `
      <div class="done__icon"><svg viewBox="0 0 52 52"><path d="M14 27l8 8 16-17"/></svg></div>
      <h3>ได้รับคำขอจองแล้ว ขอบคุณค่ะ</h3>
      <p class="muted">หมายเลขการจองของคุณ</p>
      <div class="done__code">${b.code}</div>
      <p>${U.esc(b.name)} · ${U.thDate(b.checkIn)} – ${U.thDate(b.checkOut)} · ${b.rooms.map(U.houseName).join(", ")}</p>
      <p class="muted" style="margin:.6rem 0 1.6rem">ทีมงานจะติดต่อกลับทาง ${U.esc(b.phone)} หรือ ${U.esc(b.email)} ภายใน 24 ชั่วโมง</p>
      <button class="btn btn--ghost dark" onclick="location.reload()">จองเพิ่ม</button>`;
    goStep(3);
  }
})();
