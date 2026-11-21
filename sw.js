// ตัวช่วยของเว็บแอป CCTV RAYONGBOARD
// - หน้าแอป: ดึงจากเน็ตก่อนเสมอ (ได้เวอร์ชันล่าสุด) ถ้าเน็ตหลุดค่อยใช้สำเนาที่เก็บไว้
// - ไลบรารี/ฟอนต์จาก CDN: ใช้สำเนาในเครื่องก่อน (ลิงก์มีเลขเวอร์ชัน ไม่เปลี่ยนเนื้อหา)
// - ข้อมูล Firestore: ไม่เก็บเด็ดขาด ปล่อยให้ Firebase จัดการเอง
// เมื่อแก้ไฟล์ในชุดนี้ (ไอคอน/manifest/sw.js) ให้เปลี่ยนเลข VERSION เพื่อล้างสำเนาเก่า
const VERSION = 'cctv-app-v1';
const SHELL = ['./cctv.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
               './icon-maskable-192.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png'];
const STATIC_HOSTS = ['cdnjs.cloudflare.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const storable = (res) => res && (res.ok || res.type === 'opaque');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ข้อมูลจริงของระบบ (Firestore และ API อื่นของ Google) ต้องไปที่เซิร์ฟเวอร์ทุกครั้ง
  if (url.hostname.endsWith('googleapis.com') && url.hostname !== 'fonts.googleapis.com') return;

  // หน้าแอป: เน็ตก่อน แล้วค่อยใช้สำเนา
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (storable(res)) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./cctv.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./cctv.html'))
    );
    return;
  }

  // ไลบรารี/ฟอนต์ที่มีเลขเวอร์ชัน: ใช้สำเนาก่อน ไม่มีค่อยโหลด
  if (STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (storable(res)) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // ไฟล์อื่นในโฟลเดอร์เดียวกัน + CSS ฟอนต์: ใช้สำเนาไปก่อน แล้วอัปเดตเบื้องหลัง
  if (url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com') {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (storable(res)) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
