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
let lastLeaveTimes = {};
let statsCache = {
  totalHariIni: {},  // Ubah jadi object per tanggal
  totalBulanIni: {},
  lastUpdateHariIni: null,
  lastUpdateBulanIni: null,
  currentDate: null
};

// Load cache
if (fs.existsSync(CACHE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    lastLeaveTimes = data.lastLeaveTimes || {};
    statsCache = data.statsCache || statsCache;
    console.log("🗂️ Cache berhasil dimuat dari cache.json");
  } catch {
    console.warn("⚠️ Gagal baca cache.json, mulai dari kosong.");
  }
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      lastLeaveTimes,
      statsCache
    }, null, 2));
  } catch (err) {
    console.error("❌ Gagal simpan cache:", err.message);
  }
}

// Fungsi untuk list semua keys dengan prefix tertentu
async function listDataStoreKeys(prefix) {
  try {
    const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries?datastoreName=${DATASTORE_NAME}&prefix=${prefix}`;
    const res = await axios.get(url, {
      headers: { "x-api-key": API_KEY }
    });
    return res.data.keys || [];
  } catch (err) {
    console.error("❌ Error listing keys:", err.message);
    return [];
  }
}

// Fungsi ambil data dari Roblox DataStore
async function fetchDataStore(key) {
  try {
    const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE_NAME}&entryKey=${key}`;
    const res = await axios.get(url, {
      headers: { "x-api-key": API_KEY }
    });
    return res.data;
  } catch {
    return null;
  }
}

// Fungsi hitung total durasi hari ini untuk SATU user (semua sesi)
async function getTotalDurasiUserHariIni(username, dateKey) {
  try {
    // List semua keys untuk user di tanggal ini
    const keys = await listDataStoreKeys(`${username}-${dateKey}`);
    
    let totalMenit = 0;
    
    for (const keyObj of keys) {
      const data = await fetchDataStore(keyObj.key);
      if (data && data.joinTime && data.leaveTime) {
        const durasi = Math.floor((data.leaveTime - data.joinTime) / 60);
        totalMenit += durasi;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    return totalMenit;
  } catch (err) {
    console.error(`❌ Error getting total for ${username}:`, err.message);
    return 0;
  }
}

// Fungsi hitung total durasi hari ini SEMUA admin (dengan cache)
async function getTotalDurasiHariIni() {
  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  
  // Reset cache jika ganti hari
  if (statsCache.currentDate !== todayKey) {
    statsCache.totalHariIni = {};
    statsCache.currentDate = todayKey;
    console.log("🔄 Reset cache karena ganti hari");
  }
  
  // Cek cache (refresh setiap 2 menit)
  if (statsCache.lastUpdateHariIni && 
      (Date.now() - statsCache.lastUpdateHariIni) < 2 * 60 * 1000 &&
      statsCache.totalHariIni[todayKey]) {
    return statsCache.totalHariIni[todayKey];
  }
  
  console.log("📊 Menghitung total hari ini...");
  let totalMenit = 0;
  
  for (const username of ADMIN_LIST) {
    const userTotal = await getTotalDurasiUserHariIni(username, todayKey);
    totalMenit += userTotal;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Update cache
  statsCache.totalHariIni[todayKey] = totalMenit;
  statsCache.lastUpdateHariIni = Date.now();
  saveCache();
  
  console.log(`✅ Total hari ini: ${totalMenit} menit`);
  return totalMenit;
}

// Fungsi hitung total durasi bulan ini (dengan cache)
async function getTotalDurasiBulanIni() {
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  
  // Cek cache (refresh setiap 10 menit)
  if (statsCache.lastUpdateBulanIni && 
      (Date.now() - statsCache.lastUpdateBulanIni) < 10 * 60 * 1000 &&
      statsCache.totalBulanIni[monthKey]) {
    return statsCache.totalBulanIni[monthKey];
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
      const userTotal = await getTotalDurasiUserHariIni(username, dateKey);
      totalMenit += userTotal;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  // Update cache
  statsCache.totalBulanIni[monthKey] = totalMenit;
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

// Fungsi kirim SATU embed saja ke Discord
async function sendDiscordEmbed(data) {
  const joinTime = new Date(data.joinTime * 1000);
  const leaveTime = new Date(data.leaveTime * 1000);
  const durasiMenit = Math.floor((data.leaveTime - data.joinTime) / 60);
  const joinStr = joinTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  const leaveStr = leaveTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  
  // Hitung statistik
  const totalHariIni = await getTotalDurasiHariIni();
  const totalBulanIni = await getTotalDurasiBulanIni();
  
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
    console.error(`❌ Gagal kirim Discord untuk ${data.username}:`, err.message);
  }
}

// Fungsi utama cek admin
async function checkAdmins() {
  console.log("🔍 Mengecek absensi admin...");
  
  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  
  for (const username of ADMIN_LIST) {
    // List semua keys untuk user hari ini
    const keys = await listDataStoreKeys(`${username}-${todayKey}`);
    
    // Ambil entry terbaru
    if (keys.length > 0) {
      // Sort by key (assuming timestamp in key)
      keys.sort((a, b) => b.key.localeCompare(a.key));
      
      const latestKey = keys[0].key;
      const data = await fetchDataStore(latestKey);
      
      if (data && data.leaveTime) {
        const cacheKey = `${username}-${todayKey}`;
        const lastLeave = lastLeaveTimes[cacheKey];
        
        // Hanya kirim jika leaveTime berubah
        if (lastLeave !== data.leaveTime) {
          await sendDiscordEmbed(data);
          lastLeaveTimes[cacheKey] = data.leaveTime;
          saveCache();
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log("⏳ Selesai cek, tunggu 30 detik lagi...\n");
}

// Jalankan terus
(async () => {
  await checkAdmins();
  setInterval(checkAdmins, 30 * 1000);
})();
