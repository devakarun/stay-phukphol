/* =========================================================
   Stay @Phukphol — บอทแจ้งเตือนเข้ากลุ่ม Telegram (Google Apps Script)
   1) วางโค้ดนี้ทั้งหมดใน script.google.com
   2) Project Settings → Script properties → เพิ่ม TG_TOKEN = รหัสจาก @BotFather
   3) พิมพ์ /start ในกลุ่ม Telegram แล้วกด Run ฟังก์ชัน setup
   4) Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone)
   ========================================================= */
const CFG = {
  projectId: "stay-phukphol",
  dashboard: "https://devakarun.github.io/stay-phukphol/admin.html",
  rooms: { 1: "Stay@1", 2: "Stay@2", 3: "Stay@3", 4: "Stay@4", 5: "Stay@5" },
  checkIn: "14:00",
  checkOut: "12:00",
  dailyHour: 7            // ส่งสรุปอัตโนมัติทุกเช้ากี่โมง (0–23)
};
const P = PropertiesService.getScriptProperties();
const TH_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_D = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

/* ================= ตั้งค่าครั้งเดียว: กด Run ฟังก์ชันนี้ ================= */
function setup() {
  if (!P.getProperty("TG_TOKEN")) throw new Error("ยังไม่ได้ใส่ TG_TOKEN ใน Script properties");
  const me = tg("getMe", {});
  if (!me.ok) throw new Error("TG_TOKEN ไม่ถูกต้อง: " + JSON.stringify(me));
  // หากลุ่มจากข้อความล่าสุดที่บอทเห็น (ต้องพิมพ์ /start ในกลุ่มก่อน)
  const up = tg("getUpdates", { allowed_updates: ["message", "my_chat_member"] });
  let chat = null, last = 0;
  (up.result || []).forEach((u) => {
    last = Math.max(last, u.update_id);
    const c = (u.message && u.message.chat) || (u.my_chat_member && u.my_chat_member.chat);
    if (c && (c.type === "group" || c.type === "supergroup")) chat = c;
  });
  if (!chat) throw new Error("ยังไม่เจอกลุ่ม: เพิ่มบอทเข้ากลุ่ม แล้วพิมพ์ /start ในกลุ่ม จากนั้นกด Run setup อีกครั้ง");
  P.setProperty("CHAT_ID", String(chat.id));
  P.setProperty("OFFSET", String(last + 1));
  // ตั้งเวลาอัตโนมัติ: เช็กคำสั่งในกลุ่มทุก 1 นาที + สรุปทุกเช้า
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("pollCommands").timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger("dailySummary").timeBased().everyDays(1).atHour(CFG.dailyHour).inTimezone("Asia/Bangkok").create();
  tg("setMyCommands", { commands: [{ command: "today", description: "สรุปวันนี้" }, { command: "tomorrow", description: "สรุปพรุ่งนี้" }] });
  send("✅ เชื่อมต่อกลุ่ม \"" + (chat.title || "") + "\" กับระบบจอง Stay@Phukphol แล้ว\n\nการจองใหม่ สลิป การยืนยัน และการยกเลิก จะแจ้งเข้ากลุ่มนี้ทันที\nสรุปประจำวันส่งทุกเช้า " + CFG.dailyHour + ":00 น.\n\nคำสั่ง: /today สรุปวันนี้ · /tomorrow สรุปพรุ่งนี้");
  Logger.log("✅ สำเร็จ เชื่อมกลุ่ม: " + chat.title + " (" + chat.id + ")");
}

/* ================= รับข้อมูลจากเว็บไซต์ ================= */
function doPost(e) {
  try { handleSite(JSON.parse(e.postData.contents || "{}")); } catch (err) { console.error(err); }
  return ContentService.createTextOutput("ok");
}
function doGet() { return ContentService.createTextOutput("Stay@Phukphol Telegram bot · " + (P.getProperty("CHAT_ID") ? "connected" : "not connected")); }

function handleSite(b) {
  const type = String(b.type || ""), key = String(b.key || "").replace(/[^A-Z0-9-]/gi, "").slice(0, 12);
  if (!["new", "slip", "confirmed", "cancelled"].includes(type) || !key) return;
  const dedupe = "SENT_" + type + "_" + key;
  if (P.getProperty(dedupe)) return;                     // เคยส่งแล้ว
  const v = getGuestView(key);
  if (!v) return;                                        // ไม่พบการจองจริงในฐานข้อมูล → ไม่ส่ง
  const ok = { new: ["awaiting_payment", "slip", "confirmed"], slip: ["slip", "confirmed"], confirmed: ["confirmed"], cancelled: ["cancelled"] }[type];
  if (!ok.includes(v.state)) return;
  const book = Object.assign(loadBook(key) || {}, clean(b.extra || {}), { key, code: v.code, rooms: v.rooms,
    checkIn: v.checkIn, checkOut: v.checkOut, nights: v.nights, total: v.total, rateName: v.rateName, state: v.state });
  saveBook(key, book);
  const msg = { new: msgNew, slip: msgSlip, confirmed: msgConfirmed, cancelled: msgCancelled }[type](book, v);
  if (send(msg)) P.setProperty(dedupe, "1");
}
function clean(x) {
  const s = (v, n) => String(v == null ? "" : v).replace(/[<>]/g, "").slice(0, n || 80);
  const o = {};
  if (x.name) o.name = s(x.name); if (x.phone) o.phone = s(x.phone, 20);
  if (x.adults != null) o.adults = +x.adults || 0; if (x.children != null) o.children = +x.children || 0;
  ["arrivalTime", "earlyCheckIn", "breakfastTime"].forEach((k) => { if (x[k]) o[k] = s(x[k], 20); });
  if (x.requests) o.requests = s(Array.isArray(x.requests) ? x.requests.join(", ") : x.requests, 200);
  if (x.note) o.note = s(x.note, 300);
  return o;
}

/* ================= ข้อความ ================= */
const roomsTxt = (r) => (r || []).map((n) => CFG.rooms[n] || "ห้อง " + n).join(", ");
const money = (n) => "฿" + Number(n || 0).toLocaleString("en-US");
function thDate(k, wd) { const [y, m, d] = k.split("-").map(Number); const dt = new Date(y, m - 1, d); return (wd ? TH_D[dt.getDay()] + " " : "") + d + " " + TH_M[m - 1] + " " + String(y + 543).slice(2); }
const lines = (a) => a.filter((l) => l !== null && l !== undefined && l !== false).join("\n");
function msgNew(b) {
  return lines([
    "🔔 การจองใหม่ #" + b.code + " (รอชำระเงิน)",
    "👤 " + (b.name || "-") + (b.phone ? " · " + b.phone : ""),
    "🏡 " + roomsTxt(b.rooms),
    "📅 " + thDate(b.checkIn, 1) + " → " + thDate(b.checkOut, 1) + " (" + b.nights + " คืน)",
    "👥 ผู้ใหญ่ " + (b.adults || 0) + (b.children ? " · เด็ก " + b.children : ""),
    "🍽 " + (b.rateName || "-") + (b.breakfastTime ? " · รับอาหารเช้า " + b.breakfastTime + " น." : ""),
    "⏰ " + (b.earlyCheckIn ? "ขอเช็กอินก่อนเวลา " + b.earlyCheckIn + " น." : "มาถึงประมาณ " + (b.arrivalTime || CFG.checkIn)),
    b.requests ? "📝 คำขอ: " + b.requests : null,
    b.note ? "💬 " + b.note : null,
    "💰 ยอดรวม " + money(b.total), "", "Dashboard: " + CFG.dashboard]);
}
function msgSlip(b) {
  return lines(["💳 ลูกค้าส่งสลิปแล้ว #" + b.code, "👤 " + (b.name || "-"),
    "🏡 " + roomsTxt(b.rooms) + " · " + thDate(b.checkIn) + " → " + thDate(b.checkOut),
    "💰 ยอดที่ต้องตรวจ " + money(b.total), "", "ตรวจสลิปและยืนยัน: " + CFG.dashboard]);
}
function msgConfirmed(b, v) {
  const door = v && /^\d{6}$/.test(String(v.doorCode || "")) ? String(v.doorCode) : "";
  return lines([
    "✅ ยืนยันการจองแล้ว #" + b.code,
    "━━━━━━━━━━━━━━",
    "🔑 รหัสเปิดห้อง: " + (door || "(ยังไม่มี)"),
    "━━━━━━━━━━━━━━",
    "👤 " + (b.name || "-") + (b.phone ? " · " + b.phone : ""),
    "🏡 " + roomsTxt(b.rooms),
    "📅 เช็กอิน " + thDate(b.checkIn, 1) + " · " + CFG.checkIn + " น.",
    "📅 เช็กเอาต์ " + thDate(b.checkOut, 1) + " · " + CFG.checkOut + " น. (" + b.nights + " คืน)",
    "👥 ผู้ใหญ่ " + (b.adults || 0) + (b.children ? " · เด็ก " + b.children : ""),
    "🍽 " + (b.rateName || "-") + (b.breakfastTime ? " · รับอาหารเช้า " + b.breakfastTime + " น." : ""),
    "⏰ " + (b.earlyCheckIn ? "ขอเช็กอินก่อนเวลา " + b.earlyCheckIn + " น." : "มาถึงประมาณ " + (b.arrivalTime || CFG.checkIn)),
    b.requests ? "📝 คำขอ: " + b.requests : null,
    b.note ? "💬 " + b.note : null,
    "💰 ยอดรวม " + money(b.total) + " (ชำระแล้ว)",
    "", "⚠️ อย่าลืมตั้งรหัสนี้ที่ประตูห้องด้วย"]);
}
function msgCancelled(b) { return lines(["❌ ยกเลิกการจอง #" + b.code, "🏡 " + roomsTxt(b.rooms) + " · " + thDate(b.checkIn) + " → " + thDate(b.checkOut), "ห้องกลับมาว่างแล้ว"]); }

/* ================= สรุปรายวัน ================= */
function summary(day) {
  const all = allBooks().filter((b) => b.state !== "cancelled");
  const t = (b) => (b.earlyCheckIn || b.arrivalTime || CFG.checkIn).slice(0, 5);
  const ins = all.filter((b) => b.checkIn === day).sort((a, z) => t(a).localeCompare(t(z)));
  const outs = all.filter((b) => b.checkOut === day);
  const busy = [].concat(...all.filter((b) => b.checkIn <= day && day < b.checkOut).map((b) => b.rooms));
  const free = Object.keys(CFG.rooms).filter((r) => !busy.includes(+r)).map((r) => CFG.rooms[r]);
  const st = { awaiting_payment: "รอชำระ", slip: "รอตรวจสลิป", confirmed: "ยืนยันแล้ว" };
  const L = ["📋 สรุปวันที่ " + thDate(day, 1), "", "🛬 เช็กอิน " + ins.reduce((n, b) => n + b.rooms.length, 0) + " ห้อง"];
  ins.forEach((b) => L.push("   • " + t(b) + "  " + roomsTxt(b.rooms) + " · " + (b.name || "#" + b.code) + " (" + (st[b.state] || b.state) + ")"));
  L.push("🛫 เช็กเอาต์ " + outs.reduce((n, b) => n + b.rooms.length, 0) + " ห้อง" + (outs.length ? ": " + outs.map((b) => roomsTxt(b.rooms)).join(", ") : ""));
  L.push("🏡 คืนนี้ไม่ว่าง " + busy.length + "/" + Object.keys(CFG.rooms).length + " ห้อง" + (free.length ? " · ว่าง: " + free.join(", ") : " · เต็ม"));
  const bf = all.filter((b) => b.breakfastTime && b.checkIn < day && day <= b.checkOut).sort((a, z) => a.breakfastTime.localeCompare(z.breakfastTime));
  if (bf.length) { L.push("🍳 อาหารเช้าเช้านี้"); bf.forEach((b) => L.push("   • " + b.breakfastTime + "  " + roomsTxt(b.rooms) + " (" + ((b.adults || 0) + (b.children || 0)) + " ท่าน)")); }
  const slip = all.filter((b) => b.state === "slip").length, unpaid = all.filter((b) => b.state === "awaiting_payment").length;
  if (slip || unpaid) L.push("⚠️ รอตรวจสลิป " + slip + " · รอชำระ " + unpaid);
  L.push("", CFG.dashboard);
  return L.join("\n");
}
function dailySummary() { send(summary(todayKey())); }

/* เช็กคำสั่งในกลุ่ม (/today, /tomorrow) ทุก 1 นาที */
function pollCommands() {
  const up = tg("getUpdates", { offset: +(P.getProperty("OFFSET") || 0), timeout: 0, allowed_updates: ["message"] });
  if (!up.ok) return;
  let next = +(P.getProperty("OFFSET") || 0);
  (up.result || []).forEach((u) => {
    next = Math.max(next, u.update_id + 1);
    const m = u.message; if (!m || !m.text || String(m.chat.id) !== P.getProperty("CHAT_ID")) return;
    const c = m.text.trim().toLowerCase().split("@")[0];
    if (c === "/today" || c === "สรุป" || c === "/start") send(summary(todayKey()));
    else if (c === "/tomorrow" || c === "พรุ่งนี้") send(summary(addDays(todayKey(), 1)));
  });
  P.setProperty("OFFSET", String(next));
}

/* ================= Telegram API ================= */
function tg(method, body) {
  const r = UrlFetchApp.fetch("https://api.telegram.org/bot" + P.getProperty("TG_TOKEN") + "/" + method,
    { method: "post", contentType: "application/json", payload: JSON.stringify(body), muteHttpExceptions: true });
  try { return JSON.parse(r.getContentText()); } catch (e) { return { ok: false }; }
}
function send(text) {
  const chat = P.getProperty("CHAT_ID");
  if (!chat) { console.warn("ยังไม่ได้เชื่อมกลุ่ม: Run setup ก่อน"); return false; }
  const r = tg("sendMessage", { chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true });
  if (r.parameters && r.parameters.migrate_to_chat_id) {           // กลุ่มถูกอัปเกรดเป็น supergroup
    P.setProperty("CHAT_ID", String(r.parameters.migrate_to_chat_id)); return send(text);
  }
  if (!r.ok) console.error("Telegram", JSON.stringify(r));
  return !!r.ok;
}

/* ================= อ่านการจองจาก Firestore (ส่วนที่ไม่มีข้อมูลส่วนตัว) ================= */
function getGuestView(key) {
  const r = UrlFetchApp.fetch("https://firestore.googleapis.com/v1/projects/" + CFG.projectId + "/databases/(default)/documents/guestView/" + encodeURIComponent(key), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  const f = JSON.parse(r.getContentText()).fields || {};
  const val = (x) => !x ? null : x.stringValue != null ? x.stringValue : x.integerValue != null ? +x.integerValue
    : x.doubleValue != null ? +x.doubleValue : x.arrayValue ? (x.arrayValue.values || []).map(val) : null;
  const o = {}; Object.keys(f).forEach((k) => (o[k] = val(f[k]))); return o;
}

/* ================= เก็บรายการจองไว้ทำสรุป (300 รายการล่าสุด) ================= */
function loadBook(key) { const s = P.getProperty("B_" + key); return s ? JSON.parse(s) : null; }
function saveBook(key, b) {
  P.setProperty("B_" + key, JSON.stringify(b));
  const idx = JSON.parse(P.getProperty("INDEX") || "[]").filter((k) => k !== key); idx.push(key);
  while (idx.length > 300) P.deleteProperty("B_" + idx.shift());
  P.setProperty("INDEX", JSON.stringify(idx));
}
function allBooks() { return JSON.parse(P.getProperty("INDEX") || "[]").map(loadBook).filter(Boolean); }
function todayKey() { return Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd"); }
function addDays(k, n) { const [y, m, d] = k.split("-").map(Number); return Utilities.formatDate(new Date(y, m - 1, d + n, 12), "Asia/Bangkok", "yyyy-MM-dd"); }

/* ทดสอบส่งข้อความ: กด Run ฟังก์ชันนี้ */
function testSend() { Logger.log(send("🧪 ทดสอบจากระบบ Stay@Phukphol — ถ้าเห็นข้อความนี้ แปลว่าเชื่อมต่อสำเร็จ") ? "ส่งสำเร็จ" : "ส่งไม่สำเร็จ ดูขั้นตอน setup"); }
