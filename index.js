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
  "mike_ezxo",
  "meme_jelimey",
  "Naynayy036",
  "Oktaa_cmll",
  "DIAL3010",
  "UNF0RGIVEN77",
  "raina_rain02",
  "GgelLs95",
  "sotakunnnn019"
];

const CACHE_FILE = "cache.json";

// Enhanced cache structure
let sentNotifications = {};
let statsCache = {
  // Cache per user per hari
  userDailyCache: {}, // Format: "username-YYYY-MM-DD" -> totalMenit
  userDailyCacheTime: {}, // Timestamp cache
  
  // Cache per user per bulan
  userMonthlyCache: {}, // Format: "username-YYYY-MM" -> totalMenit
  userMonthlyCacheTime: {}, // Timestamp cache
  
  currentDate: null
};

// Load cache
if (fs.existsSync(CACHE_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    sentNotifications = data.sentNotifications || {};
    statsCache = { ...statsCache, ...data.statsCache };
    
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
  
  // Cleanup sentNotifications
  for (const key in sentNotifications) {
    const timestamp = sentNotifications[key];
    if (now - timestamp > thirtyDaysMs) {
      delete sentNotifications[key];
      cleaned++;
    }
  }
  
  // Cleanup daily cache > 7 hari
  for (const key in statsCache.userDailyCache) {
    const timestamp = statsCache.userDailyCacheTime[key] || 0;
    if (now - timestamp > 7 * 24 * 60 * 60 * 1000) {
      delete statsCache.userDailyCache[key];
      delete statsCache.userDailyCacheTime[key];
      cleaned++;
    }
  }
  
  // Cleanup monthly cache > 60 hari
  for (const key in statsCache.userMonthlyCache) {
    const timestamp = statsCache.userMonthlyCacheTime[key] || 0;
    if (now - timestamp > 60 * 24 * 60 * 60 * 1000) {
      delete statsCache.userMonthlyCache[key];
      delete statsCache.userMonthlyCacheTime[key];
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleanup: ${cleaned} entri lama dihapus`);
    saveCache();
  }
}

// Fungsi ambil data dari DataStore dengan retry
async function fetchDataStore(key, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE_NAME}&entryKey=${encodeURIComponent(key)}`;
      const res = await axios.get(url, {
        headers: { "x-api-key": API_KEY },
        timeout: 10000
      });
      return res.data;
    } catch (err) {
      if (i === retries - 1) {
        console.error(`❌ Gagal fetch ${key} setelah ${retries} percobaan:`, err.message);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return null;
}

// Fungsi list keys dengan prefix - dengan pagination
async function listDataStoreKeys(prefix, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      let allKeys = [];
      let cursor = null;
      
      do {
        const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries?datastoreName=${DATASTORE_NAME}&prefix=${prefix}&limit=100${cursor ? `&cursor=${cursor}` : ''}`;
        const res = await axios.get(url, {
          headers: { "x-api-key": API_KEY },
          timeout: 10000
        });
        
        if (res.data.keys) {
          allKeys = allKeys.concat(res.data.keys);
        }
        
        cursor = res.data.nextPageCursor;
        
        if (cursor) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } while (cursor);
      
      return allKeys;
    } catch (err) {
      if (i === retries - 1) {
        console.error(`❌ Gagal list keys ${prefix} setelah ${retries} percobaan:`, err.message);
        return [];
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return [];
}

// Hitung total durasi user pada tanggal tertentu dengan cache
async function getTotalDurasiUserByDate(username, dateKey, useCache = true) {
  const cacheKey = `${username}-${dateKey}`;
  
  // Cek cache (fresh 5 menit untuk hari ini, permanent untuk hari lama)
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const isToday = dateKey === today;
  const cacheAge = now - (statsCache.userDailyCacheTime[cacheKey] || 0);
  const cacheExpiry = isToday ? 5 * 60 * 1000 : Infinity; // 5 menit untuk hari ini, permanent untuk hari lalu
  
  if (useCache && statsCache.userDailyCache[cacheKey] !== undefined && cacheAge < cacheExpiry) {
    return statsCache.userDailyCache[cacheKey];
  }
  
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
  
  // Simpan ke cache
  statsCache.userDailyCache[cacheKey] = totalMenit;
  statsCache.userDailyCacheTime[cacheKey] = now;
  
  return totalMenit;
}

// Hitung total user hari ini
async function getTotalUserHariIni(username, useCache = true) {
  const now = new Date();
  const todayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  return await getTotalDurasiUserByDate(username, todayKey, useCache);
}

// Hitung total user bulan ini dengan cache pintar
async function getTotalUserBulanIni(username, useCache = true) {
  const now = new Date();
  const tahun = now.getUTCFullYear();
  const bulan = String(now.getUTCMonth() + 1).padStart(2, "0");
  const monthKey = `${tahun}-${bulan}`;
  const cacheKey = `${username}-${monthKey}`;
  
  // Cek cache (fresh 10 menit)
  const cacheAge = Date.now() - (statsCache.userMonthlyCacheTime[cacheKey] || 0);
  if (useCache && statsCache.userMonthlyCache[cacheKey] !== undefined && cacheAge < 10 * 60 * 1000) {
    return statsCache.userMonthlyCache[cacheKey];
  }
  
  const hariSekarang = now.getUTCDate();
  let totalMenit = 0;
  
  // Hitung dari cache daily (lebih cepat)
  for (let hari = 1; hari <= hariSekarang; hari++) {
    const tanggal = String(hari).padStart(2, "0");
    const dateKey = `${tahun}-${bulan}-${tanggal}`;
    
    try {
      const userTotal = await getTotalDurasiUserByDate(username, dateKey, true);
      totalMenit += userTotal;
      await new Promise(resolve => setTimeout(resolve, 20));
    } catch (err) {
      console.error(`⚠️ Error menghitung ${username} pada ${dateKey}:`, err.message);
    }
  }
  
  // Simpan ke cache
  statsCache.userMonthlyCache[cacheKey] = totalMenit;
  statsCache.userMonthlyCacheTime[cacheKey] = Date.now();
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

// Kirim notifikasi Discord dengan error handling yang lebih baik
async function sendDiscordEmbed(data, datastoreKey) {
  const joinTime = new Date(data.joinTime * 1000);
  const leaveTime = new Date(data.leaveTime * 1000);
  const durasiMenit = Math.floor((data.leaveTime - data.joinTime) / 60);
  const joinStr = joinTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  const leaveStr = leaveTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  
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
    // Hitung total dengan error handling
    let totalUserHariIni = 0;
    let totalUserBulanIni = 0;
    let errorMsg = "";
    
    try {
      totalUserHariIni = await getTotalUserHariIni(data.username, true);
    } catch (err) {
      console.error(`⚠️ Error hitung total hari ini untuk ${data.username}:`, err.message);
      errorMsg += "⚠️ Error hitung total hari ini. ";
    }
    
    try {
      totalUserBulanIni = await getTotalUserBulanIni(data.username, true);
    } catch (err) {
      console.error(`⚠️ Error hitung total bulan ini untuk ${data.username}:`, err.message);
      errorMsg += "⚠️ Error hitung total bulan ini. ";
      // Fallback: gunakan cache lama kalau ada
      const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const cacheKey = `${data.username}-${monthKey}`;
      if (statsCache.userMonthlyCache[cacheKey] !== undefined) {
        totalUserBulanIni = statsCache.userMonthlyCache[cacheKey];
        errorMsg += "(Menggunakan data cache). ";
      }
    }
    
    const fields = [
      {
        name: `📅 Total Hari Ini (${tanggal})`,
        value: totalUserHariIni > 0 ? formatDurasi(totalUserHariIni) : "0 menit",
        inline: false
      },
      {
        name: `📊 Total Bulan Ini (${bulan})`,
        value: totalUserBulanIni > 0 ? formatDurasi(totalUserBulanIni) : "0 menit",
        inline: false
      }
    ];
    
    // Hanya tambah rata-rata kalau data valid
    if (totalUserBulanIni > 0 && hariSekarang > 0) {
      fields.push({
        name: "📈 Rata-rata per Hari",
        value: formatDurasi(Math.floor(totalUserBulanIni / hariSekarang)),
        inline: false
      });
    }
    
    await axios.post(DISCORD_WEBHOOK, {
      embeds: [{
        title: "📋 Absensi Admin",
        description: [
          `**Username:** ${data.username}`,
          `**🟢 Waktu Masuk:** ${joinStr}`,
          `**🔴 Waktu Keluar:** ${leaveStr}`,
          `**⏱️ Durasi Sesi Ini:** ${durasiMenit} menit`,
          errorMsg ? `\n${errorMsg}` : ""
        ].join("\n"),
        fields: fields,
        color: errorMsg ? 0xFFA500 : 0x00b0f4, // Orange kalau ada error
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
    try {
      const prefix = `${username}-${todayKey}`;
      const keys = await listDataStoreKeys(prefix);
      
      console.log(`   ${username}: ${keys.length} keys ditemukan`);
      
      for (const keyObj of keys) {
        const datastoreKey = keyObj.key;
        
        // CEK: Sudah pernah dikirim?
        if (sentNotifications[datastoreKey]) {
          skippedSessions++;
          continue;
        }
        
        // Ambil data
        const data = await fetchDataStore(datastoreKey);
        
        // CEK: Apakah sesi sudah selesai?
        if (!data || !data.leaveTime) {
          continue;
        }
        
        // Sesi baru yang selesai!
        console.log(`🆕 Sesi baru selesai: ${username}`);
        console.log(`   Key: ${datastoreKey}`);
        
        const success = await sendDiscordEmbed(data, datastoreKey);
        
        if (success) {
          newSessions++;
          // Invalidate cache setelah kirim notif
          const cacheKey = `${username}-${todayKey}`;
          delete statsCache.userDailyCache[cacheKey];
          
          const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
          const monthlyCacheKey = `${username}-${monthKey}`;
          delete statsCache.userMonthlyCache[monthlyCacheKey];
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (err) {
      console.error(`⚠️ Error memproses ${username}:`, err.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`📊 Ringkasan: ${newSessions} notif baru, ${skippedSessions} sesi sudah pernah dikirim`);
  console.log("⏳ Tunggu 30 detik...");
}

// Jalankan
(async () => {
  cleanupOldCache();
  await checkAdmins();
  setInterval(checkAdmins, 30 * 1000);
  setInterval(cleanupOldCache, 24 * 60 * 60 * 1000);
})();
