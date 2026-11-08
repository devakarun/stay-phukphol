/* =========================================================
   Stay @Phukphol — ไฟล์ตั้งค่า (แก้ไขเฉพาะไฟล์นี้ก็พอ)
   ========================================================= */
window.SP_CONFIG = {

  /* ---------- 0) ธีมหน้าเว็บ ----------
     "earth" (ค่าเริ่มต้น) | "minimal" | "sunset" | "garden"
     ลองดูก่อนเปลี่ยนได้ด้วยลิงก์ เช่น https://devakarun.github.io/stay-phukphol/?theme=sunset */
  theme: "garden",

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

  /* ---------- แจ้งเตือนเข้ากลุ่ม Telegram ----------
     วางลิงก์ Web app ของ Google Apps Script (ลงท้ายด้วย /exec) ถ้าเว้นว่าง จะไม่ส่งแจ้งเตือน */
  botUrl: "https://script.google.com/macros/s/AKfycbzvB_yTZ2FWwam4wgc0meVGycV2ANAQezKyfJLtBiS-3jwcSU3w5VNBVQOabPI-xxxC7Q/exec",

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
    // x, y = ตำแหน่งป้ายสถานะบนภาพแผนที่ (เปอร์เซ็นต์จากซ้าย / จากบน)
    { id: 1, name: "Stay@1", x: 85.4, y: 38.4 },
    { id: 2, name: "Stay@2", x: 73.0, y: 40.4 },
    { id: 3, name: "Stay@3", x: 59.1, y: 42.6 },
    { id: 4, name: "Stay@4", x: 43.4, y: 45.0 },
    { id: 5, name: "Stay@5", x: 24.3, y: 47.4 }
  ],
  roomMapImage: "images/room-map.jpg",

  /* ---------- การชำระเงิน ---------- */
  payment: {
    image: "images/payment.jpg",
    bank: "ธนาคารกสิกรไทย (KBank)",
    accountNo: "241-2-18626-8",
    accountName: "อภิสิทธิ์ ปลูกผล"
  },

  /* ---------- ข้อความยืนยันการจอง (แสดงให้ลูกค้าหลังแอดมินยืนยัน) ---------- */
  stayGuide: {
    thanks: "ขอบคุณที่สนใจพื้นที่การพักผ่อนท่ามกลางธรรมชาติ กับ สเตย์@บ้านปลูกผล ค่ะ",
    title: "ขั้นตอนการเข้าพักที่ สเตย์@บ้านปลูกผล",
    steps: [
      "คุณลูกค้าสามารถเช็คอินได้ตามเวลาที่ระบุไว้ หากเข้ามาก่อนเวลา ***กรุณาติดต่อแอดมิน ผ่านไลน์ หรือโทรแจ้ง ก่อนเข้าห้องพักค่ะ***",
      "สามารถใช้รหัสเปิดห้องที่ระบบออกให้ กดเข้าห้องพักแบบบริการตัวเอง (Self Service) ได้เลย",
      "ในห้องพักจะมีคีย์การ์ดที่ทางเราเตรียมให้ คุณลูกค้าสามารถเสียบคีย์การ์ดเพื่อเปิดระบบไฟฟ้าในห้อง และเมื่อออกจากห้อง สามารถใช้คีย์การ์ดเปิดเข้าห้องแทนรหัสได้ค่ะ"
    ],
    codeNote: "*หมายเหตุ : รหัสนี้ใช้สำหรับยืนยันการจองห้องพัก",
    doorNote: "*หมายเหตุ : รหัสนี้เป็นรหัสเปิดเข้าห้องพักที่ลูกค้าจองมา กรุณาอย่าเปิดเผยให้ผู้อื่นรับทราบ"
  },
  maxGuestsPerHouse: 3,      // 2 คน + เตียงเสริม 1
  baseGuestsPerHouse: 2,     // จำนวนคนที่รวมในราคาห้อง
  /* แพ็กเกจราคา (บาท/คืน/หลัง) ลูกค้าเลือกได้ตอนจอง
     price   = ราคาที่ลูกค้าจ่ายจริง
     regular = ราคาปกติ แสดงแบบขีดฆ่า (ใส่ 0 ถ้าไม่มีโปรโมชัน)
     weekendPrice = ราคาคืนศุกร์–เสาร์ (ใส่ 0 = ราคาเดียวกันทุกคืน) */
  rates: [
    { id: "room",      name: "ไม่รวมอาหารเช้า", price: 1450, regular: 0,    weekendPrice: 0 },
    { id: "breakfast", name: "รวมอาหารเช้า",    price: 1850, regular: 2500, weekendPrice: 0, breakfast: true }
  ],
  defaultRate: "breakfast",  // แพ็กเกจที่เลือกไว้ให้ก่อน
  breakfastTimes: ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"],  // เวลารับอาหารเช้าที่ให้เลือก
  earlyCheckInTimes: ["09:00", "10:00", "11:00", "12:00", "13:00"],               // เวลาเช็กอินก่อนเวลาที่ให้เลือก
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
    { type: "TikTok", name: "บ้านปลูกผลคาเฟ่", url: "https://www.tiktok.com/@baanphukpholcafe" },
    { type: "TikTok", name: "คลินิกกายภาพบำบัดบ้านปลูกผล", url: "https://www.tiktok.com/@baanphukphol" }
  ],

  /* ---------- แกลเลอรีวิดีโอ "บรรยากาศรอบบ้าน" (ลิงก์คลิป TikTok) ---------- */
  galleryVideos: [
    "https://www.tiktok.com/@baanphukpholcafe/video/7704992215788981505",
    "https://www.tiktok.com/@baanphukpholcafe/video/7704938113474317588",
    "https://www.tiktok.com/@baanphukpholcafe/video/7704468112229305621",
    "https://www.tiktok.com/@baanphukpholcafe/video/7704657235745590549",
    "https://www.tiktok.com/@baanphukpholcafe/video/7703910981390437684",
    "https://www.tiktok.com/@baanphukpholcafe/video/7702311068529462549"
  ],

  /* ---------- 7) TikTok ----------
     accounts = ช่อง TikTok (ไม่ต้องใส่ @) → หน้าเว็บจะแสดงคลิปล่าสุดของแต่ละช่องให้อัตโนมัติ
     videos = (ไม่บังคับ) ลิงก์คลิปที่อยากโชว์เป็นแถบ "สตอรี่" ด้านบน
              วิธีเอาลิงก์: เปิดคลิปใน TikTok > แชร์ > คัดลอกลิงก์ แล้ววางในเครื่องหมาย " " คั่นด้วย , */
  tiktok: {
    accounts: [
      { user: "baanphukpholcafe", label: "บ้านปลูกผลคาเฟ่" },
      { user: "baanphukphol",     label: "คลินิกกายภาพบำบัดบ้านปลูกผล" }
    ],
    videos: [
      // "https://www.tiktok.com/@baanphukpholcafe/video/1234567890123456789",
    ]
  },

  // Google Maps > แชร์ > ฝังแผนที่ > คัดลอกเฉพาะลิงก์ใน src="..."
  mapEmbedUrl: "https://www.google.com/maps?q=%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%9B%E0%B8%A5%E0%B8%B9%E0%B8%81%E0%B8%9C%E0%B8%A5%E0%B8%84%E0%B8%B2%E0%B9%80%E0%B8%9F%E0%B9%88+%E0%B8%9E%E0%B8%B1%E0%B8%87%E0%B8%87%E0%B8%B2&output=embed",
  mapLink: "https://bit.ly/3weKoNL"
};
