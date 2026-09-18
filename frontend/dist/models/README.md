# Face API Model Weights Directory

Thư mục này lưu trữ các file weights của thư viện `face-api.js` phục vụ chức năng nhận diện khuôn mặt (TV B):
- `tiny_face_detector_model-weights_manifest.json` và shard files
- `face_landmark_68_model-weights_manifest.json` và shard files
- `face_recognition_model-weights_manifest.json` và shard files

Lưu ý:
- Tải weights từ repository chính thức của face-api.js hoặc `@vladmandic/face-api`.
- Model sẽ được nạp trong component camera: `faceapi.nets.tinyFaceDetector.loadFromUri('/models')`.
