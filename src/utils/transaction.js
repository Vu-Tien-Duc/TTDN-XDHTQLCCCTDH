const mongoose = require('mongoose');

/**
 * Thực thi một hàm trong MongoDB Transaction nếu hệ thống hỗ trợ (Replica Set / Sharded / Atlas).
 * Tự động fallback chạy không transaction nếu môi trường MongoDB là Standalone (chưa cấu hình replica set).
 *
 * @param {Function} workFn - Hàm thực thi nhận `session` làm tham số
 * @returns {Promise<any>}
 */
const runInTransaction = async (workFn) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await workFn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (_) {}
    }
    // Nếu MongoDB cục bộ là standalone chưa bật replica set
    if (
      error.message &&
      (error.message.includes('replica set') ||
        error.message.includes('Transaction numbers are only allowed') ||
        error.message.includes('This MongoDB deployment does not support transactions'))
    ) {
      console.warn(
        '⚠️ [TRANSACTION WARNING]: MongoDB hiện tại hoạt động ở chế độ Standalone (không hỗ trợ Transaction). Đang fallback thực thi không dùng transaction. Khuyến nghị bật Replica Set hoặc dùng MongoDB Atlas cho môi trường chính thức để đảm bảo tính toàn vẹn dữ liệu.'
      );
      return await workFn(null);
    }
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

module.exports = {
  runInTransaction,
};
