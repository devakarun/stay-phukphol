/* =========================================================
   Stay @Phukphol — ระบบหลัก (ฐานข้อมูล + ฟังก์ชันช่วยเหลือ)
   ไม่ต้องแก้ไขไฟล์นี้
   ========================================================= */
(function () {
  const C = window.SP_CONFIG;

  /* ---------- ฟังก์ชันช่วยเหลือ ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const U = {
    toKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); },
    fromKey(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); },
    addDays(k, n) { const d = U.fromKey(k); d.setDate(d.getDate() + n); return U.toKey(d); },
    today() { return U.toKey(new Date()); },
    nightsBetween(a, b) {
      const out = []; let k = a;
      while (k < b) { out.push(k); k = U.addDays(k, 1); }
      return out;
    },
    isWeekend(k) { const w = U.fromKey(k).getDay(); return w === 5 || w === 6; },
    money(n) { return "฿" + Number(n || 0).toLocaleString("th-TH"); },
    thDate(k, opt) {
      return U.fromKey(k).toLocaleDateString("th-TH", opt || { day: "numeric", month: "short", year: "numeric" });
    },
    esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    },
    housesNeeded(guests) { return Math.ceil(guests / C.maxGuestsPerHouse); },
    /* ราคารวม: ห้อง × คืน (+ เตียงเสริม) */
    rate(id) { return C.rates.find((r) => r.id === id) || C.rates[0]; },
    quote(checkIn, checkOut, houses, extraBeds, rateId) {
      const r = U.rate(rateId), nights = U.nightsBetween(checkIn, checkOut);
      let room = 0, regular = 0;
      nights.forEach((k) => {
        const p = U.isWeekend(k) && r.weekendPrice ? r.weekendPrice : r.price;
        room += p * houses; regular += (r.regular || p) * houses;
      });
      const extra = nights.length * extraBeds * C.extraBedPrice;
      return { nights: nights.length, room, extra, total: room + extra, regular: regular + extra, rate: r };
    },
    /* รหัสการจอง 4 หลัก (ตัดตัวที่สับสนง่าย เช่น O/0, I/1 ออก) */
    makeCode() {
      const s = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c = "";
      for (let i = 0; i < 4; i++) c += s[Math.floor(Math.random() * s.length)];
      return c;
    },
    /* รหัสเปิดห้อง ตัวเลข 6 หลัก */
    doorCode() { return String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); },
    last4(phone) { return String(phone || "").replace(/\D/g, "").slice(-4); },
    guestKey(code, phone) { return String(code).toUpperCase().trim() + "-" + U.last4(phone); },
    houseName(id) { const h = C.houses.find((x) => x.id === Number(id)); return h ? h.name : "บ้าน " + id; },
    /* ย่อรูปสลิปให้เล็กลงก่อนบันทึก (ด้านยาวไม่เกิน 1100px, JPEG) */
    compressImage(file, max = 1100) {
      return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) return reject(new Error("NOT_IMAGE"));
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          let q = 0.78, out = c.toDataURL("image/jpeg", q);
          while (out.length > 700000 && q > 0.35) { q -= 0.12; out = c.toDataURL("image/jpeg", q); }
          resolve(out);
        };
        img.onerror = () => reject(new Error("BAD_IMAGE"));
        img.src = url;
      });
    },
    /* ข้อความยืนยันการจองแบบข้อความล้วน (คัดลอกส่ง LINE / อีเมล) */
    confirmText(v) {
      const G = C.stayGuide;
      return [
        G.thanks, "",
        "รหัสการจอง: " + v.code, G.codeNote, "",
        "ห้องพัก: " + v.rooms.map(U.houseName).join(", "),
        "เช็กอิน: " + U.thDate(v.checkIn, { weekday: "short", day: "numeric", month: "long", year: "numeric" }) + " ตั้งแต่ " + C.checkInTime + " น.",
        "เช็กเอาต์: " + U.thDate(v.checkOut, { weekday: "short", day: "numeric", month: "long", year: "numeric" }) + " ก่อน " + C.checkOutTime + " น.", "",
        "รหัสเปิดห้อง: " + v.doorCode, G.doorNote, "",
        G.title, ...G.steps.map((t, i) => (i + 1) + ". " + t), "",
        "โทร: " + C.contact.phone + " | LINE: " + C.contact.line
      ].join("\n");
    }
  };

  /* ---------- เลือกโหมด: Firebase หรือ ทดลอง ---------- */
  const useFirebase = typeof firebase !== "undefined" &&
    C.firebase && C.firebase.apiKey && !C.firebase.apiKey.startsWith("PASTE");

  // ข้อมูลที่ลูกค้าเห็นได้ (ไม่มีข้อมูลส่วนตัว)
  const viewOf = (b, id, key) => ({
    bookingId: id, code: b.code, state: "awaiting_payment", total: b.total,
    checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights, rooms: b.rooms, rateName: b.rateName || ""
  });

  let DB;

  if (useFirebase) {
    /* ======== โหมด Firebase จริง ======== */
    firebase.initializeApp(C.firebase);
    const fs = firebase.firestore();
    const auth = firebase.auth ? firebase.auth() : null;
    const now = () => firebase.firestore.FieldValue.serverTimestamp();

    DB = {
      mode: "firebase",
      async getOccupied(start, end) {
        const snap = await fs.collection("roomNights")
          .where("date", ">=", start).where("date", "<", end).get();
        return snap.docs.map((d) => d.data());
      },
      async createBooking(data) {
        const nights = U.nightsBetween(data.checkIn, data.checkOut);
        for (let attempt = 0; attempt < 5; attempt++) {
          const code = U.makeCode(), key = U.guestKey(code, data.phone);
          const ref = fs.collection("bookings").doc(), gref = fs.collection("guestView").doc(key);
          const b = Object.assign({}, data, { code, guestKey: key, payment: "unpaid" });
          try {
            await fs.runTransaction(async (tx) => {
              if ((await tx.get(gref)).exists) throw new Error("CODE_TAKEN");
              const refs = [];
              data.rooms.forEach((room) => nights.forEach((date) =>
                refs.push({ ref: fs.collection("roomNights").doc(date + "_" + room), date, room })));
              const snaps = await Promise.all(refs.map((r) => tx.get(r.ref)));
              if (snaps.some((s) => s.exists)) throw new Error("ROOM_TAKEN");
              refs.forEach((r) => tx.set(r.ref, { date: r.date, room: r.room, bookingId: ref.id }));
              tx.set(ref, Object.assign({}, b, { createdAt: now() }));
              tx.set(gref, Object.assign(viewOf(b, ref.id, key), { createdAt: now() }));
            });
            return { id: ref.id, code, key, booking: b };
          } catch (e) { if (e.message !== "CODE_TAKEN") throw e; }
        }
        throw new Error("CODE_FAIL");
      },
      async getGuestView(key) {
        const d = await fs.collection("guestView").doc(key).get();
        return d.exists ? d.data() : null;
      },
      watchGuestView(key, cb) {
        return fs.collection("guestView").doc(key).onSnapshot((d) => cb(d.exists ? d.data() : null), () => {});
      },
      async uploadSlip(key, view, image) {
        const batch = fs.batch();
        batch.set(fs.collection("slips").doc(view.bookingId), { image, createdAt: now() });
        batch.update(fs.collection("bookings").doc(view.bookingId), { payment: "slip", slipAt: now() });
        batch.update(fs.collection("guestView").doc(key), { state: "slip", slipAt: now() });
        await batch.commit();
      },
      /* ---- ฝั่งแอดมิน ---- */
      subscribeBookings(cb, onErr) {
        return fs.collection("bookings").orderBy("createdAt", "desc").onSnapshot((snap) => {
          cb(snap.docs.map((d) => {
            const v = d.data({ serverTimestamps: "estimate" });
            return Object.assign({ id: d.id }, v, { createdAt: v.createdAt ? v.createdAt.toMillis() : Date.now() });
          }));
        }, onErr);
      },
      async getSlip(id) {
        const d = await fs.collection("slips").doc(id).get();
        return d.exists ? d.data().image : null;
      },
      async confirm(b, doorCode) {
        const batch = fs.batch();
        batch.update(fs.collection("bookings").doc(b.id), { status: "confirmed", doorCode, payment: b.payment === "unpaid" ? "unpaid" : "paid" });
        if (b.guestKey) batch.set(fs.collection("guestView").doc(b.guestKey), { state: "confirmed", doorCode }, { merge: true });
        await batch.commit();
      },
      async setStatus(id, status) {
        const b = DB._last && DB._last.find((x) => x.id === id);
        const batch = fs.batch();
        batch.update(fs.collection("bookings").doc(id), { status });
        if (b && b.guestKey) batch.set(fs.collection("guestView").doc(b.guestKey), { state: status }, { merge: true });
        if (status === "cancelled") {
          const nights = await fs.collection("roomNights").where("bookingId", "==", id).get();
          nights.forEach((n) => batch.delete(n.ref));
        }
        await batch.commit();
      },
      async remove(id) {
        const b = DB._last && DB._last.find((x) => x.id === id);
        await DB.setStatus(id, "cancelled");
        const batch = fs.batch();
        batch.delete(fs.collection("bookings").doc(id));
        batch.delete(fs.collection("slips").doc(id));
        if (b && b.guestKey) batch.delete(fs.collection("guestView").doc(b.guestKey));
        await batch.commit();
      },
      signIn: (e, p) => auth.signInWithEmailAndPassword(e, p),
      signOut: () => auth.signOut(),
      onAuth: (cb) => auth.onAuthStateChanged((u) => cb(u ? { email: u.email } : null))
    };
  } else {
    /* ======== โหมดทดลอง (เก็บใน localStorage) ======== */
    const KB = "sp_demo_bookings", KN = "sp_demo_nights", KA = "sp_demo_admin", KG = "sp_demo_guest", KS = "sp_demo_slips";
    const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
    const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn("storage full", e); } };
    const listeners = new Set(), gWatch = new Map();
    const emit = () => {
      const b = load(KB, []).sort((a, z) => z.createdAt - a.createdAt); listeners.forEach((f) => f(b));
      const g = load(KG, {}); gWatch.forEach((set, key) => set.forEach((f) => f(g[key] || null)));
    };
    window.addEventListener("storage", (e) => { if ([KB, KG].includes(e.key)) emit(); });
    const setGV = (key, patch) => { if (!key) return; const g = load(KG, {}); if (g[key]) { g[key] = Object.assign(g[key], patch); save(KG, g); } };

    DB = {
      mode: "demo",
      async getOccupied(start, end) {
        return load(KN, []).filter((n) => n.date >= start && n.date < end);
      },
      async createBooking(data) {
        await new Promise((r) => setTimeout(r, 500));
        const nights = load(KN, []), dates = U.nightsBetween(data.checkIn, data.checkOut);
        if (nights.some((n) => data.rooms.includes(n.room) && dates.includes(n.date))) throw new Error("ROOM_TAKEN");
        const g = load(KG, {});
        let code, key; do { code = U.makeCode(); key = U.guestKey(code, data.phone); } while (g[key]);
        const id = "demo" + Date.now() + Math.floor(Math.random() * 1000);
        const b = Object.assign({ id, createdAt: Date.now() }, data, { code, guestKey: key, payment: data.payment || "unpaid" });
        data.rooms.forEach((room) => dates.forEach((date) => nights.push({ date, room, bookingId: id })));
        save(KN, nights);
        const all = load(KB, []); all.push(b); save(KB, all);
        g[key] = Object.assign(viewOf(b, id, key), b.status === "confirmed" ? { state: "confirmed", doorCode: b.doorCode } : {}); save(KG, g);
        emit(); return { id, code, key, booking: b };
      },
      async getGuestView(key) { return load(KG, {})[key] || null; },
      watchGuestView(key, cb) {
        if (!gWatch.has(key)) gWatch.set(key, new Set());
        gWatch.get(key).add(cb); setTimeout(() => cb(load(KG, {})[key] || null), 0);
        const t = setInterval(() => cb(load(KG, {})[key] || null), 2500);
        return () => { gWatch.get(key).delete(cb); clearInterval(t); };
      },
      async uploadSlip(key, view, image) {
        await new Promise((r) => setTimeout(r, 500));
        const s = load(KS, {}); s[view.bookingId] = image; save(KS, s);
        save(KB, load(KB, []).map((b) => (b.id === view.bookingId ? Object.assign(b, { payment: "slip", slipAt: Date.now() }) : b)));
        setGV(key, { state: "slip" }); emit();
      },
      subscribeBookings(cb) { listeners.add(cb); setTimeout(emit, 0); return () => listeners.delete(cb); },
      async getSlip(id) { return load(KS, {})[id] || null; },
      async confirm(b, doorCode) {
        save(KB, load(KB, []).map((x) => (x.id === b.id ? Object.assign(x, { status: "confirmed", doorCode, payment: x.payment === "unpaid" ? "unpaid" : "paid" }) : x)));
        setGV(b.guestKey, { state: "confirmed", doorCode }); emit();
      },
      async setStatus(id, status) {
        const b = load(KB, []).find((x) => x.id === id);
        save(KB, load(KB, []).map((x) => (x.id === id ? Object.assign(x, { status }) : x)));
        if (status === "cancelled") save(KN, load(KN, []).filter((n) => n.bookingId !== id));
        if (b) setGV(b.guestKey, { state: status });
        emit();
      },
      async remove(id) {
        const b = load(KB, []).find((x) => x.id === id);
        save(KN, load(KN, []).filter((n) => n.bookingId !== id));
        save(KB, load(KB, []).filter((x) => x.id !== id));
        const s = load(KS, {}); delete s[id]; save(KS, s);
        if (b && b.guestKey) { const g = load(KG, {}); delete g[b.guestKey]; save(KG, g); }
        emit();
      },
      async signIn(email) { localStorage.setItem(KA, email || "demo"); DB._authCb && DB._authCb({ email }); },
      async signOut() { localStorage.removeItem(KA); DB._authCb && DB._authCb(null); },
      onAuth(cb) { DB._authCb = cb; const e = localStorage.getItem(KA); setTimeout(() => cb(e ? { email: e } : null), 0); },
      /* สร้างข้อมูลตัวอย่างเพื่อดู Dashboard */
      async seed() {
        const names = ["คุณตัวอย่าง หนึ่ง", "คุณตัวอย่าง สอง", "Sample Guest", "คุณทดลอง สาม", "คุณทดสอบ สี่", "Demo Family"];
        const t = U.today();
        const plan = [[-12, 2, [1]], [-6, 3, [2, 3]], [-2, 2, [4]], [0, 2, [1]], [1, 3, [5]], [3, 2, [2]], [5, 4, [3, 4]], [9, 2, [1]]];
        for (let i = 0; i < plan.length; i++) {
          const [off, n, rooms] = plan[i];
          const ci = U.addDays(t, off), co = U.addDays(ci, n), extra = i % 3 === 0 ? 1 : 0;
          const rt = C.rates[i % C.rates.length].id, q = U.quote(ci, co, rooms.length, extra, rt);
          const confirmed = off < 0 || i % 2 === 0;
          try {
            await DB.createBooking({
              name: names[i % names.length], phone: "080-000-000" + i,
              email: "guest" + i + "@example.com", checkIn: ci, checkOut: co, nights: q.nights,
              adults: rooms.length * 2, children: i % 2, rooms, extraBeds: extra, babyChair: i % 4 === 1,
              requests: extra ? ["เตียงเสริม"] : [], note: "", arrivalTime: "15:00",
              rate: rt, rateName: q.rate.name, total: q.total,
              status: confirmed ? "confirmed" : "pending", payment: confirmed ? "paid" : i === 5 ? "unpaid" : "slip",
              doorCode: confirmed ? U.doorCode() : undefined
            });
          } catch (e) {}
        }
      },
      clear() { [KB, KN, KG, KS].forEach((k) => localStorage.removeItem(k)); emit(); }
    };
  }

  /* ---------- ส่งอีเมลผ่าน EmailJS ---------- */
  async function sendEmails(b) {
    const E = C.emailjs;
    if (!E || !E.publicKey || !E.serviceId || typeof emailjs === "undefined") return false;
    emailjs.init({ publicKey: E.publicKey });
    const params = {
      booking_code: b.code, guest_name: b.name, guest_email: b.email, guest_phone: b.phone,
      check_in: U.thDate(b.checkIn), check_out: U.thDate(b.checkOut), nights: b.nights,
      guests: b.adults + " ผู้ใหญ่, " + b.children + " เด็ก",
      houses: b.rooms.map(U.houseName).join(", "),
      rate: b.rateName || "-",
      requests: (b.requests.join(", ") || "-") + (b.note ? " | " + b.note : ""),
      total: U.money(b.total), owner_email: E.ownerEmail, to_email: b.email
    };
    const jobs = [];
    if (E.templateOwner) jobs.push(emailjs.send(E.serviceId, E.templateOwner, params));
    if (E.templateGuest) jobs.push(emailjs.send(E.serviceId, E.templateGuest, params));
    try { await Promise.all(jobs); return true; } catch (e) { console.warn("EmailJS error", e); return false; }
  }

  window.SP = { C, U, DB, sendEmails };
})();
