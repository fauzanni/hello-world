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

// Simple structure: key = datastore key, value = sudah dikirim atau belum
let sentNotifications = {};
let statsCache = {
  totalHariIni: 0,
  totalBulanIni: 0,
  lastUpdateHariIni: null,
  lastUpdateBulanIni: null,
  currentDate: null
};

// Load cache
if (fs.existsSync(CACHE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    sentNotifications = data.sentNotifications || {};
    statsCache = data.statsCache || statsCache;
    
    const totalSent = Object.keys(sentNotifications).length;
    console.log(`🗂️ Cache dimuat. Total notifikasi yang pernah dikirim: ${totalSent}`);
  } catch (err) {
    console.warn("⚠️ Gagal baca cache:", err.message);
  }
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      sentNotifications,
      statsCache
    }, null, 2));
  } catch (err) {
    console.error("❌ Gagal simpan cache:", err.message);
  }
}

// Cleanup cache: hapus entri > 30 hari
function cleanupOldCache() {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  let cleaned = 0;
  
  for (const key in sentNotifications) {
    const timestamp = sentNotifications[key];
    if (now - timestamp > thirtyDaysMs) {
      delete sentNotifications[key];
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleanup: ${cleaned} entri lama dihapus`);
    saveCache();
  }
}

// Fungsi ambil data dari DataStore
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

// Fungsi list keys dengan prefix
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

// Hitung total durasi user pada tanggal tertentu
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

// Hitung total hari ini
async function getTotalDurasiHariIni(forceRefresh = false) {
  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  
  // Reset jika ganti hari
  if (statsCache.currentDate !== todayKey) {
    console.log("🔄 Ganti hari, reset cache");
    statsCache.totalHariIni = 0;
    statsCache.currentDate = todayKey;
    statsCache.lastUpdateHariIni = null;
  }
  
  // Gunakan cache (fresh 1 menit)
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
  
  return totalMenit;
}

// Hitung total bulan ini
async function getTotalDurasiBulanIni(forceRefresh = false) {
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  
  // Gunakan cache (fresh 5 menit)
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
  
  return totalMenit;
}

// Format durasi
function formatDurasi(totalMenit) {
  const jam = Math.floor(totalMenit / 60);
  const menit = totalMenit % 60;
  
  if (jam > 0) {
    return `${jam} jam ${menit} menit`;
  }
  return `${menit} menit`;
}

// Kirim notifikasi Discord
async function sendDiscordEmbed(data, datastoreKey) {
  const joinTime = new Date(data.joinTime * 1000);
  const leaveTime = new Date(data.leaveTime * 1000);
  const durasiMenit = Math.floor((data.leaveTime - data.joinTime) / 60);
  const joinStr = joinTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  const leaveStr = leaveTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  
  // Force refresh stats setelah sesi baru
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
    
    console.log(`✅ Notifikasi terkirim: ${data.username} (${datastoreKey})`);
    
    // Tandai sebagai sudah dikirim
    sentNotifications[datastoreKey] = Date.now();
    saveCache();
    
    return true;
  } catch (err) {
    console.error(`❌ Gagal kirim Discord:`, err.message);
    return false;
  }
}

// Fungsi utama cek admin
async function checkAdmins() {
  console.log("\n🔍 Mengecek absensi admin...");
  
  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  
  let newSessions = 0;
  let skippedSessions = 0;
  
  for (const username of ADMIN_LIST) {
    const prefix = `${username}-${todayKey}`;
    const keys = await listDataStoreKeys(prefix);
    
    for (const keyObj of keys) {
      const datastoreKey = keyObj.key;
      
      // CEK: Sudah pernah dikirim?
      if (sentNotifications[datastoreKey]) {
        skippedSessions++;
        continue; // Skip, sudah pernah dikirim
      }
      
      // Ambil data
      const data = await fetchDataStore(datastoreKey);
      
      // CEK: Apakah sesi sudah selesai (ada leaveTime)?
      if (!data || !data.leaveTime) {
        // Player masih online atau data tidak lengkap, skip
        continue;
      }
      
      // Sesi baru yang selesai dan belum pernah dikirim!
      console.log(`🆕 Sesi baru selesai: ${username}`);
      const success = await sendDiscordEmbed(data, datastoreKey);
      
      if (success) {
        newSessions++;
        // Delay untuk avoid Discord rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`📊 Ringkasan: ${newSessions} notif baru, ${skippedSessions} sesi sudah pernah dikirim`);
  console.log("⏳ Tunggu 30 detik...");
}

// Jalankan
(async () => {
  // Cleanup cache saat start
  cleanupOldCache();
  
  // Jalankan pengecekan pertama
  await checkAdmins();
  
  // Jalankan setiap 30 detik
  setInterval(checkAdmins, 30 * 1000);
  
  // Cleanup otomatis setiap 24 jam
  setInterval(cleanupOldCache, 24 * 60 * 60 * 1000);
})();
