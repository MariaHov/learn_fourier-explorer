const state = {
  sampleCount: 256,
  harmonicCount: 12,
  preset: 'sine',
  signal: [],
  spectrum: [],
  reconstruction: []
};

const els = {
  status: document.getElementById('status'),
  preset: document.getElementById('preset'),
  samples: document.getElementById('samples'),
  samplesValue: document.getElementById('samples-value'),
  harmonics: document.getElementById('harmonics'),
  harmonicsValue: document.getElementById('harmonics-value'),
  analyze: document.getElementById('btn-analyze'),
  play: document.getElementById('btn-play'),
  signalCanvas: document.getElementById('signal-canvas'),
  spectrumCanvas: document.getElementById('spectrum-canvas'),
  reconCanvas: document.getElementById('recon-canvas'),
  help: document.getElementById('btn-help'),
  helpDialog: document.getElementById('help-dialog'),
  closeHelp: document.getElementById('btn-close-help')
};

function setStatus(text) {
  els.status.textContent = text;
}

function generateSignal(type, count) {
  const values = [];
  for (let n = 0; n < count; n += 1) {
    const t = n / count;
    let value = 0;
    if (type === 'sine') value = Math.sin(2 * Math.PI * t);
    if (type === 'square') value = Math.sign(Math.sin(2 * Math.PI * t));
    if (type === 'triangle') value = 2 * Math.asin(Math.sin(2 * Math.PI * t)) / Math.PI;
    if (type === 'sawtooth') value = 2 * (t - Math.floor(t + 0.5));
    if (type === 'pulse') value = t % 1 < 0.2 ? 1 : -1;
    values.push(value);
  }
  return values;
}

function dft(signal) {
  const n = signal.length;
  const bins = [];
  for (let k = 0; k < n / 2; k += 1) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i += 1) {
      const angle = (2 * Math.PI * k * i) / n;
      re += signal[i] * Math.cos(angle);
      im -= signal[i] * Math.sin(angle);
    }
    re /= n;
    im /= n;
    bins.push({
      k,
      re,
      im,
      magnitude: Math.sqrt(re * re + im * im)
    });
  }
  return bins;
}

function reconstructSignal(spectrum, count, harmonics) {
  const output = [];
  for (let n = 0; n < count; n += 1) {
    let sum = 0;
    for (let k = 0; k < Math.min(harmonics, spectrum.length); k += 1) {
      const { re, im } = spectrum[k];
      const angle = (2 * Math.PI * k * n) / count;
      sum += re * Math.cos(angle) - im * Math.sin(angle);
    }
    output.push(sum * 2);
  }
  return output;
}

function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d6dce8';
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

function drawSignal(canvas, values, color) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  clearCanvas(ctx, width, height);
  if (!values.length) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height / 2 - value * (height * 0.4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawSpectrum(canvas, bins) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  clearCanvas(ctx, width, height);

  const visible = bins.slice(0, 64);
  const max = Math.max(...visible.map((b) => b.magnitude), 1e-6);
  const barWidth = width / visible.length;

  ctx.fillStyle = '#10a77f';
  visible.forEach((bin, i) => {
    const h = (bin.magnitude / max) * (height * 0.85);
    const x = i * barWidth + 1;
    const y = height - h;
    ctx.fillRect(x, y, Math.max(1, barWidth - 2), h);
  });
}

function analyze() {
  setStatus('Analyzing...');
  state.signal = generateSignal(state.preset, state.sampleCount);
  state.spectrum = dft(state.signal);
  state.reconstruction = reconstructSignal(
    state.spectrum,
    state.sampleCount,
    state.harmonicCount
  );

  drawSignal(els.signalCanvas, state.signal, '#2f7de1');
  drawSpectrum(els.spectrumCanvas, state.spectrum);
  drawSignal(els.reconCanvas, state.reconstruction, '#d1691b');
  setStatus('Ready');
}

function playSignal(values) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    setStatus('Audio not supported in this environment');
    return;
  }

  try {
    const context = new AudioContextClass();
    const duration = 1.5;
    const sampleRate = 22050;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i += 1) {
      const idx = Math.floor((i / frameCount) * values.length);
      channel[i] = values[idx] * 0.25;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();

    source.onended = () => {
      context.close().catch(() => {});
    };

    setStatus('Playing');
    setTimeout(() => setStatus('Ready'), duration * 1000);
  } catch (error) {
    console.error(error);
    setStatus('Audio failed to start');
  }
}

function bindEvents() {
  els.preset.addEventListener('change', (event) => {
    state.preset = event.target.value;
    analyze();
  });

  els.samples.addEventListener('input', (event) => {
    state.sampleCount = Number(event.target.value);
    els.samplesValue.textContent = String(state.sampleCount);
    analyze();
  });

  els.harmonics.addEventListener('input', (event) => {
    state.harmonicCount = Number(event.target.value);
    els.harmonicsValue.textContent = String(state.harmonicCount);
    state.reconstruction = reconstructSignal(state.spectrum, state.sampleCount, state.harmonicCount);
    drawSignal(els.reconCanvas, state.reconstruction, '#d1691b');
  });

  els.analyze.addEventListener('click', analyze);
  els.play.addEventListener('click', () => playSignal(state.reconstruction.length ? state.reconstruction : state.signal));

  els.help.addEventListener('click', () => els.helpDialog.showModal());
  els.closeHelp.addEventListener('click', () => els.helpDialog.close());
}

function init() {
  bindEvents();
  analyze();
}

init();
