# Stay @Phukphol — สเตย์ แอท บ้านปลูกผล รีสอร์ต

เว็บไซต์บ้านพัก 5 หลัง พร้อมระบบจองออนไลน์และ Dashboard หลังบ้าน

- `index.html` — หน้าเว็บหลัก + ระบบจอง (ค้นหาบ้านว่างอัตโนมัติ)
- `admin.html` — Dashboard: แจ้งเตือนการจอง, ปฏิทิน, ห้องว่าง, ยอดขาย
- `js/config.js` — **ไฟล์ตั้งค่าเดียวที่ต้องแก้** (Firebase, ราคา, ชื่อบ้าน, ติดต่อ, แผนที่, EmailJS)
- `firestore.rules` — กฎความปลอดภัย คัดลอกไปวางใน Firebase Console > Firestore > Rules

## เริ่มต้นเร็ว
1. เปิดโฟลเดอร์ด้วย VS Code แล้วคลิกขวา `index.html` > Open with Live Server
2. ยังไม่ใส่ค่า Firebase = โหมดทดลอง (ข้อมูลเก็บในเบราว์เซอร์)
3. ดูคู่มือฉบับเต็มทีละขั้นตอนในเอกสารคู่มือที่แนบมา

เทคโนโลยี: HTML/CSS/JS ล้วน · Firebase Firestore + Auth (compat SDK) · EmailJS · Flatpickr · Chart.js · โฮสต์บน GitHub Pages
