const state = {
  sampleCount: 256,
  source: 'clean-speech-file',
  sampleRate: 44100,
  whiteNoiseAmount: 0.2,
  humNoiseAmount: 0.35,
  humBin: 8,
  lowPassCutoff: 24,
  notchEnabled: true,
  notchWidth: 1,
  cleanSignal: [],
  noisySignal: [],
  filteredSignal: [],
  noisySpectrum: [],
  filteredSpectrum: [],
  cleanSpeechSignal: null
};

const els = {
  status: document.getElementById('status'),
  source: document.getElementById('source'),
  samples: document.getElementById('samples'),
  samplesValue: document.getElementById('samples-value'),
  whiteNoise: document.getElementById('white-noise'),
  whiteNoiseValue: document.getElementById('white-noise-value'),
  humNoise: document.getElementById('hum-noise'),
  humNoiseValue: document.getElementById('hum-noise-value'),
  humBin: document.getElementById('hum-bin'),
  humBinValue: document.getElementById('hum-bin-value'),
  lowPass: document.getElementById('low-pass'),
  lowPassValue: document.getElementById('low-pass-value'),
  notchEnabled: document.getElementById('notch-enabled'),
  notchWidth: document.getElementById('notch-width'),
  notchWidthValue: document.getElementById('notch-width-value'),
  analyze: document.getElementById('btn-analyze'),
  playNoisy: document.getElementById('btn-play-noisy'),
  playFiltered: document.getElementById('btn-play-filtered'),
  signalCanvas: document.getElementById('signal-canvas'),
  noisySpectrumCanvas: document.getElementById('spectrum-noisy-canvas'),
  filteredSpectrumCanvas: document.getElementById('spectrum-filtered-canvas'),
  componentsList: document.getElementById('components-list'),
  help: document.getElementById('btn-help'),
  helpDialog: document.getElementById('help-dialog'),
  closeHelp: document.getElementById('btn-close-help')
};

function setStatus(text) {
  els.status.textContent = text;
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function maxBinFromSampleCount(sampleCount) {
  return Math.max(1, Math.floor(sampleCount / 2) - 1);
}

function updateBinControlBounds() {
  const maxBin = maxBinFromSampleCount(state.sampleCount);
  els.humBin.max = String(maxBin);
  els.lowPass.max = String(maxBin);
  state.humBin = clamp(state.humBin, 1, maxBin);
  state.lowPassCutoff = clamp(state.lowPassCutoff, 1, maxBin);
  els.humBin.value = String(state.humBin);
  els.lowPass.value = String(state.lowPassCutoff);
  els.humBinValue.textContent = String(state.humBin);
  els.lowPassValue.textContent = String(state.lowPassCutoff);
}

async function loadCleanSpeechSignal() {
  if (state.cleanSpeechSignal && state.cleanSpeechSignal.length) {
    return state.cleanSpeechSignal;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not available.');
  }

  const context = new AudioContextClass();
  try {
    const response = await fetch('./assets/audio/clean-speech.wav');
    if (!response.ok) {
      throw new Error('clean-speech.wav not found');
    }

    const buffer = await response.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(buffer);
    const raw = audioBuffer.getChannelData(0);
    state.sampleRate = audioBuffer.sampleRate || state.sampleRate;
    state.cleanSpeechSignal = Array.from(raw);
    return state.cleanSpeechSignal;
  } finally {
    context.close().catch(() => {});
  }
}

function generateBaseSignal(type, count) {
  const values = [];
  for (let n = 0; n < count; n += 1) {
    const t = n / count;
    let value = 0;
    if (type === 'sine') value = Math.sin(2 * Math.PI * t);
    if (type === 'square') value = Math.sign(Math.sin(2 * Math.PI * t));
    if (type === 'triangle') value = 2 * Math.asin(Math.sin(2 * Math.PI * t)) / Math.PI;
    if (type === 'sawtooth') value = 2 * (t - Math.floor(t + 0.5));
    if (type === 'pulse') value = t % 1 < 0.2 ? 1 : -1;
    if (type === 'voice-like') {
      value = (
        0.65 * Math.sin(2 * Math.PI * t) +
        0.35 * Math.sin(2 * Math.PI * 3 * t + 0.4) +
        0.2 * Math.sin(2 * Math.PI * 5 * t + 0.1)
      );
    }
    values.push(value);
  }
  return values;
}

function sampleToLength(signal, targetCount) {
  if (!signal.length) return [];
  if (signal.length === targetCount) return signal.slice();
  const sampled = [];
  const lastIndex = signal.length - 1;
  for (let index = 0; index < targetCount; index += 1) {
    const sourceIndex = Math.floor((index / (targetCount - 1 || 1)) * lastIndex);
    sampled.push(signal[sourceIndex]);
  }
  return sampled;
}

function addNoise(signal, whiteNoiseAmount, humNoiseAmount, humFrequencyHz, sampleRate) {
  if (!signal.length) return [];
  return signal.map((sample, index) => {
    const randomNoise = (Math.random() * 2 - 1) * whiteNoiseAmount;
    const humNoise = humNoiseAmount *
      Math.sin((2 * Math.PI * humFrequencyHz * index) / sampleRate);
    return sample + randomNoise + humNoise;
  });
}

function humFrequencyHz() {
  return (state.humBin * state.sampleRate) / state.sampleCount;
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

function filterSpectrum(spectrum, options) {
  return spectrum.map((bin) => {
    const inLowPass = bin.k <= options.lowPassCutoff;
    const inNotch = options.notchEnabled &&
      Math.abs(bin.k - options.humBin) <= options.notchWidth;
    if (!inLowPass || inNotch) {
      return { ...bin, re: 0, im: 0, magnitude: 0 };
    }
    return { ...bin };
  });
}

function reconstructFromHalfSpectrum(spectrum, count) {
  const output = [];
  for (let n = 0; n < count; n += 1) {
    let sample = 0;
    for (let k = 0; k < spectrum.length; k += 1) {
      const { re, im } = spectrum[k];
      const angle = (2 * Math.PI * k * n) / count;
      const contribution = re * Math.cos(angle) - im * Math.sin(angle);
      sample += k === 0 ? contribution : 2 * contribution;
    }
    output.push(sample);
  }
  return output;
}

function clearCanvas(ctx, width, height, yAxisOnly = false) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d6dce8';
  ctx.beginPath();
  if (yAxisOnly) {
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
  } else {
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
  }
  ctx.stroke();
}

function drawSingleSignal(canvas, values, color) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
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

function drawSignalComparison(canvas, noisy, filtered) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  clearCanvas(ctx, width, height, true);
  if (!noisy.length) return;
  drawSingleSignal(canvas, noisy, '#2f7de1');
  if (filtered.length) {
    drawSingleSignal(canvas, filtered, '#d1691b');
  }
}

function drawSpectrum(canvas, bins, color) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  clearCanvas(ctx, width, height);

  const visible = bins.slice(0, 64);
  if (!visible.length) return;
  const max = Math.max(...visible.map((bin) => bin.magnitude), 1e-6);
  const barWidth = width / visible.length;

  ctx.fillStyle = color;
  visible.forEach((bin, i) => {
    const barHeight = (bin.magnitude / max) * (height * 0.85);
    const x = i * barWidth + 1;
    const y = height - barHeight;
    ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);
  });
}

function renderComponentsList(spectrum) {
  if (!els.componentsList) return;
  const top = spectrum
    .filter((bin) => bin.k > 0)
    .slice()
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 6);

  if (!top.length) {
    els.componentsList.innerHTML = '<li>No components yet</li>';
    return;
  }

  const listItems = top.map((bin) => {
    const hz = (bin.k * state.sampleRate) / state.sampleCount;
    return `<li>${hz.toFixed(1)} Hz (bin ${bin.k}) - ${bin.magnitude.toFixed(4)}</li>`;
  });
  els.componentsList.innerHTML = listItems.join('');
}

async function runAnalysis() {
  if (state.source === 'clean-speech-file') {
    setStatus('Loading audio...');
    const speechSignal = await loadCleanSpeechSignal();
    state.cleanSignal = sampleToLength(speechSignal, state.sampleCount);
  } else {
    state.cleanSignal = generateBaseSignal(state.source, state.sampleCount);
    state.sampleRate = 44100;
  }

  const humHz = humFrequencyHz();
  state.noisySignal = addNoise(
    state.cleanSignal,
    state.whiteNoiseAmount,
    state.humNoiseAmount,
    humHz,
    state.sampleRate
  );
  state.noisySpectrum = dft(state.noisySignal);
  state.filteredSpectrum = filterSpectrum(state.noisySpectrum, {
    lowPassCutoff: state.lowPassCutoff,
    notchEnabled: state.notchEnabled,
    humBin: state.humBin,
    notchWidth: state.notchWidth
  });
  state.filteredSignal = reconstructFromHalfSpectrum(state.filteredSpectrum, state.sampleCount);
}

function render() {
  drawSignalComparison(els.signalCanvas, state.noisySignal, state.filteredSignal);
  drawSpectrum(els.noisySpectrumCanvas, state.noisySpectrum, '#10a77f');
  drawSpectrum(els.filteredSpectrumCanvas, state.filteredSpectrum, '#d1691b');
  renderComponentsList(state.noisySpectrum);
}

async function analyze() {
  setStatus('Analyzing...');
  try {
    await runAnalysis();
    render();
    setStatus('Ready');
  } catch (error) {
    console.error(error);
    setStatus('Failed to load audio');
  }
}

function playSignal(values, statusLabel) {
  if (!values.length) return;
  const peak = Math.max(...values.map((value) => Math.abs(value)), 1e-6);
  const normalized = values.map((value) => value / peak);

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    setStatus('Audio not supported in this environment');
    return;
  }

  try {
    const context = new AudioContextClass();
    context.resume().catch(() => {});
    const duration = 1.5;
    const sampleRate = 22050;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i += 1) {
      const idx = Math.floor((i / frameCount) * normalized.length);
      channel[i] = normalized[idx] * 0.25;
    }

    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    gainNode.gain.value = 0.9;
    sourceNode.buffer = buffer;
    sourceNode.connect(gainNode);
    gainNode.connect(context.destination);
    sourceNode.start();

    sourceNode.onended = () => {
      context.close().catch(() => {});
    };

    setStatus(statusLabel);
    setTimeout(() => setStatus('Ready'), duration * 1000);
  } catch (error) {
    console.error(error);
    setStatus('Audio failed to start');
  }
}

function normalizeSignal(signal, gain = 0.4) {
  const peak = Math.max(...signal.map((value) => Math.abs(value)), 1e-6);
  return signal.map((value) => (value / peak) * gain);
}

function createAudioBuffer(context, signal, sampleRate) {
  const normalized = normalizeSignal(signal);
  const buffer = context.createBuffer(1, normalized.length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < normalized.length; i += 1) {
    channel[i] = normalized[i];
  }
  return buffer;
}

async function playSpeechBuffer(mode) {
  if (!state.cleanSpeechSignal || !state.cleanSpeechSignal.length) {
    await analyze();
    if (!state.cleanSpeechSignal || !state.cleanSpeechSignal.length) {
      return;
    }
  }

  const maxSeconds = 4;
  const maxSamples = Math.min(
    state.cleanSpeechSignal.length,
    Math.floor(state.sampleRate * maxSeconds)
  );
  const speech = state.cleanSpeechSignal.slice(0, maxSamples);
  const noisySpeech = addNoise(
    speech,
    state.whiteNoiseAmount,
    state.humNoiseAmount,
    humFrequencyHz(),
    state.sampleRate
  );

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    setStatus('Audio not supported in this environment');
    return;
  }

  try {
    const context = new AudioContextClass();
    await context.resume();
    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    gainNode.gain.value = 0.9;
    sourceNode.buffer = createAudioBuffer(context, noisySpeech, state.sampleRate);

    if (mode === 'filtered') {
      const notch = context.createBiquadFilter();
      notch.type = 'notch';
      notch.frequency.value = clamp(humFrequencyHz(), 20, state.sampleRate / 2 - 100);
      notch.Q.value = 18 / (state.notchWidth + 1);

      const lowPass = context.createBiquadFilter();
      lowPass.type = 'lowpass';
      const cutoffHz = (state.lowPassCutoff * state.sampleRate) / state.sampleCount;
      lowPass.frequency.value = clamp(cutoffHz, 120, state.sampleRate / 2 - 100);
      lowPass.Q.value = 0.707;

      if (state.notchEnabled) {
        sourceNode.connect(notch);
        notch.connect(lowPass);
      } else {
        sourceNode.connect(lowPass);
      }
      lowPass.connect(gainNode);
      gainNode.connect(context.destination);
      setStatus('Playing filtered');
    } else {
      sourceNode.connect(gainNode);
      gainNode.connect(context.destination);
      setStatus('Playing noisy');
    }

    sourceNode.start();
    sourceNode.onended = () => {
      context.close().catch(() => {});
      setStatus('Ready');
    };
  } catch (error) {
    console.error(error);
    setStatus('Audio failed to start');
  }
}

function bindEvents() {
  els.source.addEventListener('change', (event) => {
    state.source = event.target.value;
    analyze().catch(() => {});
  });

  els.samples.addEventListener('input', (event) => {
    state.sampleCount = Number(event.target.value);
    els.samplesValue.textContent = String(state.sampleCount);
    updateBinControlBounds();
    analyze().catch(() => {});
  });

  els.whiteNoise.addEventListener('input', (event) => {
    state.whiteNoiseAmount = Number(event.target.value);
    els.whiteNoiseValue.textContent = state.whiteNoiseAmount.toFixed(2);
    analyze().catch(() => {});
  });

  els.humNoise.addEventListener('input', (event) => {
    state.humNoiseAmount = Number(event.target.value);
    els.humNoiseValue.textContent = state.humNoiseAmount.toFixed(2);
    analyze().catch(() => {});
  });

  els.humBin.addEventListener('input', (event) => {
    state.humBin = Number(event.target.value);
    els.humBinValue.textContent = String(state.humBin);
    analyze().catch(() => {});
  });

  els.lowPass.addEventListener('input', (event) => {
    state.lowPassCutoff = Number(event.target.value);
    els.lowPassValue.textContent = String(state.lowPassCutoff);
    analyze().catch(() => {});
  });

  els.notchEnabled.addEventListener('change', (event) => {
    state.notchEnabled = Boolean(event.target.checked);
    analyze().catch(() => {});
  });

  els.notchWidth.addEventListener('input', (event) => {
    state.notchWidth = Number(event.target.value);
    els.notchWidthValue.textContent = String(state.notchWidth);
    analyze().catch(() => {});
  });

  els.analyze.addEventListener('click', () => analyze().catch(() => {}));
  els.playNoisy.addEventListener('click', () => {
    if (state.source === 'clean-speech-file') {
      playSpeechBuffer('noisy').catch(() => {});
      return;
    }
    playSignal(state.noisySignal, 'Playing noisy');
  });
  els.playFiltered.addEventListener('click', () => {
    if (state.source === 'clean-speech-file') {
      playSpeechBuffer('filtered').catch(() => {});
      return;
    }
    playSignal(state.filteredSignal, 'Playing filtered');
  });

  els.help.addEventListener('click', () => els.helpDialog.showModal());
  els.closeHelp.addEventListener('click', () => els.helpDialog.close());
}

function init() {
  els.source.value = state.source;
  els.samples.value = String(state.sampleCount);
  els.samplesValue.textContent = String(state.sampleCount);
  els.whiteNoise.value = String(state.whiteNoiseAmount);
  els.whiteNoiseValue.textContent = state.whiteNoiseAmount.toFixed(2);
  els.humNoise.value = String(state.humNoiseAmount);
  els.humNoiseValue.textContent = state.humNoiseAmount.toFixed(2);
  els.notchEnabled.checked = state.notchEnabled;
  els.notchWidth.value = String(state.notchWidth);
  els.notchWidthValue.textContent = String(state.notchWidth);
  updateBinControlBounds();
  bindEvents();
  analyze().catch(() => {});
}

init();
