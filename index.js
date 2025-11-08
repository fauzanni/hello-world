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
  "Raina_rain02"
];

// 🧠 cache untuk deteksi perubahan
const CACHE_FILE = "cache.json";
let lastLeaveTimes = {};

// 🔹 Load cache kalau sudah ada
if (fs.existsSync(CACHE_FILE)) {
  try {
    lastLeaveTimes = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    console.log("🗂️ Cache berhasil dimuat dari cache.json");
  } catch {
    console.warn("⚠️ Gagal baca cache.json, mulai dari kosong.");
  }
}

// Fungsi ambil data dari Roblox DataStore
async function fetchDataStore(username) {
  try {
    const date = new Date();
    const key = `${username}-${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE_NAME}&entryKey=${key}`;
    const res = await axios.get(url, {
      headers: { "x-api-key": API_KEY }
    });
    return res.data;
  } catch {
    return null;
  }
}

// Fungsi kirim embed ke Discord
async function sendDiscordEmbed(data) {
  const joinTime = new Date(data.joinTime * 1000);
  const leaveTime = new Date(data.leaveTime * 1000);
  const durasiMenit = Math.floor((data.leaveTime - data.joinTime) / 60);
  const joinStr = joinTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
  const leaveStr = leaveTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });

  try {
    await axios.post(DISCORD_WEBHOOK, {
      embeds: [{
        title: "📋 Absensi Admin",
        description: [
          `**Username:** ${data.username}`,
          `**Masuk:** ${joinStr}`,
          `**Keluar:** ${leaveStr}`,
          `**Durasi:** ${durasiMenit} menit`
        ].join("\n"),
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
  for (const username of ADMIN_LIST) {
    const data = await fetchDataStore(username);
    if (data && data.leaveTime) {
      const lastLeave = lastLeaveTimes[username];
      if (lastLeave !== data.leaveTime) {
        await sendDiscordEmbed(data);
        lastLeaveTimes[username] = data.leaveTime;
        // 🔹 Simpan cache setiap update baru
        fs.writeFileSync(CACHE_FILE, JSON.stringify(lastLeaveTimes, null, 2));
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