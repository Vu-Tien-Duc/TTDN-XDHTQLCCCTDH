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
    // Fallback nếu MongoDB không hỗ trợ Transaction (Standalone hoặc Atlas M0 Free Tier)
    const msg = error?.message || '';
    const isTransactionUnsupported =
      msg.includes('replica set') ||
      msg.includes('Transaction numbers are only allowed') ||
      msg.includes('This MongoDB deployment does not support transactions') ||
      msg.includes('does not support retryable') ||
      msg.includes('Multi-document transactions') ||
      msg.includes('not allowed on Atlas free cluster') ||
      msg.includes('Transactions are not supported') ||
      error?.code === 20 || // MongoServerError: command not supported
      error?.codeName === 'IllegalOperation';

    if (isTransactionUnsupported) {
      console.warn(
        '⚠️ [TRANSACTION WARNING]: MongoDB không hỗ trợ Transaction (Standalone / Atlas M0). Fallback chạy không dùng transaction.'
      );
      return await workFn(null);
    }
    throw error;
  } finally {
    if (session) {
      try { session.endSession(); } catch (_) {}
    }
  }
};

module.exports = {
  runInTransaction,
};
