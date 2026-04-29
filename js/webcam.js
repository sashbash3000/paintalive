/**
 * Webcam module: handles camera access, preview, snapshot, and cleanup.
 */

let stream = null;
const videoEl = () => document.getElementById('webcam-video');

export async function startCamera() {
  const video = videoEl();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    console.error('Camera access denied:', err);
    throw err;
  }
}

export function captureFrame() {
  const video = videoEl();
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  const video = videoEl();
  if (video) video.srcObject = null;
}
