require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function exportDatabase() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_attendance_db';
    console.log('Connecting to local MongoDB:', uri);
    await mongoose.connect(uri);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const backupData = {};
    console.log(`\nTìm thấy ${collections.length} collections:`);

    for (const col of collections) {
      const name = col.name;
      if (name.startsWith('system.')) continue;

      const docs = await db.collection(name).find({}).toArray();
      backupData[name] = docs;
      console.log(` - ${name}: ${docs.length} bản ghi`);
    }

    const outputPath = path.join(__dirname, 'database_backup.json');
    fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), 'utf-8');

    console.log(`\n✅ ĐÃ XUẤT DATABASE THÀNH CÔNG ra file: database_backup.json (${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB)`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Lỗi khi export:', error);
    process.exit(1);
  }
}

exportDatabase();
