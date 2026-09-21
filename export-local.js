const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const LOCAL_URI = "mongodb://localhost:27017/university_attendance_db";

async function exportFromLocal() {
  try {
    console.log("Connecting to LOCAL MongoDB:", LOCAL_URI);
    await mongoose.connect(LOCAL_URI);
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const backupData = {};
    console.log("\nTim thay " + collections.length + " collections:");
    for (const col of collections) {
      const name = col.name;
      if (name.startsWith("system.")) continue;
      const docs = await db.collection(name).find({}).toArray();
      backupData[name] = docs;
      console.log(" - " + name + ": " + docs.length + " ban ghi");
    }
    const outputPath = path.join(__dirname, "database_backup.json");
    fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), "utf-8");
    const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(2);
    console.log("\n[OK] DA XUAT LOCAL DB: database_backup.json (" + sizeKB + " KB)");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Loi:", error.message);
    process.exit(1);
  }
}

exportFromLocal();
