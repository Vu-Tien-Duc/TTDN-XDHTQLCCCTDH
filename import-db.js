require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Hàm đệ quy phục hồi ObjectId và Date từ JSON
function restoreTypes(obj) {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => restoreTypes(item));
  }

  if (typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];

      // Nếu là _id hoặc các trường id tham chiếu (kết thúc bằng Id hoặc là _id) có dạng 24 hex char
      if (
        (key === '_id' || key.endsWith('Id') || key === 'managerId' || key === 'parentId' || key === 'userId' || key === 'shiftId' || key === 'scheduleId' || key === 'departmentId') &&
        typeof val === 'string' &&
        /^[0-9a-fA-F]{24}$/.test(val)
      ) {
        result[key] = new mongoose.Types.ObjectId(val);
      } else if (
        typeof val === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val) &&
        !isNaN(Date.parse(val))
      ) {
        // Nếu là ISO Date string
        result[key] = new Date(val);
      } else {
        result[key] = restoreTypes(val);
      }
    }
    return result;
  }

  return obj;
}

async function importDatabase() {
  try {
    const backupFile = path.join(__dirname, 'database_backup.json');
    if (!fs.existsSync(backupFile)) {
      console.error(`❌ Không tìm thấy file dữ liệu: ${backupFile}`);
      process.exit(1);
    }

    const rawData = fs.readFileSync(backupFile, 'utf-8');
    const backupData = JSON.parse(rawData);

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_attendance_db';
    console.log('Connecting to MongoDB on VPS:', uri);
    await mongoose.connect(uri);

    const db = mongoose.connection.db;

    for (const [colName, rawDocs] of Object.entries(backupData)) {
      if (!Array.isArray(rawDocs) || rawDocs.length === 0) {
        console.log(` - ${colName}: Bỏ qua (0 bản ghi)`);
        continue;
      }

      const docs = restoreTypes(rawDocs);

      // Xóa collection cũ trước khi nạp
      try {
        await db.collection(colName).drop();
      } catch (e) {}

      await db.collection(colName).insertMany(docs);
      console.log(` ✅ Đã nhập ${docs.length} bản ghi vào collection: ${colName}`);
    }

    console.log('\n🎉 HOÀN TẤT ĐỒNG BỘ 100% DỮ LIỆU TỪ MÁY BẠN LÊN VPS!');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Lỗi khi import:', error);
    process.exit(1);
  }
}

importDatabase();
