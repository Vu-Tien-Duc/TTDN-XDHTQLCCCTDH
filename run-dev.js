const { spawn } = require('child_process');

console.log('\x1b[36m%s\x1b[0m', '=====================================================');
console.log('\x1b[32m%s\x1b[0m', '🚀 Đang khởi động Hệ thống Chấm công & Lịch giảng dạy:');
console.log('\x1b[33m%s\x1b[0m', '   - Backend API:  http://localhost:5000');
console.log('\x1b[35m%s\x1b[0m', '   - Frontend Web: http://localhost:5173');
console.log('\x1b[36m%s\x1b[0m', '=====================================================');

const backend = spawn('npm', ['run', 'server'], {
  shell: true,
  stdio: 'inherit',
});

const frontend = spawn('npm', ['run', 'dev', '--prefix', 'frontend'], {
  shell: true,
  stdio: 'inherit',
});

const cleanExit = () => {
  try {
    backend.kill();
    frontend.kill();
  } catch (e) {}
  process.exit();
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
process.on('exit', cleanExit);
