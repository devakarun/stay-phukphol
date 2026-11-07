/* =========================================================
   Stay @Phukphol — ไฟล์ตั้งค่า (แก้ไขเฉพาะไฟล์นี้ก็พอ)
   ========================================================= */
window.SP_CONFIG = {

  /* ---------- 1) Firebase ----------
     คัดลอกค่าจาก Firebase Console > Project settings > Your apps
     ถ้ายังไม่ใส่ (apiKey ยังเป็น "PASTE_...") เว็บจะทำงานใน "โหมดทดลอง"
     ซึ่งเก็บข้อมูลไว้ในเบราว์เซอร์เครื่องตัวเองเท่านั้น */
const firebaseConfig = {
  apiKey: "AIzaSyAvvnRvte_3NhbnyThyyLTvuvMVHbc2brM",
  authDomain: "stay-phukphol.firebaseapp.com",
  projectId: "stay-phukphol",
  storageBucket: "stay-phukphol.firebasestorage.app",
  messagingSenderId: "591908998524",
  appId: "1:591908998524:web:6be4fc059f3f64733028f9"
};

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
    ownerEmail: "dc99degrees@gmail.com"
  },

  /* ---------- 4) ห้องพักและราคา ---------- */
  houses: [
    { id: 1, name: "บ้านดอกไม้" },
    { id: 2, name: "บ้านใบไม้" },
    { id: 3, name: "บ้านสายลม" },
    { id: 4, name: "บ้านขุนเขา" },
    { id: 5, name: "บ้านแสงดาว" }
  ],
  maxGuestsPerHouse: 3,      // 2 คน + เตียงเสริม 1
  baseGuestsPerHouse: 2,     // จำนวนคนที่รวมในราคาห้อง
  priceWeekday: 1500,        // บาท/คืน (อาทิตย์–พฤหัส)
  priceWeekend: 1900,        // บาท/คืน (ศุกร์–เสาร์)
  extraBedPrice: 300,        // บาท/คืน/เตียง
  maxNights: 14,
  checkInTime: "14:00",
  checkOutTime: "12:00",

  /* ---------- 5) ข้อมูลติดต่อ & แผนที่ ---------- */
  contact: {
    phone: "08X-XXX-XXXX",
    line: "@stayphukphol",
    facebook: "https://facebook.com/",
    address: "ตำบล..., อำเภอ..., จังหวัดพังงา 82xxx"
  },
  // Google Maps > แชร์ > ฝังแผนที่ > คัดลอกเฉพาะลิงก์ใน src="..."
     mapEmbedUrl: "https://www.google.com/maps?q=บ้านปลูกผลคาเฟ่+พังงา&output=embed",
     mapLink: "https://bit.ly/3weKoNL"
};
