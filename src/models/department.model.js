const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên khoa/bộ môn/phòng ban là bắt buộc'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['khoa', 'bomon', 'phongban'],
      required: [true, 'Loại đơn vị (khoa, bomon, phongban) là bắt buộc'],
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    location: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    collection: 'departments',
  }
);

module.exports = mongoose.model('Department', departmentSchema, 'departments');
