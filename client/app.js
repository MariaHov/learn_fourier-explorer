const DEFAULT_SAMPLE_RATE = 44100;

const state = {
  sampleRate: DEFAULT_SAMPLE_RATE,
  sampleCount: 1024,
  source: 'sine',
  freq1: 120,
  freq2: 260,
  harmonics: 9,
  windowType: 'rectangular',
  lowPassCutoff: 128,
  notchEnabled: true,
  notchBin: 60,
  notchWidth: 3,
  analysisSignal: [],
  reconstructedSignal: [],
  originalSpectrumHalf: [],
  filteredSpectrumHalf: [],
  filteredSpectrumFull: []
};

const els = {
  status: document.getElementById('status'),
  source: document.getElementById('source'),
  samples: document.getElementById('samples'),
  samplesValue: document.getElementById('samples-value'),
  freq1: document.getElementById('freq1'),
  freq1Value: document.getElementById('freq1-value'),
  freq2: document.getElementById('freq2'),
  freq2Value: document.getElementById('freq2-value'),
  harmonics: document.getElementById('harmonics'),
  harmonicsValue: document.getElementById('harmonics-value'),
  windowType: document.getElementById('window-type'),
  lowPass: document.getElementById('low-pass'),
  lowPassValue: document.getElementById('low-pass-value'),
  notchEnabled: document.getElementById('notch-enabled'),
  notchBin: document.getElementById('notch-bin'),
  notchBinValue: document.getElementById('notch-bin-value'),
  notchWidth: document.getElementById('notch-width'),
  notchWidthValue: document.getElementById('notch-width-value'),
  analyze: document.getElementById('btn-analyze'),
  resetFilters: document.getElementById('btn-reset-filters'),
  signalCanvas: document.getElementById('signal-canvas'),
  originalSpectrumCanvas: document.getElementById('spectrum-noisy-canvas'),
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

function halfSpectrumMaxBin(sampleCount) {
  return Math.max(1, Math.floor(sampleCount / 2) - 1);
}

function updateFilterBounds() {
  const maxBin = halfSpectrumMaxBin(state.sampleCount);
  state.lowPassCutoff = clamp(state.lowPassCutoff, 1, maxBin);
  state.notchBin = clamp(state.notchBin, 1, maxBin);
  state.notchWidth = clamp(state.notchWidth, 0, maxBin);

  els.lowPass.max = String(maxBin);
  els.notchBin.max = String(maxBin);
  els.notchWidth.max = String(Math.min(48, maxBin));

  els.lowPass.value = String(state.lowPassCutoff);
  els.notchBin.value = String(state.notchBin);
  els.notchWidth.value = String(state.notchWidth);
  els.lowPassValue.textContent = String(state.lowPassCutoff);
  els.notchBinValue.textContent = String(state.notchBin);
  els.notchWidthValue.textContent = String(state.notchWidth);
}

function windowValue(windowType, index, count) {
  if (windowType === 'hann') {
    if (count <= 1) return 1;
    return 0.5 * (1 - Math.cos((2 * Math.PI * index) / (count - 1)));
  }
  return 1;
}

function generateSignal() {
  const values = [];
  for (let index = 0; index < state.sampleCount; index += 1) {
    const time = index / state.sampleRate;
    let sample = 0;

    if (state.source === 'sine') {
      sample = Math.sin(2 * Math.PI * state.freq1 * time);
    } else if (state.source === 'two-sines') {
      sample = (
        0.6 * Math.sin(2 * Math.PI * state.freq1 * time) +
        0.4 * Math.sin(2 * Math.PI * state.freq2 * time)
      );
    } else if (state.source === 'square-series') {
      for (let odd = 1; odd <= (state.harmonics * 2 - 1); odd += 2) {
        sample += Math.sin(2 * Math.PI * odd * state.freq1 * time) / odd;
      }
      sample *= (4 / Math.PI);
    }

    const win = windowValue(state.windowType, index, state.sampleCount);
    values.push(sample * win);
  }
  return values;
}

function dft(signal) {
  const count = signal.length;
  const spectrum = [];
  for (let k = 0; k < count; k += 1) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < count; n += 1) {
      const angle = (2 * Math.PI * k * n) / count;
      re += signal[n] * Math.cos(angle);
      im -= signal[n] * Math.sin(angle);
    }
    spectrum.push({ re, im });
  }
  return spectrum;
}

function idft(spectrum) {
  const count = spectrum.length;
  const signal = [];
  for (let n = 0; n < count; n += 1) {
    let re = 0;
    for (let k = 0; k < count; k += 1) {
      const angle = (2 * Math.PI * k * n) / count;
      re += spectrum[k].re * Math.cos(angle) - spectrum[k].im * Math.sin(angle);
    }
    signal.push(re / count);
  }
  return signal;
}

function magnitudeHalf(fullSpectrum) {
  const half = [];
  const limit = Math.floor(fullSpectrum.length / 2);
  for (let k = 0; k < limit; k += 1) {
    const { re, im } = fullSpectrum[k];
    half.push({
      k,
      magnitude: Math.sqrt(re * re + im * im) / fullSpectrum.length
    });
  }
  return half;
}

function filterSpectrum(fullSpectrum) {
  const count = fullSpectrum.length;
  return fullSpectrum.map((bin, k) => {
    const mirrored = Math.min(k, count - k);
    const inLowPass = mirrored <= state.lowPassCutoff;
    const inNotch = state.notchEnabled &&
      Math.abs(mirrored - state.notchBin) <= state.notchWidth;
    if (!inLowPass || inNotch) {
      return { re: 0, im: 0 };
    }
    return { re: bin.re, im: bin.im };
  });
}

function clearCanvas(ctx, width, height, axis = 'x') {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fbfcff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#e3e8f5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (axis === 'x') {
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
  } else {
    ctx.moveTo(0, height);
    ctx.lineTo(width, height);
  }
  ctx.stroke();
}

function drawSignalOverlay(canvas, original, reconstructed) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  clearCanvas(ctx, width, height, 'x');
  if (!original.length) return;

  const draw = (values, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < values.length; i += 1) {
      const x = (i / Math.max(1, values.length - 1)) * width;
      const y = height / 2 - values[i] * (height * 0.42);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  draw(original, '#2f7de1');
  draw(reconstructed, '#d1691b');
}

function drawSpectrum(canvas, bins, color) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  clearCanvas(ctx, width, height, 'y');
  if (!bins.length) return;

  const visible = bins.slice(0, Math.min(256, bins.length));
  const maxMagnitude = Math.max(...visible.map((bin) => bin.magnitude), 1e-9);
  const barWidth = width / visible.length;
  ctx.fillStyle = color;
  for (let i = 0; i < visible.length; i += 1) {
    const barHeight = (visible[i].magnitude / maxMagnitude) * (height * 0.9);
    const x = i * barWidth + 1;
    const y = height - barHeight;
    ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);
  }
}

function renderComponentsList(bins) {
  const top = bins
    .filter((bin) => bin.k > 0)
    .slice()
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 8);

  if (!top.length) {
    els.componentsList.innerHTML = '<li>No components</li>';
    return;
  }

  const rows = top.map((bin) => {
    const hz = (bin.k * state.sampleRate) / state.sampleCount;
    return `<li>${hz.toFixed(1)} Hz (bin ${bin.k}) - ${bin.magnitude.toFixed(6)}</li>`;
  });
  els.componentsList.innerHTML = rows.join('');
}

function analyze() {
  setStatus('Analyzing...');
  state.analysisSignal = generateSignal();
  const fullSpectrum = dft(state.analysisSignal);
  state.originalSpectrumHalf = magnitudeHalf(fullSpectrum);
  state.filteredSpectrumFull = filterSpectrum(fullSpectrum);
  state.filteredSpectrumHalf = magnitudeHalf(state.filteredSpectrumFull);
  state.reconstructedSignal = idft(state.filteredSpectrumFull);

  drawSignalOverlay(els.signalCanvas, state.analysisSignal, state.reconstructedSignal);
  drawSpectrum(els.originalSpectrumCanvas, state.originalSpectrumHalf, '#10a77f');
  drawSpectrum(els.filteredSpectrumCanvas, state.filteredSpectrumHalf, '#d1691b');
  renderComponentsList(state.originalSpectrumHalf);
  setStatus('Ready');
}

function resetFilters() {
  state.lowPassCutoff = halfSpectrumMaxBin(state.sampleCount);
  state.notchEnabled = false;
  state.notchBin = Math.min(60, state.lowPassCutoff);
  state.notchWidth = 3;
  els.notchEnabled.checked = state.notchEnabled;
  updateFilterBounds();
  analyze();
}

function bindEvents() {
  els.source.addEventListener('change', (event) => {
    state.source = event.target.value;
    analyze();
  });

  els.samples.addEventListener('input', (event) => {
    state.sampleCount = Number(event.target.value);
    els.samplesValue.textContent = String(state.sampleCount);
    updateFilterBounds();
    analyze();
  });

  els.freq1.addEventListener('input', (event) => {
    state.freq1 = Number(event.target.value);
    els.freq1Value.textContent = String(state.freq1);
    analyze();
  });

  els.freq2.addEventListener('input', (event) => {
    state.freq2 = Number(event.target.value);
    els.freq2Value.textContent = String(state.freq2);
    analyze();
  });

  els.harmonics.addEventListener('input', (event) => {
    state.harmonics = Number(event.target.value);
    els.harmonicsValue.textContent = String(state.harmonics);
    analyze();
  });

  els.windowType.addEventListener('change', (event) => {
    state.windowType = event.target.value;
    analyze();
  });

  els.lowPass.addEventListener('input', (event) => {
    state.lowPassCutoff = Number(event.target.value);
    els.lowPassValue.textContent = String(state.lowPassCutoff);
    analyze();
  });

  els.notchEnabled.addEventListener('change', (event) => {
    state.notchEnabled = Boolean(event.target.checked);
    analyze();
  });

  els.notchBin.addEventListener('input', (event) => {
    state.notchBin = Number(event.target.value);
    els.notchBinValue.textContent = String(state.notchBin);
    analyze();
  });

  els.notchWidth.addEventListener('input', (event) => {
    state.notchWidth = Number(event.target.value);
    els.notchWidthValue.textContent = String(state.notchWidth);
    analyze();
  });

  els.analyze.addEventListener('click', analyze);
  els.resetFilters.addEventListener('click', resetFilters);
  els.help.addEventListener('click', () => els.helpDialog.showModal());
  els.closeHelp.addEventListener('click', () => els.helpDialog.close());
}

function initializeDefaults() {
  els.source.value = state.source;
  els.samples.value = String(state.sampleCount);
  els.samplesValue.textContent = String(state.sampleCount);
  els.freq1.value = String(state.freq1);
  els.freq1Value.textContent = String(state.freq1);
  els.freq2.value = String(state.freq2);
  els.freq2Value.textContent = String(state.freq2);
  els.harmonics.value = String(state.harmonics);
  els.harmonicsValue.textContent = String(state.harmonics);
  els.windowType.value = state.windowType;
  els.notchEnabled.checked = state.notchEnabled;
  updateFilterBounds();
}

function init() {
  initializeDefaults();
  bindEvents();
  analyze();
}

init();
