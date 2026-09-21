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
        min: [-90, 'Vĩ độ (lat) phải nằm trong khoảng -90 đến 90'],
        max: [90, 'Vĩ độ (lat) phải nằm trong khoảng -90 đến 90'],
        default: null,
      },
      lng: {
        type: Number,
        min: [-180, 'Kinh độ (lng) phải nằm trong khoảng -180 đến 180'],
        max: [180, 'Kinh độ (lng) phải nằm trong khoảng -180 đến 180'],
        default: null,
      },
    },
  },
  {
    timestamps: true,
    collection: 'departments',
  }
);

departmentSchema.index(
  { parentId: 1, name: 1 },
  { unique: true, collation: { locale: 'vi', strength: 2 } }
);
departmentSchema.index({ managerId: 1 });

module.exports = mongoose.model('Department', departmentSchema, 'departments');
