import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

console.log("🚀 Bot attendance dimulai...");
console.log("📅 Waktu start:", new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }));

const API_KEY = process.env.API_KEY;
const UNIVERSE_ID = process.env.UNIVERSE_ID;
const DATASTORE_NAME = process.env.DATASTORE_NAME;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

const ADMIN_LIST = [
  "xbryuu",
  "milkycats_06",
  "Kuroko_Stanly",
  "mike_ezxo",
  "meme_jelimey",
  "Efaja9",
  "Naynayy036",
  "X_hunterss07",
  "Oktaa_cmll",
  "DIAL3010",
  "UNF0RGIVEN77",
  "raina_rain02"
];

const CACHE_FILE = "cache.json";
let processedSessions = new Set(); // Set untuk track sesi yang sudah diproses
let statsCache = {
  totalHariIni: 0,
  totalBulanIni: 0,
  lastUpdateHariIni: null,
  lastUpdateBulanIni: null,
  currentDate: null,
  currentMonth: null
};

// Load cache
if (fs.existsSync(CACHE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    processedSessions = new Set(data.processedSessions || []);
    statsCache = data.statsCache || statsCache;
    console.log("🗂️ Cache berhasil dimuat. Sesi yang sudah diproses:", processedSessions.size);
  } catch (err) {
    console.warn("⚠️ Gagal baca cache.json:", err.message);
  }
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      processedSessions: Array.from(processedSessions),
      statsCache
    }, null, 2));
  } catch (err) {
    console.error("❌ Gagal simpan cache:", err.message);
  }
}

// Fungsi list semua keys
async function listDataStoreKeys(prefix) {
  try {
    const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries?datastoreName=${DATASTORE_NAME}&prefix=${prefix}&limit=100`;
    const res = await axios.get(url, {
      headers: { "x-api-key": API_KEY }
    });
    return res.data.keys || [];
  } catch (err) {
    console.error("❌ Error listing keys:", err.message);
    return [];
  }
}

// Fungsi ambil data
async function fetchDataStore(key) {
  try {
    const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE_NAME}&entryKey=${encodeURIComponent(key)}`;
    const res = await axios.get(url, {
      headers: { "x-api-key": API_KEY }
    });
    return res.data;
  } catch (err) {
    return null;
  }
}

// Fungsi hitung total durasi user di tanggal tertentu
async function getTotalDurasiUserByDate(username, dateKey) {
  const prefix = `${username}-${dateKey}`;
  const keys = await listDataStoreKeys(prefix);
  
  let totalMenit = 0;
  
  for (const keyObj of keys) {
    const data = await fetchDataStore(keyObj.key);
    if (data && data.joinTime && data.leaveTime) {
      const durasi = Math.floor((data.leaveTime - data.joinTime) / 60);
      totalMenit += durasi;
    }
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  
  return totalMenit;
}

// Fungsi hitung total hari ini
async function getTotalDurasiHariIni(forceRefresh = false) {
  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  
  // Reset cache jika ganti hari
  if (statsCache.currentDate !== todayKey) {
    console.log("🔄 Ganti hari terdeteksi, reset cache dan processed sessions");
    processedSessions.clear();
    statsCache.totalHariIni = 0;
    statsCache.currentDate = todayKey;
    statsCache.lastUpdateHariIni = null;
    saveCache();
  }
  
  // Gunakan cache jika masih fresh (1 menit)
  if (!forceRefresh && 
      statsCache.lastUpdateHariIni && 
      (Date.now() - statsCache.lastUpdateHariIni) < 60 * 1000) {
    return statsCache.totalHariIni;
  }
  
  console.log("📊 Menghitung total hari ini...");
  let totalMenit = 0;
  
  for (const username of ADMIN_LIST) {
    const userTotal = await getTotalDurasiUserByDate(username, todayKey);
    totalMenit += userTotal;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  statsCache.totalHariIni = totalMenit;
  statsCache.lastUpdateHariIni = Date.now();
  saveCache();
  
  console.log(`✅ Total hari ini: ${totalMenit} menit`);
  return totalMenit;
}

// Fungsi hitung total bulan ini
async function getTotalDurasiBulanIni(forceRefresh = false) {
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  
  // Reset cache jika ganti bulan
  if (statsCache.currentMonth !== monthKey) {
    console.log("🔄 Ganti bulan terdeteksi, reset cache bulan");
    statsCache.totalBulanIni = 0;
    statsCache.currentMonth = monthKey;
    statsCache.lastUpdateBulanIni = null;
  }
  
  // Gunakan cache jika masih fresh (5 menit)
  if (!forceRefresh &&
      statsCache.lastUpdateBulanIni && 
      (Date.now() - statsCache.lastUpdateBulanIni) < 5 * 60 * 1000) {
    return statsCache.totalBulanIni;
  }
  
  console.log("📊 Menghitung total bulan ini...");
  
  let totalMenit = 0;
  const tahun = now.getUTCFullYear();
  const bulan = String(now.getUTCMonth() + 1).padStart(2, "0");
  const hariSekarang = now.getUTCDate();
  
  for (let hari = 1; hari <= hariSekarang; hari++) {
    const tanggal = String(hari).padStart(2, "0");
    const dateKey = `${tahun}-${bulan}-${tanggal}`;
    
    for (const username of ADMIN_LIST) {
      const userTotal = await getTotalDurasiUserByDate(username, dateKey);
      totalMenit += userTotal;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }
  
  statsCache.totalBulanIni = totalMenit;
  statsCache.lastUpdateBulanIni = Date.now();
  saveCache();
  
  console.log(`✅ Total bulan ini: ${totalMenit} menit`);
  return totalMenit;
}

// Fungsi format durasi
function formatDurasi(totalMenit) {
  const jam = Math.floor(totalMenit / 60);
  const menit = totalMenit % 60;
  
  if (jam > 0) {
    return `${jam} jam ${menit} menit`;
  }
  return `${menit} menit`;
}

// Fungsi kirim embed
async function sendDiscordEmbed(data) {
  const joinTime = new Date(data.joinTime * 1000);
  const leaveTime = new Date(data.leaveTime * 1000);
  const durasiMenit = Math.floor((data.leaveTime - data.joinTime) / 60);
  const joinStr = joinTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  const leaveStr = leaveTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  
  // Force refresh stats
  const totalHariIni = await getTotalDurasiHariIni(true);
  const totalBulanIni = await getTotalDurasiBulanIni(true);
  
  const now = new Date();
  const tanggal = now.toLocaleDateString("id-ID", { 
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const bulan = now.toLocaleDateString("id-ID", { 
    timeZone: "Asia/Jakarta",
    month: "2-digit",
    year: "numeric"
  });
  const hariSekarang = now.getUTCDate();

  try {
    await axios.post(DISCORD_WEBHOOK, {
      embeds: [{
        title: "📋 Absensi Admin",
        description: [
          `**Username:** ${data.username}`,
          `**🟢 Waktu Masuk:** ${joinStr}`,
          `**🔴 Waktu Keluar:** ${leaveStr}`,
          `**⏱️ Durasi Sesi Ini:** ${durasiMenit} menit`
        ].join("\n"),
        fields: [
          {
            name: `📅 Total Bermain Hari Ini (${tanggal})`,
            value: formatDurasi(totalHariIni),
            inline: false
          },
          {
            name: `📊 Total Bermain Bulan Ini (${bulan})`,
            value: formatDurasi(totalBulanIni),
            inline: false
          },
          {
            name: "📈 Rata-rata per Hari",
            value: formatDurasi(Math.floor(totalBulanIni / hariSekarang)),
            inline: false
          }
        ],
        color: 0x00b0f4,
        timestamp: new Date().toISOString()
      }]
    });
    console.log(`✅ Notifikasi terkirim untuk ${data.username}`);
  } catch (err) {
    console.error(`❌ Gagal kirim Discord:`, err.message);
  }
}

// Fungsi utama cek admin
async function checkAdmins() {
  console.log("\n🔍 Mengecek absensi admin...");
  
  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  
  let newSessionsFound = 0;
  
  for (const username of ADMIN_LIST) {
    const prefix = `${username}-${todayKey}`;
    const keys = await listDataStoreKeys(prefix);
    
    for (const keyObj of keys) {
      // Buat ID unik untuk sesi ini
      const sessionId = keyObj.key;
      
      // Skip jika sudah pernah diproses
      if (processedSessions.has(sessionId)) {
        continue;
      }
      
      const data = await fetchDataStore(keyObj.key);
      
      // Hanya proses jika leaveTime sudah ada (sesi selesai)
      if (data && data.joinTime && data.leaveTime) {
        console.log(`🆕 Sesi baru: ${username} (${sessionId})`);
        await sendDiscordEmbed(data);
        
        // Tandai sebagai sudah diproses
        processedSessions.add(sessionId);
        newSessionsFound++;
        saveCache();
        
        // Delay untuk menghindari rate limit Discord
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (newSessionsFound === 0) {
    console.log("✅ Tidak ada sesi baru");
  } else {
    console.log(`✅ ${newSessionsFound} sesi baru diproses`);
  }
  
  console.log(`📦 Total sesi dalam cache: ${processedSessions.size}`);
  console.log("⏳ Tunggu 30 detik...");
}

// Cleanup cache lama (hapus sesi > 7 hari yang lalu)
function cleanupOldSessions() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoffYear = sevenDaysAgo.getUTCFullYear();
  const cutoffMonth = String(sevenDaysAgo.getUTCMonth() + 1).padStart(2, "0");
  const cutoffDay = String(sevenDaysAgo.getUTCDate()).padStart(2, "0");
  const cutoffKey = `${cutoffYear}-${cutoffMonth}-${cutoffDay}`;
  
  const oldSize = processedSessions.size;
  const filtered = new Set(
    Array.from(processedSessions).filter(sessionId => {
      const match = sessionId.match(/-(\d{4}-\d{2}-\d{2})-/);
      if (match && match[1] < cutoffKey) {
        return false; // Hapus
      }
      return true; // Simpan
    })
  );
  
  processedSessions = filtered;
  const removed = oldSize - processedSessions.size;
  
  if (removed > 0) {
    console.log(`🧹 Cleanup: ${removed} sesi lama dihapus dari cache`);
    saveCache();
  }
}

// Jalankan
(async () => {
  await checkAdmins();
  setInterval(checkAdmins, 30 * 1000);
  
  // Cleanup setiap 6 jam
  setInterval(cleanupOldSessions, 6 * 60 * 60 * 1000);
})();
