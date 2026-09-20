require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');

async function checkFaces() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_attendance_db';
  await mongoose.connect(uri);
  const allUsers = await User.find({}).select('+faceDescriptor fullName email role');
  console.log('--- ALL USERS FACE STATUS ---');
  for (const u of allUsers) {
    const hasFace = Array.isArray(u.faceDescriptor) && u.faceDescriptor.length === 128;
    console.log(`[${hasFace ? 'HAS_FACE' : 'NO_FACE'}] ${u.fullName} (${u.email}) - Role: ${u.role}`);
  }
  process.exit(0);
}

checkFaces().catch(console.error);
