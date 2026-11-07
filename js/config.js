/* =========================================================
   Stay @Phukphol — ไฟล์ตั้งค่า (แก้ไขเฉพาะไฟล์นี้ก็พอ)
   ========================================================= */
window.SP_CONFIG = {

  /* ---------- 1) Firebase ----------
     คัดลอกค่าจาก Firebase Console > Project settings > Your apps
     ถ้ายังไม่ใส่ (apiKey ยังเป็น "PASTE_...") เว็บจะทำงานใน "โหมดทดลอง"
     ซึ่งเก็บข้อมูลไว้ในเบราว์เซอร์เครื่องตัวเองเท่านั้น */
  firebase: {
    apiKey: "AIzaSyAvvnRvte_3NhbnyThyyLTvuvMVHbc2brM",
    authDomain: "stay-phukphol.firebaseapp.com",
    projectId: "stay-phukphol",
    storageBucket: "stay-phukphol.firebasestorage.app",
    messagingSenderId: "591908998524",
    appId: "1:591908998524:web:6be4fc059f3f64733028f9"
  },

  /* ---------- 2) อีเมลแอดมิน ----------
     อีเมลที่อนุญาตให้เข้า Dashboard (ต้องตรงกับใน firestore.rules ด้วย) */
  adminEmails: ["staybaanphukphol@gmail.com", "dc99degrees@gmail.com"],

  /* ---------- 3) EmailJS (ส่งอีเมลแจ้งเตือน) ----------
     สมัครฟรีที่ emailjs.com แล้วนำค่ามาใส่ ถ้าเว้นว่างไว้ ระบบจะไม่ส่งอีเมล */
  emailjs: {
    publicKey: "",
    serviceId: "",
    templateOwner: "",   // เทมเพลตแจ้งเจ้าของรีสอร์ต
    templateGuest: "",   // เทมเพลตยืนยันถึงลูกค้า (ไม่บังคับ)
    ownerEmail: "staybaanphukphol@gmail.com"
  },

  /* ---------- 4) ห้องพักและราคา ---------- */
  houses: [
    { id: 1, name: "Stay01" },
    { id: 2, name: "Stay02" },
    { id: 3, name: "Stay03" },
    { id: 4, name: "Stay04" },
    { id: 5, name: "Stay05" }
  ],
  maxGuestsPerHouse: 3,      // 2 คน + เตียงเสริม 1
  baseGuestsPerHouse: 2,     // จำนวนคนที่รวมในราคาห้อง
  priceRegular: 2500,        // ราคาปกติ (แสดงขีดฆ่า) — ใส่ 0 ถ้าไม่มีโปรโมชัน
  priceWeekday: 1850,        // ราคาที่ลูกค้าจ่ายจริง บาท/คืน (อาทิตย์–พฤหัส)
  priceWeekend: 1850,        // ราคาที่ลูกค้าจ่ายจริง บาท/คืน (ศุกร์–เสาร์)
  extraBedPrice: 300,        // บาท/คืน/เตียง
  maxNights: 14,
  checkInTime: "14:00",
  checkOutTime: "12:00",

  /* ---------- 5) ข้อมูลติดต่อ & แผนที่ ---------- */
  contact: {
    phone: "065-474-6282",
    line: "@155rszde",
    facebook: "https://facebook.com/",
    address: "ตำบล..., อำเภอ..., จังหวัดพังงา 82xxx"
  },
  /* ---------- 6) โซเชียลมีเดีย ----------
     ถ้ามีลิงก์เพจจริง ให้วางแทน url ได้เลย (ตอนนี้เป็นลิงก์ค้นหาชื่อเพจ) */
  socials: [
    { type: "Facebook", name: "บ้านปลูกผลคาเฟ่",
      url: "https://www.facebook.com/search/top?q=" + encodeURIComponent("บ้านปลูกผลคาเฟ่") },
    { type: "Facebook", name: "คลินิกกายภาพบำบัดบ้านปลูกผล",
      url: "https://www.facebook.com/search/top?q=" + encodeURIComponent("คลินิกกายภาพบำบัดบ้านปลูกผล") },
    { type: "TikTok", name: "บ้านปลูกผลคาเฟ่",
      url: "https://www.tiktok.com/search?q=" + encodeURIComponent("บ้านปลูกผลคาเฟ่") }
  ],

  // Google Maps > แชร์ > ฝังแผนที่ > คัดลอกเฉพาะลิงก์ใน src="..."
  mapEmbedUrl: "https://www.google.com/maps?q=%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%9B%E0%B8%A5%E0%B8%B9%E0%B8%81%E0%B8%9C%E0%B8%A5%E0%B8%84%E0%B8%B2%E0%B9%80%E0%B8%9F%E0%B9%88+%E0%B8%9E%E0%B8%B1%E0%B8%87%E0%B8%87%E0%B8%B2&output=embed",
  mapLink: "https://bit.ly/3weKoNL"
};
