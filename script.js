const IMAGE_MODEL = 'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5';

const tabButtons = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.panel');

const imageGrid = document.getElementById('image-grid');
const imageStatus = document.getElementById('image-status');
const videoStatus = document.getElementById('video-status');
const editStatus = document.getElementById('edit-status');

const imageCanvas = document.getElementById('image-canvas');
const imageCtx = imageCanvas.getContext('2d');
let loadedImage = null;

const videoPreview = document.getElementById('video-preview');
const createdVideo = document.getElementById('created-video');
let uploadedVideoFile = null;

function getApiKey() {
  return document.getElementById('api-key').value.trim();
}

function switchTab(tabId) {
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));
  panels.forEach((panel) => panel.classList.toggle('active', panel.id === tabId));
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

async function generateImageBlob(prompt) {
  const key = getApiKey();
  if (!key) {
    throw new Error('Please provide your Hugging Face API key first.');
  }

  const response = await fetch(IMAGE_MODEL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: prompt }),
  });

  if (!response.ok) {
    throw new Error('Image generation failed. Check API key, quota, or try another prompt.');
  }

  return response.blob();
}

async function onGenerateImages() {
  const prompt = document.getElementById('image-prompt').value.trim();
  const style = document.getElementById('image-style').value;
  const count = Math.min(Math.max(Number(document.getElementById('image-count').value) || 1, 1), 6);

  if (!prompt) {
    imageStatus.textContent = 'Please enter an image prompt.';
    return;
  }

  imageGrid.innerHTML = '';
  imageStatus.textContent = 'Generating images...';

  try {
    for (let i = 0; i < count; i += 1) {
      const fullPrompt = `${prompt}, ${style}, variation ${Math.floor(Math.random() * 10000)}`;
      const blob = await generateImageBlob(fullPrompt);
      const url = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.src = url;
      img.alt = `AI result ${i + 1}`;
      img.addEventListener('click', () => downloadFile(url, `ai-image-${i + 1}.png`));
      imageGrid.appendChild(img);
    }
    imageStatus.textContent = 'Done. Click any image to download it.';
  } catch (error) {
    imageStatus.textContent = error.message;
  }
}

document.getElementById('generate-images').addEventListener('click', onGenerateImages);

function drawEditedImage() {
  if (!loadedImage) {
    return;
  }

  const brightness = Number(document.getElementById('brightness').value);
  const contrast = Number(document.getElementById('contrast').value);
  const saturation = Number(document.getElementById('saturation').value);
  const blur = Number(document.getElementById('blur').value);
  const grayscale = document.getElementById('grayscale').checked;

  imageCtx.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
  imageCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px) ${grayscale ? 'grayscale(100%)' : ''}`;

  const scale = Math.min(imageCanvas.width / loadedImage.width, imageCanvas.height / loadedImage.height);
  const drawWidth = loadedImage.width * scale;
  const drawHeight = loadedImage.height * scale;
  const x = (imageCanvas.width - drawWidth) / 2;
  const y = (imageCanvas.height - drawHeight) / 2;

  imageCtx.drawImage(loadedImage, x, y, drawWidth, drawHeight);
  imageCtx.filter = 'none';
}

document.getElementById('image-upload').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    loadedImage = img;
    drawEditedImage();
  };
  img.src = url;
});

['brightness', 'contrast', 'saturation', 'blur', 'grayscale'].forEach((id) => {
  document.getElementById(id).addEventListener('input', drawEditedImage);
});

document.getElementById('download-image').addEventListener('click', () => {
  const url = imageCanvas.toDataURL('image/png');
  downloadFile(url, 'edited-image.png');
});

function downloadFile(url, fileName) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
}

async function onGenerateVideo() {
  const prompt = document.getElementById('video-prompt').value.trim();
  const frameCount = Math.min(Math.max(Number(document.getElementById('video-frames').value) || 8, 4), 14);

  if (!prompt) {
    videoStatus.textContent = 'Please enter a video prompt.';
    return;
  }

  videoStatus.textContent = 'Generating frames and composing video...';

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 432;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(5);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };

    const done = new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });

    recorder.start();

    for (let i = 0; i < frameCount; i += 1) {
      const promptFrame = `${prompt}, cinematic frame ${i + 1}, motion blur, consistent scene`;
      const blob = await generateImageBlob(promptFrame);
      const bitmap = await createImageBitmap(blob);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    recorder.stop();
    const finalVideoBlob = await done;
    const videoUrl = URL.createObjectURL(finalVideoBlob);
    createdVideo.src = videoUrl;
    createdVideo.dataset.generated = 'true';
    videoStatus.textContent = 'Video generated! You can save it with right click > Save video as.';
  } catch (error) {
    videoStatus.textContent = error.message;
  }
}

document.getElementById('generate-video').addEventListener('click', onGenerateVideo);

document.getElementById('video-upload').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  uploadedVideoFile = file;
  videoPreview.src = URL.createObjectURL(file);
});

function getVideoFilterCss() {
  const filter = document.getElementById('video-filter').value;
  if (filter === 'cinematic') return 'contrast(1.12) saturate(1.2) brightness(0.92)';
  if (filter === 'bw') return 'grayscale(1) contrast(1.1)';
  if (filter === 'vivid') return 'saturate(1.45) contrast(1.08)';
  return 'none';
}

function applyPreviewAdjustments() {
  videoPreview.playbackRate = Number(document.getElementById('video-speed').value);
  videoPreview.style.filter = getVideoFilterCss();
}

document.getElementById('video-filter').addEventListener('change', applyPreviewAdjustments);
document.getElementById('video-speed').addEventListener('change', applyPreviewAdjustments);

async function exportEditedVideo() {
  if (!uploadedVideoFile) {
    editStatus.textContent = 'Please upload a video first.';
    return;
  }

  const start = Number(document.getElementById('trim-start').value) || 0;
  const end = Number(document.getElementById('trim-end').value) || 0;

  if (end <= start) {
    editStatus.textContent = 'End time must be greater than start time.';
    return;
  }

  editStatus.textContent = 'Exporting edited clip...';

  const video = document.createElement('video');
  video.src = URL.createObjectURL(uploadedVideoFile);
  video.muted = true;
  video.playsInline = true;

  await new Promise((resolve) => {
    video.onloadedmetadata = resolve;
  });
  video.pause();

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 360;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
  });

  const filterCss = getVideoFilterCss();
  const speed = Number(document.getElementById('video-speed').value);

  recorder.start();
  video.currentTime = start;

  await new Promise((resolve) => {
    video.onseeked = resolve;
  });

  function draw() {
    if (video.currentTime >= end || video.paused || video.ended) {
      recorder.stop();
      return;
    }

    ctx.filter = filterCss;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    requestAnimationFrame(draw);
  }

  video.playbackRate = speed;
  await video.play();
  draw();

  const blob = await done;
  const url = URL.createObjectURL(blob);
  videoPreview.src = url;
  downloadFile(url, 'edited-video.webm');
  editStatus.textContent = 'Export finished and downloaded.';
}

document.getElementById('export-video').addEventListener('click', exportEditedVideo);
