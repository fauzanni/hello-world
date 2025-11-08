import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

// Health check untuk Railway (opsional)
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

// 🧠 cache untuk deteksi perubahan dan statistik
const CACHE_FILE = "cache.json";
let lastLeaveTimes = {};
let statsCache = {
  totalHariIni: 0,
  totalBulanIni: 0,
  lastUpdateHariIni: null,
  lastUpdateBulanIni: null
};

// 🔹 Load cache kalau sudah ada
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

// Fungsi simpan cache
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

// Fungsi ambil data dari Roblox DataStore
async function fetchDataStore(username, dateKey) {
  try {
    const key = `${username}-${dateKey}`;
    const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE_NAME}&entryKey=${key}`;
    const res = await axios.get(url, {
      headers: { "x-api-key": API_KEY }
    });
    return res.data;
  } catch {
    return null;
  }
}

// Fungsi hitung total durasi hari ini (dengan cache 5 menit)
async function getTotalDurasiHariIni() {
  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  
  // Cek cache (refresh setiap 5 menit)
  if (statsCache.lastUpdateHariIni && 
      (Date.now() - statsCache.lastUpdateHariIni) < 5 * 60 * 1000 &&
      statsCache.todayKey === todayKey) {
    return statsCache.totalHariIni;
  }
  
  let totalMenit = 0;
  
  for (const username of ADMIN_LIST) {
    const data = await fetchDataStore(username, todayKey);
    if (data && data.joinTime && data.leaveTime) {
      const durasi = Math.floor((data.leaveTime - data.joinTime) / 60);
      totalMenit += durasi;
    }
    // Delay kecil untuk avoid rate limit
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Update cache
  statsCache.totalHariIni = totalMenit;
  statsCache.lastUpdateHariIni = Date.now();
  statsCache.todayKey = todayKey;
  saveCache();
  
  return totalMenit;
}

// Fungsi hitung total durasi bulan ini (dengan cache 15 menit)
async function getTotalDurasiBulanIni() {
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  
  // Cek cache (refresh setiap 15 menit)
  if (statsCache.lastUpdateBulanIni && 
      (Date.now() - statsCache.lastUpdateBulanIni) < 15 * 60 * 1000 &&
      statsCache.monthKey === monthKey) {
    return statsCache.totalBulanIni;
  }
  
  console.log("📊 Menghitung total bulan ini (ini займёт waktu)...");
  
  let totalMenit = 0;
  const tahun = now.getUTCFullYear();
  const bulan = String(now.getUTCMonth() + 1).padStart(2, "0");
  const hariSekarang = now.getUTCDate();
  
  // Hanya hitung sampai hari ini, bukan seluruh bulan
  for (let hari = 1; hari <= hariSekarang; hari++) {
    const tanggal = String(hari).padStart(2, "0");
    const dateKey = `${tahun}-${bulan}-${tanggal}`;
    
    for (const username of ADMIN_LIST) {
      const data = await fetchDataStore(username, dateKey);
      if (data && data.joinTime && data.leaveTime) {
        const durasi = Math.floor((data.leaveTime - data.joinTime) / 60);
        totalMenit += durasi;
      }
      // Delay untuk avoid rate limit
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  // Update cache
  statsCache.totalBulanIni = totalMenit;
  statsCache.lastUpdateBulanIni = Date.now();
  statsCache.monthKey = monthKey;
  saveCache();
  
  console.log("✅ Total bulan ini berhasil dihitung:", totalMenit, "menit");
  
  return totalMenit;
}

// Fungsi format durasi (menit ke jam & menit)
function formatDurasi(totalMenit) {
  const jam = Math.floor(totalMenit / 60);
  const menit = totalMenit % 60;
  
  if (jam > 0) {
    return `${jam} jam ${menit} menit`;
  }
  return `${menit} menit`;
}

// Fungsi kirim embed ke Discord
async function sendDiscordEmbed(data) {
  const joinTime = new Date(data.joinTime * 1000);
  const leaveTime = new Date(data.leaveTime * 1000);
  const durasiMenit = Math.floor((data.leaveTime - data.joinTime) / 60);
  const leaveStr = leaveTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  
  // Hitung statistik (dengan cache)
  const totalHariIni = await getTotalDurasiHariIni();
  const totalBulanIni = await getTotalDurasiBulanIni();
  
  const now = new Date();
  const tanggal = now.toLocaleDateString("id-ID", { 
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const bulan = now.toLocaleDateString("id-ID", { 
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit"
  });
  const hariSekarang = now.getUTCDate();

  try {
    await axios.post(DISCORD_WEBHOOK, {
      embeds: [{
        title: "📋 Absensi Admin",
        description: [
          `**Username:** ${data.username}`,
          `**⏰ Waktu Keluar:** ${leaveStr}`,
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
    const data = await fetchDataStore(username, todayKey);
    if (data && data.leaveTime) {
      const lastLeave = lastLeaveTimes[username];
      if (lastLeave !== data.leaveTime) {
        await sendDiscordEmbed(data);
        lastLeaveTimes[username] = data.leaveTime;
        saveCache();
      }
    }
  }
  console.log("⏳ Selesai cek, tunggu 30 detik lagi...\n");
}

// Jalankan terus
(async () => {
  await checkAdmins();
  setInterval(checkAdmins, 30 * 1000);
})();
