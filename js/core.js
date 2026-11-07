/* =========================================================
   Stay @Phukphol — ระบบหลัก (ฐานข้อมูล + ฟังก์ชันช่วยเหลือ)
   ไม่ต้องแก้ไขไฟล์นี้
   ========================================================= */
(function () {
  const C = window.SP_CONFIG;

  /* ---------- ฟังก์ชันวันที่ ---------- */
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
    makeCode() {
      const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c = "SP-";
      for (let i = 0; i < 6; i++) c += s[Math.floor(Math.random() * s.length)];
      return c;
    },
    houseName(id) { const h = C.houses.find((x) => x.id === id); return h ? h.name : "บ้าน " + id; }
  };

  /* ---------- เลือกโหมด: Firebase หรือ ทดลอง ---------- */
  const useFirebase = typeof firebase !== "undefined" &&
    C.firebase && C.firebase.apiKey && !C.firebase.apiKey.startsWith("PASTE");

  let DB;

  if (useFirebase) {
    /* ======== โหมด Firebase จริง ======== */
    firebase.initializeApp(C.firebase);
    const fs = firebase.firestore();
    const auth = firebase.auth ? firebase.auth() : null;

    DB = {
      mode: "firebase",
      async getOccupied(start, end) {
        const snap = await fs.collection("roomNights")
          .where("date", ">=", start).where("date", "<", end).get();
        return snap.docs.map((d) => d.data());
      },
      async createBooking(data) {
        const ref = fs.collection("bookings").doc();
        const nights = U.nightsBetween(data.checkIn, data.checkOut);
        await fs.runTransaction(async (tx) => {
          const refs = [];
          data.rooms.forEach((room) => nights.forEach((date) =>
            refs.push({ ref: fs.collection("roomNights").doc(date + "_" + room), date, room })));
          const snaps = await Promise.all(refs.map((r) => tx.get(r.ref)));
          if (snaps.some((s) => s.exists)) throw new Error("ROOM_TAKEN");
          refs.forEach((r) => tx.set(r.ref, { date: r.date, room: r.room, bookingId: ref.id }));
          tx.set(ref, Object.assign({}, data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
        });
        return ref.id;
      },
      subscribeBookings(cb, onErr) {
        return fs.collection("bookings").orderBy("createdAt", "desc").onSnapshot((snap) => {
          cb(snap.docs.map((d) => {
            const v = d.data({ serverTimestamps: "estimate" });
            return Object.assign({ id: d.id }, v, { createdAt: v.createdAt ? v.createdAt.toMillis() : Date.now() });
          }));
        }, onErr);
      },
      async setStatus(id, status) {
        const batch = fs.batch();
        batch.update(fs.collection("bookings").doc(id), { status });
        if (status === "cancelled") {
          const nights = await fs.collection("roomNights").where("bookingId", "==", id).get();
          nights.forEach((n) => batch.delete(n.ref));
        }
        await batch.commit();
      },
      async remove(id) {
        await DB.setStatus(id, "cancelled");
        await fs.collection("bookings").doc(id).delete();
      },
      signIn: (e, p) => auth.signInWithEmailAndPassword(e, p),
      signOut: () => auth.signOut(),
      onAuth: (cb) => auth.onAuthStateChanged((u) => cb(u ? { email: u.email } : null))
    };
  } else {
    /* ======== โหมดทดลอง (เก็บใน localStorage) ======== */
    const KB = "sp_demo_bookings", KN = "sp_demo_nights", KA = "sp_demo_admin";
    const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
    const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
    const listeners = new Set();
    const emit = () => { const b = load(KB).sort((a, z) => z.createdAt - a.createdAt); listeners.forEach((f) => f(b)); };
    window.addEventListener("storage", (e) => { if (e.key === KB) emit(); });

    DB = {
      mode: "demo",
      async getOccupied(start, end) {
        return load(KN).filter((n) => n.date >= start && n.date < end);
      },
      async createBooking(data) {
        await new Promise((r) => setTimeout(r, 600));
        const nights = load(KN), dates = U.nightsBetween(data.checkIn, data.checkOut);
        const taken = nights.some((n) => data.rooms.includes(n.room) && dates.includes(n.date));
        if (taken) throw new Error("ROOM_TAKEN");
        const id = "demo" + Date.now();
        data.rooms.forEach((room) => dates.forEach((date) => nights.push({ date, room, bookingId: id })));
        save(KN, nights);
        const b = load(KB); b.push(Object.assign({ id, createdAt: Date.now() }, data)); save(KB, b);
        emit(); return id;
      },
      subscribeBookings(cb) { listeners.add(cb); setTimeout(emit, 0); return () => listeners.delete(cb); },
      async setStatus(id, status) {
        save(KB, load(KB).map((b) => (b.id === id ? Object.assign(b, { status }) : b)));
        if (status === "cancelled") save(KN, load(KN).filter((n) => n.bookingId !== id));
        emit();
      },
      async remove(id) {
        save(KN, load(KN).filter((n) => n.bookingId !== id));
        save(KB, load(KB).filter((b) => b.id !== id)); emit();
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
          try {
            await DB.createBooking({
              code: U.makeCode(), name: names[i % names.length], phone: "080-000-000" + i,
              email: "guest" + i + "@example.com", checkIn: ci, checkOut: co, nights: q.nights,
              adults: rooms.length * 2, children: i % 2, rooms, extraBeds: extra, babyChair: i % 4 === 1,
              requests: extra ? ["เตียงเสริม"] : [], note: "", arrivalTime: "15:00",
              rate: rt, rateName: q.rate.name, total: q.total, status: off < 0 ? "confirmed" : i % 2 ? "pending" : "confirmed"
            });
          } catch (e) {}
        }
      },
      clear() { localStorage.removeItem(KB); localStorage.removeItem(KN); emit(); }
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
