const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_PLAY_SECONDS = 1.25;
const DEFAULT_GAIN = 0.12;
const MAX_PLAY_GAIN = 2.5;
const DEFAULT_FADE_SECONDS = 0.015;
const PHONE_DEMO_CLEAN_URL = '/audio/Cosmo_clean.wav';

const state = {
  sampleRate: DEFAULT_SAMPLE_RATE,
  sampleCount: 1024,
  source: 'sine',
  freq1: 120,
  freq2: 260,
  harmonics: 9,
  windowType: 'rectangular',
  spectrumScale: 'db',
  lowPassCutoff: 128,
  notchEnabled: true,
  notchBin: 60,
  notchWidth: 3,
  phoneDemoBuffer: null,
  phoneDemoLoaded: false,
  phoneDemoCleanMono: [],
  phoneDemoNoiseMono: [],
  phoneDemoMono: [],
  phoneDemoFilteredCacheKey: '',
  phoneDemoFilteredCache: [],
  rawSignal: [],
  analysisSignal: [],
  reconstructedSignal: [],
  originalSpectrumFull: [],
  originalSpectrumHalf: [],
  filteredSpectrumHalf: [],
  filteredSpectrumFull: []
};

const els = {
  status: document.getElementById('status'),
  source: document.getElementById('source'),
  controlF1Field: document.getElementById('control-f1-field'),
  controlF2Field: document.getElementById('control-f2-field'),
  controlHarmonicsField: document.getElementById('control-harmonics-field'),
  advancedAccordion: document.getElementById('advanced-accordion'),
  advancedToggle: document.getElementById('advanced-toggle'),
  advancedBody: document.getElementById('advanced-body'),
  samples: document.getElementById('samples'),
  samplesValue: document.getElementById('samples-value'),
  freq1: document.getElementById('freq1'),
  freq1Value: document.getElementById('freq1-value'),
  freq2: document.getElementById('freq2'),
  freq2Value: document.getElementById('freq2-value'),
  harmonics: document.getElementById('harmonics'),
  harmonicsValue: document.getElementById('harmonics-value'),
  windowType: document.getElementById('window-type'),
  spectrumScale: document.getElementById('spectrum-scale'),
  notchControlsRow: document.getElementById('notch-controls-row'),
  lowPass: document.getElementById('low-pass'),
  lowPassValue: document.getElementById('low-pass-value'),
  lowPassHz: document.getElementById('low-pass-hz'),
  notchEnabled: document.getElementById('notch-enabled'),
  notchBin: document.getElementById('notch-bin'),
  notchBinValue: document.getElementById('notch-bin-value'),
  notchBinHz: document.getElementById('notch-bin-hz'),
  notchWidth: document.getElementById('notch-width'),
  notchWidthValue: document.getElementById('notch-width-value'),
  notchWidthHz: document.getElementById('notch-width-hz'),
  resetFilters: document.getElementById('btn-reset-filters'),
  resetAll: document.getElementById('btn-reset-all'),
  examplePhoneDemo: document.getElementById('btn-example-phone-demo'),
  playOriginal: document.getElementById('btn-play-original'),
  playReconstructed: document.getElementById('btn-play-reconstructed'),
  playDifference: document.getElementById('btn-play-difference'),
  demoProcessing: document.getElementById('demo-processing'),
  signalCanvas: document.getElementById('signal-canvas'),
  originalSpectrumCanvas: document.getElementById('spectrum-noisy-canvas'),
  filteredSpectrumCanvas: document.getElementById('spectrum-filtered-canvas'),
  timeTooltip: document.getElementById('tooltip-time'),
  originalSpectrumTooltip: document.getElementById('tooltip-original-spectrum'),
  filteredSpectrumTooltip: document.getElementById('tooltip-filtered-spectrum'),
  resetZoomTime: document.getElementById('btn-reset-zoom-time'),
  zoomOutTime: document.getElementById('btn-zoom-out-time'),
  resetZoomOriginalSpectrum: document.getElementById('btn-reset-zoom-original-spectrum'),
  zoomOutOriginalSpectrum: document.getElementById('btn-zoom-out-original-spectrum'),
  resetZoomFilteredSpectrum: document.getElementById('btn-reset-zoom-filtered-spectrum'),
  zoomOutFilteredSpectrum: document.getElementById('btn-zoom-out-filtered-spectrum'),
  componentsList: document.getElementById('components-list'),
  formulaBody: document.getElementById('formula-body'),
  demoMetrics: document.getElementById('demo-metrics'),
  help: document.getElementById('btn-help'),
  helpDialog: document.getElementById('help-dialog'),
  closeHelp: document.getElementById('btn-close-help')
};

const cosmoEls = {
  root: document.getElementById('cosmo-greeter'),
  text: document.getElementById('cosmo-text'),
  img: document.getElementById('cosmo-img'),
  close: document.getElementById('btn-cosmo-close')
};

const plotInteractions = {
  time: null,
  originalSpectrum: null,
  filteredSpectrum: null
};

function setStatus(text) {
  els.status.textContent = text;
}

let cosmoTimer = null;
let cosmoHideTimer = null;
let cosmoEnabled = true;
let cosmoLastDismissedAt = 0;
let cosmoSceneIndex = 0;
let cosmoHearYouShown = false;

const cosmoScenes = [
  {
    src: '/cosmo-wave.png',
    alt: 'Cosmo waving',
    text: 'Hi! Welcome to the Fourier Explorer.'
  },
  {
    src: '/Torso_Thumbs_Up.png',
    alt: 'Cosmo thumbs up',
    text: 'Tip: drag to zoom plots (then Reset zoom).'
  },
  {
    src: '/cosmo_Torso_Star_Eyes.svg',
    alt: 'Cosmo excited',
    text: 'Look for peaks in the spectrum: those are your strongest frequencies.'
  },
  {
    src: '/Cosmo_Laying_Exhausted.svg',
    alt: 'Cosmo resting',
    text: 'Fourier can feel exhausting at first. Keep going, you got this.'
  }
];

function scheduleCosmoGreeting() {
  if (!cosmoEnabled || !cosmoEls.root) return;
  if (cosmoTimer) clearTimeout(cosmoTimer);
  if (cosmoSceneIndex >= cosmoScenes.length) return;

  // First greeting should be quick; afterwards keep it periodic.
  let delay;
  if (cosmoSceneIndex === 0) {
    delay = 5000;
  } else {
    const minMs = 30000;
    const maxMs = 40000;
    delay = Math.floor(minMs + Math.random() * (maxMs - minMs));
  }
  cosmoTimer = setTimeout(() => {
    showCosmoGreeting();
    scheduleCosmoGreeting();
  }, delay);
}

function hideCosmoGreeting() {
  if (!cosmoEls.root) return;
  if (cosmoHideTimer) clearTimeout(cosmoHideTimer);
  cosmoEls.root.hidden = true;
  cosmoEls.root.classList.remove('is-visible');
}

function showCosmoOneShot(scene, durationMs = 6000) {
  if (!cosmoEnabled || !cosmoEls.root || !cosmoEls.text) return;
  if (!scene) return;

  cosmoEls.text.textContent = scene.text || 'Hi!';
  if (cosmoEls.img) {
    cosmoEls.img.src = scene.src || '/cosmo-wave.png';
    cosmoEls.img.alt = scene.alt || 'Cosmo';
  }

  cosmoEls.root.hidden = false;
  cosmoEls.root.classList.add('is-visible');

  if (cosmoHideTimer) clearTimeout(cosmoHideTimer);
  cosmoHideTimer = setTimeout(() => hideCosmoGreeting(), durationMs);
}

function showCosmoGreeting() {
  if (!cosmoEnabled || !cosmoEls.root || !cosmoEls.text) return;
  if (els.demoProcessing && !els.demoProcessing.hidden) return;
  if (Date.now() - cosmoLastDismissedAt < 20000) return;

  const scene = cosmoScenes[cosmoSceneIndex % cosmoScenes.length];
  cosmoSceneIndex += 1;

  cosmoEls.text.textContent = scene.text;
  if (cosmoEls.img) {
    cosmoEls.img.src = scene.src;
    cosmoEls.img.alt = scene.alt || 'Cosmo';
  }

  cosmoEls.root.hidden = false;
  cosmoEls.root.classList.add('is-visible');

  if (cosmoHideTimer) clearTimeout(cosmoHideTimer);
  cosmoHideTimer = setTimeout(() => hideCosmoGreeting(), 6000);
}

function setDemoProcessing(active, text = '') {
  if (els.demoProcessing) {
    els.demoProcessing.hidden = !active;
    els.demoProcessing.textContent = text;
  }
  if (els.playReconstructed) els.playReconstructed.disabled = active;
  if (els.playDifference) els.playDifference.disabled = active;
}

function updateSourceControlVisibility() {
  const isPhoneDemo = state.source === 'phone-call-demo';
  const isIrregularShape = state.source === 'irregular-shape';
  if (els.controlF1Field) {
    els.controlF1Field.classList.toggle('is-hidden-control', isPhoneDemo || isIrregularShape);
  }
  if (els.controlF2Field) {
    els.controlF2Field.classList.toggle('is-hidden-control', state.source !== 'two-sines');
  }
  if (els.controlHarmonicsField) {
    els.controlHarmonicsField.classList.toggle('is-hidden-control', state.source !== 'square-series');
  }

  // Reduce clutter: hide notch bin/width sliders unless notch is enabled.
  if (els.notchControlsRow) {
    els.notchControlsRow.classList.toggle('is-hidden-control', !state.notchEnabled);
  }
}

function ensurePhoneDemoOption() {
  if (!els.source) return;
  const value = 'phone-call-demo';
  const existing = Array.from(els.source.options).find((opt) => opt.value === value);
  if (state.source === value) {
    if (!existing) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = 'Example: Phone Call (Cosmo)';
      els.source.appendChild(opt);
    }
    els.source.value = value;
  } else if (existing) {
    existing.remove();
  }
}

function extractMonoFull(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const frames = audioBuffer.length;
  const mono = new Array(frames).fill(0);
  if (channels <= 0) return mono;
  for (let i = 0; i < frames; i += 1) {
    let sum = 0;
    for (let c = 0; c < channels; c += 1) {
      sum += audioBuffer.getChannelData(c)[i];
    }
    mono[i] = sum / channels;
  }
  return mono;
}

function makeSeededRandom(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function preprocessCleanForDemo(clean) {
  if (!clean || !clean.length) return [];
  let peak = 1e-9;
  let energy = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const v = clean[i] || 0;
    peak = Math.max(peak, Math.abs(v));
    energy += v * v;
  }
  const rms = Math.sqrt(energy / clean.length);
  const targetRms = 0.12;
  const maxPeak = 0.82;
  let scale = 1;
  if (rms > 1e-9 && rms < targetRms) {
    scale = targetRms / rms;
  }
  if (peak * scale > maxPeak) {
    scale = maxPeak / peak;
  }
  if (Math.abs(scale - 1) < 1e-6) return clean.slice();
  return clean.map((v) => v * scale);
}

function buildDemoNoisyFromClean(clean, sampleRate) {
  const rand = makeSeededRandom(20260225);
  const out = new Array(clean.length);
  const noiseTrack = new Array(clean.length).fill(0);
  const speechGain = 1.22;

  let bp1 = 0;
  let bp2 = 0;

  // Float-domain amplitudes for decoded WebAudio samples in [-1, 1].
  const rumbleAmp = 0.011;
  const humAmp = 0.082;
  const hissAmp = 0.040;
  const babbleAmp = 0.070;

  for (let i = 0; i < clean.length; i += 1) {
    const t = i / sampleRate;

    // Bounded low-frequency road/HVAC bed (prevents slow baseline drift).
    const rumble = rumbleAmp * (
      0.7 * Math.sin(2 * Math.PI * 28 * t) +
      0.35 * Math.sin(2 * Math.PI * 45 * t + 0.8)
    );

    // Mid-band textured ambience.
    const n0 = rand() * 2 - 1;
    bp1 = 0.94 * bp1 + 0.06 * n0;
    bp2 = 0.85 * bp2 + 0.15 * bp1;
    const am = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.36 * t));
    const babble = (bp1 - bp2) * babbleAmp * am;

    // Electrical hum (60 Hz + harmonics).
    const hum = humAmp * (
      Math.sin(2 * Math.PI * 60 * t) +
      0.28 * Math.sin(2 * Math.PI * 120 * t) +
      0.14 * Math.sin(2 * Math.PI * 180 * t)
    );

    const hiss = (rand() * 2 - 1) * hissAmp;
    const noiseSample = rumble + babble + hum + hiss;
    noiseTrack[i] = noiseSample;
    out[i] = (clean[i] ?? 0) * speechGain + noiseSample;
  }

  // Soft limit only when needed so voice loudness is preserved.
  let peak = 1e-9;
  for (let i = 0; i < out.length; i += 1) {
    peak = Math.max(peak, Math.abs(out[i]));
  }
  const scale = peak > 0.98 ? 0.98 / peak : 1;
  for (let i = 0; i < out.length; i += 1) {
    out[i] *= scale;
    noiseTrack[i] *= scale;
  }
  return { noisy: out, noise: noiseTrack };
}

function findBestSegmentStart(signal, sampleCount) {
  if (!signal || !signal.length) return 0;
  const frame = Math.min(sampleCount, signal.length);
  const hop = Math.max(32, Math.floor(frame / 8));
  let bestStart = 0;
  let bestEnergy = -1;

  for (let start = 0; start + frame <= signal.length; start += hop) {
    let e = 0;
    for (let i = 0; i < frame; i += 1) {
      const v = signal[start + i] || 0;
      e += v * v;
    }
    if (e > bestEnergy) {
      bestEnergy = e;
      bestStart = start;
    }
  }
  return bestStart;
}

function sliceWithPad(signal, start, count) {
  const out = new Array(count).fill(0);
  if (!signal || !signal.length) return out;
  const safeStart = clamp(start, 0, Math.max(0, signal.length - 1));
  const limit = Math.min(count, signal.length - safeStart);
  for (let i = 0; i < limit; i += 1) out[i] = signal[safeStart + i];
  return out;
}

function findSpeechOnset(signal, sampleRate) {
  if (!signal || !signal.length) return 0;
  const win = Math.max(64, Math.floor(sampleRate * 0.01)); // 10ms
  let peak = 1e-9;
  for (let i = 0; i < signal.length; i += 1) {
    const v = Math.abs(signal[i] || 0);
    if (v > peak) peak = v;
  }
  const threshold = Math.max(0.01, peak * 0.18);
  for (let start = 0; start + win < signal.length; start += Math.max(1, Math.floor(win / 2))) {
    let sum = 0;
    for (let i = 0; i < win; i += 1) {
      sum += Math.abs(signal[start + i] || 0);
    }
    const avg = sum / win;
    if (avg >= threshold) {
      const preroll = Math.floor(sampleRate * 0.05); // 50ms before first detected speech
      return Math.max(0, start - preroll);
    }
  }
  return 0;
}

function getPhoneDemoSegmentStart() {
  return findSpeechOnset(state.phoneDemoCleanMono, state.sampleRate);
}

async function ensurePhoneDemoLoaded() {
  if (state.phoneDemoLoaded && state.phoneDemoBuffer) return true;
  try {
    setStatus('Loading demo audio...');
    const response = await fetch(PHONE_DEMO_CLEAN_URL);
    if (!response.ok) return false;
    const bytes = await response.arrayBuffer();
    const context = getAudioContext();
    if (!context) return false;
    const decoded = await context.decodeAudioData(bytes.slice(0));
    state.phoneDemoBuffer = decoded;
    const cleanMono = extractMonoFull(decoded);
    state.phoneDemoCleanMono = preprocessCleanForDemo(cleanMono);
    const demo = buildDemoNoisyFromClean(state.phoneDemoCleanMono, decoded.sampleRate || DEFAULT_SAMPLE_RATE);
    state.phoneDemoMono = demo.noisy;
    state.phoneDemoNoiseMono = demo.noise;
    state.sampleRate = decoded.sampleRate || DEFAULT_SAMPLE_RATE;
    state.phoneDemoLoaded = true;
    return true;
  } catch (_) {
    return false;
  }
}

function getPhoneDemoPlaybackRaw() {
  if (!state.phoneDemoMono.length) return [];
  const maxSamples = Math.min(state.phoneDemoMono.length, Math.floor(state.sampleRate * 3));
  const start = getPhoneDemoSegmentStart();
  return sliceWithPad(state.phoneDemoMono, start, Math.max(1, maxSamples));
}

function getPhoneDemoPlaybackClean() {
  if (!state.phoneDemoCleanMono.length) return [];
  const maxSamples = Math.min(state.phoneDemoCleanMono.length, Math.floor(state.sampleRate * 3));
  const start = getPhoneDemoSegmentStart();
  return sliceWithPad(state.phoneDemoCleanMono, start, Math.max(1, maxSamples));
}

function getPhoneDemoPlaybackNoise() {
  if (!state.phoneDemoNoiseMono.length) return [];
  const maxSamples = Math.min(state.phoneDemoNoiseMono.length, Math.floor(state.sampleRate * 3));
  const start = getPhoneDemoSegmentStart();
  return sliceWithPad(state.phoneDemoNoiseMono, start, Math.max(1, maxSamples));
}

function hannWindow(count) {
  const w = new Array(count).fill(1);
  if (count <= 1) return w;
  for (let i = 0; i < count; i += 1) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (count - 1)));
  }
  return w;
}

async function buildPhoneDemoFilteredPlayback(raw, onProgress = null) {
  const N = state.sampleCount;
  const hop = Math.max(1, Math.floor(N / 4));
  const out = new Array(raw.length).fill(0);
  const norm = new Array(raw.length).fill(0);
  const window = hannWindow(N);
  const totalBlocks = Math.max(1, Math.ceil(raw.length / hop));
  let blockIndex = 0;

  for (let start = 0; start < raw.length; start += hop) {
    const blockLength = Math.min(N, raw.length - start);
    const block = new Array(N).fill(0);
    for (let i = 0; i < blockLength; i += 1) {
      block[i] = raw[start + i];
    }
    const windowed = new Array(N).fill(0);
    for (let i = 0; i < N; i += 1) {
      windowed[i] = block[i] * window[i];
    }
    const fullSpectrum = dft(windowed);
    const filteredSpectrum = filterSpectrum(fullSpectrum);
    const reconstructed = idft(filteredSpectrum);
    for (let i = 0; i < blockLength; i += 1) {
      const sample = reconstructed[i] * window[i];
      out[start + i] += sample;
      norm[start + i] += window[i] * window[i];
    }
    blockIndex += 1;
    if (onProgress) onProgress(blockIndex, totalBlocks);
    if (blockIndex % 4 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  for (let i = 0; i < out.length; i += 1) {
    if (norm[i] > 1e-9) {
      out[i] /= norm[i];
    }
  }
  return out;
}

async function getPhoneDemoFilteredPlayback(raw, onProgress = null) {
  const key = [
    state.sampleCount,
    state.windowType,
    state.lowPassCutoff,
    state.notchEnabled ? 1 : 0,
    state.notchBin,
    state.notchWidth,
    raw.length
  ].join(':');
  if (state.phoneDemoFilteredCacheKey === key && state.phoneDemoFilteredCache.length === raw.length) {
    return state.phoneDemoFilteredCache;
  }
  const filtered = await buildPhoneDemoFilteredPlayback(raw, onProgress);
  state.phoneDemoFilteredCacheKey = key;
  state.phoneDemoFilteredCache = filtered;
  return filtered;
}

function setAdvancedOpen(isOpen) {
  if (!els.advancedAccordion || !els.advancedToggle || !els.advancedBody) return;
  els.advancedAccordion.classList.toggle('is-open', isOpen);
  els.advancedToggle.setAttribute('aria-expanded', String(isOpen));
  els.advancedBody.style.maxHeight = isOpen ? `${els.advancedBody.scrollHeight}px` : '0px';
}

function bindSidebarUi() {
  if (els.advancedToggle) {
    els.advancedToggle.addEventListener('click', () => {
      const isOpen = !els.advancedAccordion.classList.contains('is-open');
      setAdvancedOpen(isOpen);
    });
  }
  window.addEventListener('resize', () => {
    if (els.advancedAccordion && els.advancedAccordion.classList.contains('is-open')) {
      setAdvancedOpen(true);
    }
  });
}

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

function halfSpectrumMaxBin(sampleCount) {
  return Math.max(1, Math.floor(sampleCount / 2) - 1);
}

function stepPrecision(stepValue) {
  const text = String(stepValue || '1');
  const dot = text.indexOf('.');
  return dot >= 0 ? (text.length - dot - 1) : 0;
}

function clampToSlider(value, slider) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const step = Number(slider.step || 1);
  const clamped = clamp(value, min, max);
  if (!Number.isFinite(step) || step <= 0) return clamped;
  const snapped = min + Math.round((clamped - min) / step) * step;
  const precision = stepPrecision(step);
  return Number(clamp(snapped, min, max).toFixed(precision));
}

function setEditableValueText(element, value, slider) {
  const step = Number(slider.step || 1);
  const precision = stepPrecision(step);
  element.textContent = Number(value).toFixed(precision).replace(/\.0+$/, '');
}

function setupEditableNumberValue(displayElement, sliderElement) {
  if (!displayElement || !sliderElement) return;
  let activeInput = null;

  const stopEditing = () => {
    if (!activeInput) return;
    activeInput.remove();
    activeInput = null;
    displayElement.classList.remove('editing');
  };

  const commit = () => {
    if (!activeInput) return;
    const raw = activeInput.value;
    if (raw.trim() === '') {
      stopEditing();
      setEditableValueText(displayElement, sliderElement.value, sliderElement);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      stopEditing();
      setEditableValueText(displayElement, sliderElement.value, sliderElement);
      return;
    }
    const nextValue = clampToSlider(parsed, sliderElement);
    const changed = Number(sliderElement.value) !== nextValue;
    sliderElement.value = String(nextValue);
    stopEditing();
    setEditableValueText(displayElement, nextValue, sliderElement);
    if (changed) {
      sliderElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  displayElement.addEventListener('dblclick', () => {
    if (activeInput) return;
    const current = sliderElement.value;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'editable-inline-input';
    input.min = sliderElement.min;
    input.max = sliderElement.max;
    input.step = sliderElement.step || '1';
    input.value = current;
    input.setAttribute('inputmode', 'decimal');

    displayElement.textContent = '';
    displayElement.classList.add('editing');
    displayElement.appendChild(input);
    activeInput = input;
    input.focus();
    input.select();

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        commit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        stopEditing();
        setEditableValueText(displayElement, sliderElement.value, sliderElement);
      }
    });
    input.addEventListener('blur', commit);
  });
}

function hzPerBin() {
  return state.sampleRate / state.sampleCount;
}

function renderBinHzHelpers() {
  const perBin = hzPerBin();
  const lowPassHz = state.lowPassCutoff * perBin;
  const notchCenterHz = state.notchBin * perBin;
  const notchWidthHz = (state.notchWidth * 2) * perBin;
  if (els.lowPassHz) els.lowPassHz.textContent = `≈ ${Math.round(lowPassHz)} Hz`;
  if (els.notchBinHz) els.notchBinHz.textContent = `≈ ${Math.round(notchCenterHz)} Hz`;
  if (els.notchWidthHz) els.notchWidthHz.textContent = `~ ${Math.round(notchWidthHz)} Hz wide`;
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
  setEditableValueText(els.lowPassValue, state.lowPassCutoff, els.lowPass);
  setEditableValueText(els.notchBinValue, state.notchBin, els.notchBin);
  setEditableValueText(els.notchWidthValue, state.notchWidth, els.notchWidth);
  renderBinHzHelpers();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function power(signal) {
  if (!signal.length) return 0;
  let sum = 0;
  for (let i = 0; i < signal.length; i += 1) {
    const v = signal[i] || 0;
    sum += v * v;
  }
  return sum / signal.length;
}

function safeDbRatio(numerator, denominator) {
  const num = Math.max(1e-12, numerator);
  const den = Math.max(1e-12, denominator);
  return 10 * Math.log10(num / den);
}

function renderPhoneDemoMetrics(metrics) {
  if (!els.demoMetrics) return;
  if (!metrics) {
    els.demoMetrics.hidden = true;
    els.demoMetrics.innerHTML = '';
    return;
  }
  const formatDb = (value) => {
    if (!Number.isFinite(value)) return 'N/A';
    if (value > 80) return '> 80 dB';
    if (value < -80) return '< -80 dB';
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)} dB`;
  };
  els.demoMetrics.innerHTML = [
    `<span class="demo-metric-pill"><span class="demo-metric-label">Input SNR</span><span class="demo-metric-value">${formatDb(metrics.inputSnrDb)}</span></span>`,
    `<span class="demo-metric-pill"><span class="demo-metric-label">Output SNR</span><span class="demo-metric-value">${formatDb(metrics.outputSnrDb)}</span></span>`,
    `<span class="demo-metric-pill"><span class="demo-metric-label">SNR Gain</span><span class="demo-metric-value">${formatDb(metrics.snrGainDb)}</span></span>`,
    `<span class="demo-metric-pill"><span class="demo-metric-label">60 Hz Reduction</span><span class="demo-metric-value">${formatDb(metrics.humReductionDb)}</span></span>`
  ].join('');
  els.demoMetrics.hidden = false;
}

function computePhoneDemoMetrics(cleanWindowed, noisyWindowed, reconstructed, originalSpectrum, filteredSpectrum) {
  const length = Math.min(cleanWindowed.length, noisyWindowed.length, reconstructed.length);
  if (length <= 0) return null;
  const clean = cleanWindowed.slice(0, length);
  const noisy = noisyWindowed.slice(0, length);
  const recon = reconstructed.slice(0, length);

  const noiseIn = new Array(length);
  const noiseOut = new Array(length);
  for (let i = 0; i < length; i += 1) {
    noiseIn[i] = noisy[i] - clean[i];
    noiseOut[i] = recon[i] - clean[i];
  }

  const cleanPower = power(clean);
  const inputSnrDb = safeDbRatio(cleanPower, power(noiseIn));
  const outputSnrDb = safeDbRatio(cleanPower, power(noiseOut));
  const snrGainDb = outputSnrDb - inputSnrDb;

  const perBin = hzPerBin();
  const humBin = clamp(Math.round(60 / perBin), 0, Math.max(0, originalSpectrum.length - 1));
  const humOriginal = originalSpectrum[humBin]?.magnitude ?? 0;
  const humFiltered = filteredSpectrum[humBin]?.magnitude ?? 0;
  const humReductionDb = 20 * Math.log10((humOriginal + 1e-12) / (humFiltered + 1e-12));

  return {
    inputSnrDb,
    outputSnrDb,
    snrGainDb,
    humReductionDb
  };
}

function renderFormulaPanel() {
  if (!els.formulaBody) return;
  const f1 = state.freq1;
  const f2 = state.freq2;
  const h = state.harmonics;

  const renderFourierSumForCurrentSignal = () => {
    const spectrum = state.originalSpectrumFull;
    const N = state.sampleCount;
    if (!spectrum || !spectrum.length || N <= 0) {
      return '<div class="formula-line">x[n] ≈ Σ A_k cos(2πkn/N + φ_k)</div>';
    }

    return '<div class="formula-line">x[n] ≈ a0 + Σ A_k cos(2πkn/N + φ_k)</div>';
  };

  if (state.source === 'sine') {
    els.formulaBody.innerHTML = [
      `<div class=\"formula-line\">x(t) = sin(2π · ${f1} · t)</div>`,
      `<div class=\"formula-hint\">Spectrum: one dominant peak near ${f1} Hz.</div>`
    ].join('');
    return;
  }

  if (state.source === 'two-sines') {
    els.formulaBody.innerHTML = [
      `<div class=\"formula-line\">x(t) = sin(2π · ${f1} · t) + sin(2π · ${f2} · t)</div>`,
      `<div class=\"formula-hint\">Spectrum: peaks near ${f1} Hz and ${f2} Hz.</div>`
    ].join('');
    return;
  }

  if (state.source === 'irregular-shape') {
    els.formulaBody.innerHTML = renderFourierSumForCurrentSignal();
    return;
  }

  if (state.source === 'phone-call-demo') {
    els.formulaBody.innerHTML = [
      '<div class="formula-line">x[n] = real phone-call waveform segment (Cosmo demo)</div>',
      '<div class="formula-hint">Use low-pass + notch to isolate voice and reduce line hum.</div>'
    ].join('');
    return;
  }

  // square-series
  const terms = [
    `sin(2π · ${f1} · t)`,
    `(1/3) sin(2π · ${3 * f1} · t)`,
    `(1/5) sin(2π · ${5 * f1} · t)`
  ];
  const expanded = terms.join(' + ') + ' + …';
  const series = `x(t) ≈ Σ (1/(2m-1)) · sin(2π · (2m-1) · ${f1} · t)`;
  els.formulaBody.innerHTML = [
    `<div class=\"formula-line\">${escapeHtml(series)}</div>`,
    `<div class=\"formula-line\">First terms: ${escapeHtml(expanded)}</div>`,
    `<div class=\"formula-hint\">Using ${h} odd harmonics (more harmonics → sharper corners).</div>`
  ].join('');
}

let audioContext = null;
let activeSourceNode = null;
let activePlaybackTimers = [];

function stopPlayback() {
  for (const timer of activePlaybackTimers) clearTimeout(timer);
  activePlaybackTimers = [];
  if (activeSourceNode) {
    try {
      activeSourceNode.stop();
    } catch (_) {
      // ignore stop errors
    }
    activeSourceNode.disconnect();
    activeSourceNode = null;
  }
}

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  return audioContext;
}

function clampSignal(signal) {
  const out = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i += 1) {
    const v = signal[i];
    out[i] = v > 1 ? 1 : (v < -1 ? -1 : v);
  }
  return out;
}

function normalizeSignal(signal) {
  let peak = 1e-9;
  for (let i = 0; i < signal.length; i += 1) {
    const v = Math.abs(signal[i]);
    if (v > peak) peak = v;
  }
  const scale = 1 / peak;
  const out = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i += 1) {
    out[i] = signal[i] * scale;
  }
  return out;
}

function peakAbs(signal) {
  let peak = 1e-9;
  for (let i = 0; i < signal.length; i += 1) {
    const v = Math.abs(signal[i]);
    if (v > peak) peak = v;
  }
  return peak;
}

function rms(signal) {
  if (!signal || !signal.length) return 0;
  let sum = 0;
  for (let i = 0; i < signal.length; i += 1) {
    const v = signal[i] || 0;
    sum += v * v;
  }
  return Math.sqrt(sum / signal.length);
}

function matchPerceivedLoudness(signal, reference, maxGain = 10) {
  if (!signal || !signal.length) return signal;
  const inRms = Math.max(1e-9, rms(signal));
  const refRms = Math.max(1e-9, rms(reference));
  const gain = clamp((refRms * 0.95) / inRms, 1, maxGain);
  if (Math.abs(gain - 1) < 1e-6) return signal;
  return signal.map((v) => v * gain);
}

function tileToDuration(signal, seconds) {
  const targetSamples = Math.max(1, Math.floor(state.sampleRate * seconds));
  const out = new Float32Array(targetSamples);
  for (let i = 0; i < targetSamples; i += 1) {
    out[i] = signal[i % signal.length];
  }
  return out;
}

function playSignal(signal, label, options = {}) {
  if (!signal || !signal.length) return;
  const context = getAudioContext();
  if (!context) {
    setStatus('Audio not supported');
    return;
  }

  stopPlayback();

  const playbackSampleRate = options.sampleRate || state.sampleRate;
  const shouldTile = options.tile !== false;
  const baseSignal = shouldTile ? tileToDuration(signal, DEFAULT_PLAY_SECONDS) : signal;
  let sourceData;
  if (Number.isFinite(options.referencePeak) && options.referencePeak > 1e-9) {
    const scale = 1 / options.referencePeak;
    const scaled = new Float32Array(baseSignal.length);
    for (let i = 0; i < baseSignal.length; i += 1) {
      scaled[i] = baseSignal[i] * scale;
    }
    sourceData = clampSignal(scaled);
  } else {
    sourceData = clampSignal(normalizeSignal(baseSignal));
  }

  const buffer = context.createBuffer(1, sourceData.length, playbackSampleRate);
  buffer.copyToChannel(sourceData, 0);

  const sourceNode = context.createBufferSource();
  sourceNode.buffer = buffer;

  const gainNode = context.createGain();
  gainNode.gain.value = 0;
  sourceNode.connect(gainNode);
  gainNode.connect(context.destination);

  const now = context.currentTime;
  const fade = DEFAULT_FADE_SECONDS;
  const requestedGain = Number.isFinite(options.gain) ? options.gain : DEFAULT_GAIN;
  const playbackGain = clamp(requestedGain, 0, MAX_PLAY_GAIN);
  const endTime = now + buffer.duration;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(playbackGain, now + fade);
  gainNode.gain.setValueAtTime(playbackGain, Math.max(now + fade, endTime - fade));
  gainNode.gain.linearRampToValueAtTime(0, endTime);

  context.resume().catch(() => {});
  sourceNode.start();

  activeSourceNode = sourceNode;
  setStatus(label);

  if (typeof options.onNearEnd === 'function') {
    const beforeSeconds = Number.isFinite(options.nearEndSeconds) ? options.nearEndSeconds : 0.5;
    const delayMs = Math.max(0, (buffer.duration - Math.max(0, beforeSeconds)) * 1000);
    const timer = setTimeout(() => {
      try {
        options.onNearEnd();
      } catch (_) {
        // ignore callback errors
      }
    }, delayMs);
    activePlaybackTimers.push(timer);
  }

  sourceNode.onended = () => {
    for (const timer of activePlaybackTimers) clearTimeout(timer);
    activePlaybackTimers = [];
    if (activeSourceNode === sourceNode) {
      activeSourceNode.disconnect();
      activeSourceNode = null;
    }
    setStatus('Ready');
    if (typeof options.onEnded === 'function') {
      try {
        options.onEnded();
      } catch (_) {
        // ignore callback errors
      }
    }
  };
}

function windowValue(windowType, index, count) {
  if (windowType === 'hann') {
    if (count <= 1) return 1;
    return 0.5 * (1 - Math.cos((2 * Math.PI * index) / (count - 1)));
  }
  return 1;
}

function generateSignalRaw() {
  if (state.source === 'phone-call-demo') {
    const noisy = state.phoneDemoMono;
    if (!noisy || !noisy.length) return new Array(state.sampleCount).fill(0);
    const start = getPhoneDemoSegmentStart();
    return sliceWithPad(noisy, start, state.sampleCount);
  }

  state.sampleRate = DEFAULT_SAMPLE_RATE;
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
    } else if (state.source === 'irregular-shape') {
      const u = state.sampleCount > 1 ? index / (state.sampleCount - 1) : 0;
      if (u < 0.15) {
        sample = 0;
      } else if (u < 0.35) {
        sample = 3.2 * (u - 0.15);
      } else if (u < 0.6) {
        sample = 0.64 - 1.6 * (u - 0.35);
      } else if (u < 0.85) {
        sample = -0.16 + 1.0 * (u - 0.6);
      } else if (u < 0.92) {
        sample = 0.09;
      } else {
        sample = 0;
      }
    } else if (state.source === 'square-series') {
      for (let odd = 1; odd <= (state.harmonics * 2 - 1); odd += 2) {
        sample += Math.sin(2 * Math.PI * odd * state.freq1 * time) / odd;
      }
      sample *= (4 / Math.PI);
    }
    values.push(sample);
  }
  return values;
}

function applyWindow(signal) {
  return signal.map((sample, index) => sample * windowValue(state.windowType, index, state.sampleCount));
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
  const isPhoneDemo = state.source === 'phone-call-demo';
  const lowPassOutsideScale = isPhoneDemo ? 0.18 : 0;
  const notchScale = isPhoneDemo ? 0.08 : 0;
  return fullSpectrum.map((bin, k) => {
    const mirrored = Math.min(k, count - k);
    const inLowPass = mirrored <= state.lowPassCutoff;
    const inPrimaryNotch = state.notchEnabled &&
      Math.abs(mirrored - state.notchBin) <= state.notchWidth;
    const inNotch = inPrimaryNotch;
    if (!inLowPass) {
      return {
        re: bin.re * lowPassOutsideScale,
        im: bin.im * lowPassOutsideScale
      };
    }
    if (inNotch) {
      return {
        re: bin.re * notchScale,
        im: bin.im * notchScale
      };
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

function getCanvasContext(canvas) {
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.max(1, Math.round(rect.width * dpr));
  const displayHeight = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  // Draw in CSS pixels, map to device pixels via transform.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {
    ctx,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    dpr
  };
}

function drawSelectionOverlay(ctx, width, height, selection, style = {}) {
  if (!selection) return;
  const left = clamp(Math.min(selection.x0, selection.x1), 0, width);
  const right = clamp(Math.max(selection.x0, selection.x1), 0, width);
  if (right - left < 1) return;
  ctx.fillStyle = style.fill || 'rgba(47, 125, 225, 0.16)';
  ctx.strokeStyle = style.stroke || 'rgba(47, 125, 225, 0.75)';
  ctx.lineWidth = 1;
  if (style.dashed) ctx.setLineDash([4, 3]);
  ctx.fillRect(left, 0, right - left, height);
  ctx.strokeRect(left + 0.5, 0.5, Math.max(0, right - left - 1), height - 1);
  if (style.dashed) ctx.setLineDash([]);
}

function normalizeDomain(domain, maxIndex) {
  const full = { start: 0, end: maxIndex };
  if (maxIndex <= 0) return full;
  if (!domain || !Number.isFinite(domain.start) || !Number.isFinite(domain.end)) return full;
  let start = clamp(domain.start, 0, maxIndex);
  let end = clamp(domain.end, 0, maxIndex);
  if (end < start) [start, end] = [end, start];
  if (end - start < 1) end = Math.min(maxIndex, start + 1);
  return { start, end };
}

function drawSignalOverlay(canvas, original, reconstructed, options = {}) {
  const { ctx, width, height } = getCanvasContext(canvas);
  clearCanvas(ctx, width, height, 'x');
  if (!original.length) return;
  const domain = normalizeDomain(options.domain, original.length - 1);
  const start = Math.floor(domain.start);
  const end = Math.ceil(domain.end);
  const span = Math.max(1, end - start);
  let visiblePeak = 1e-6;
  for (let i = start; i <= end; i += 1) {
    visiblePeak = Math.max(visiblePeak, Math.abs(original[i] ?? 0), Math.abs(reconstructed[i] ?? 0));
  }
  const yScale = (height * 0.42) / visiblePeak;

  const draw = (values, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = start; i <= end; i += 1) {
      const x = ((i - start) / span) * width;
      const y = height / 2 - (values[i] ?? 0) * yScale;
      if (i === start) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  draw(original, '#2f7de1');
  draw(reconstructed, '#d1691b');
  drawSelectionOverlay(ctx, width, height, options.hoverSelection, {
    fill: 'rgba(16, 167, 127, 0.10)',
    stroke: 'rgba(16, 167, 127, 0.70)',
    dashed: true
  });
  drawSelectionOverlay(ctx, width, height, options.selection);
}

function drawSpectrum(canvas, bins, color, options = {}) {
  const { ctx, width, height } = getCanvasContext(canvas);
  clearCanvas(ctx, width, height, 'y');
  if (!bins.length) return;

  const domain = normalizeDomain(options.domain, bins.length - 1);
  const start = Math.floor(domain.start);
  const end = Math.ceil(domain.end);
  const visible = bins.slice(start, end + 1);
  if (!visible.length) return;
  const MIN_DB = -80;
  const MAX_DB = 0;
  const toDb = (magnitude) => 20 * Math.log10((magnitude || 0) + 1e-12);
  const maxMagnitude = Math.max(...visible.map((bin) => bin.magnitude), 1e-9);
  const barWidth = width / visible.length;
  const highlightNotch = state.notchEnabled && state.notchBin >= start && state.notchBin <= end;
  const notchColor = '#d0342c';
  ctx.fillStyle = color;
  for (let i = 0; i < visible.length; i += 1) {
    let barHeight;
    if (state.spectrumScale === 'db') {
      const db = clamp(toDb(visible[i].magnitude), MIN_DB, MAX_DB);
      const ratio = (db - MIN_DB) / Math.max(1e-9, (MAX_DB - MIN_DB));
      barHeight = ratio * (height * 0.9);
    } else {
      barHeight = (visible[i].magnitude / maxMagnitude) * (height * 0.9);
    }
    const x = i * barWidth + 1;
    const y = height - barHeight;
    const isNotchBin = highlightNotch && (start + i) === state.notchBin;
    if (isNotchBin) ctx.fillStyle = notchColor;
    ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);
    if (isNotchBin) ctx.fillStyle = color;
  }
  drawSelectionOverlay(ctx, width, height, options.hoverSelection, {
    fill: 'rgba(16, 167, 127, 0.10)',
    stroke: 'rgba(16, 167, 127, 0.70)',
    dashed: true
  });
  drawSelectionOverlay(ctx, width, height, options.selection);
}

function attachPlotInteractions(config) {
  const {
    canvas,
    tooltip,
    resetButton,
    zoomOutButton,
    getDataLength,
    getTooltipHtml,
    requestRender
  } = config;
  const plotArea = canvas.parentElement;

  const interaction = {
    zoomDomain: null,
    isDragging: false,
    pointerId: null,
    hoverPx: null,
    dragStartPx: 0,
    dragCurrentPx: 0,
    isPanning: false,
    panStartPx: 0,
    panDomainStart: 0,
    panDomainEnd: 0
  };

  const getDomain = () => {
    const maxIndex = Math.max(0, getDataLength() - 1);
    return normalizeDomain(interaction.zoomDomain, maxIndex);
  };

  const getSelection = () => {
    if (!interaction.isDragging) return null;
    return {
      x0: interaction.dragStartPx,
      x1: interaction.dragCurrentPx
    };
  };

  const getHoverSelection = () => {
    if (interaction.isDragging || interaction.hoverPx === null) return null;
    const dataLength = getDataLength();
    if (!dataLength) return null;
    const domain = getDomain();
    const span = Math.max(1, domain.end - domain.start);
    const previewSpan = Math.max(8, Math.round(span * 0.24));
    const width = Math.max(1, canvas.clientWidth);
    const centerRatio = clamp(interaction.hoverPx / width, 0, 1);
    const center = domain.start + centerRatio * span;
    const start = center - previewSpan / 2;
    const end = center + previewSpan / 2;
    const clamped = normalizeDomain({ start, end }, Math.max(0, dataLength - 1));
    const x0 = ((clamped.start - domain.start) / Math.max(1e-9, span)) * width;
    const x1 = ((clamped.end - domain.start) / Math.max(1e-9, span)) * width;
    return { x0, x1 };
  };

  const hideTooltip = () => {
    if (tooltip) tooltip.hidden = true;
  };

  const resetZoom = () => {
    interaction.zoomDomain = null;
    interaction.hoverPx = null;
    interaction.isPanning = false;
    plotArea.classList.remove('is-panning');
    hideTooltip();
    requestRender();
  };

  const toCanvasX = (event) => {
    const rect = plotArea.getBoundingClientRect();
    return clamp(event.clientX - rect.left, 0, rect.width);
  };

  const xToIndex = (canvasX) => {
    const domain = getDomain();
    const width = Math.max(1, canvas.clientWidth || canvas.width);
    const ratio = canvasX / width;
    const raw = domain.start + ratio * (domain.end - domain.start);
    return clamp(Math.round(raw), 0, Math.max(0, getDataLength() - 1));
  };

  const showTooltip = (event) => {
    if (!tooltip || interaction.isDragging) return;
    const dataLength = getDataLength();
    if (!dataLength) {
      hideTooltip();
      return;
    }
    const areaRect = plotArea.getBoundingClientRect();
    const canvasX = toCanvasX(event);
    const index = xToIndex(canvasX);
    tooltip.innerHTML = getTooltipHtml(index);
    tooltip.hidden = false;

    const xPadding = 10;
    const yPadding = 10;
    const maxLeft = Math.max(0, (canvas.clientWidth || canvas.width) - tooltip.offsetWidth - 6);
    const maxTop = Math.max(0, (canvas.clientHeight || canvas.height) - tooltip.offsetHeight - 6);
    const left = clamp(event.clientX - areaRect.left + xPadding, 6, maxLeft);
    const top = clamp(event.clientY - areaRect.top + yPadding, 6, maxTop);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };

  const endDrag = (event) => {
    if (!interaction.isDragging) return;
    if (event) interaction.dragCurrentPx = toCanvasX(event);
    interaction.isDragging = false;
    interaction.pointerId = null;
    const width = Math.max(1, canvas.clientWidth || canvas.width);
    const minPx = Math.min(interaction.dragStartPx, interaction.dragCurrentPx);
    const maxPx = Math.max(interaction.dragStartPx, interaction.dragCurrentPx);
    const movedPx = maxPx - minPx;
    if (movedPx >= 4) {
      const domain = getDomain();
      const startRatio = clamp(minPx / width, 0, 1);
      const endRatio = clamp(maxPx / width, 0, 1);
      const nextStart = domain.start + startRatio * (domain.end - domain.start);
      const nextEnd = domain.start + endRatio * (domain.end - domain.start);
      interaction.zoomDomain = normalizeDomain({ start: nextStart, end: nextEnd }, Math.max(0, getDataLength() - 1));
    } else {
      const domain = getDomain();
      const span = Math.max(1, domain.end - domain.start);
      const previewSpan = Math.max(8, span * 0.24);
      const clickRatio = clamp(interaction.dragCurrentPx / width, 0, 1);
      const center = domain.start + clickRatio * span;
      const nextStart = center - previewSpan / 2;
      const nextEnd = center + previewSpan / 2;
      interaction.zoomDomain = normalizeDomain(
        { start: nextStart, end: nextEnd },
        Math.max(0, getDataLength() - 1)
      );
    }
    requestRender();
  };

  const startPan = (event) => {
    if (!interaction.zoomDomain) return false;
    interaction.isPanning = true;
    interaction.pointerId = event.pointerId;
    interaction.panStartPx = toCanvasX(event);
    const domain = getDomain();
    interaction.panDomainStart = domain.start;
    interaction.panDomainEnd = domain.end;
    hideTooltip();
    plotArea.classList.add('is-panning');
    plotArea.setPointerCapture(event.pointerId);
    return true;
  };

  const updatePan = (event) => {
    if (!interaction.isPanning) return;
    const width = Math.max(1, canvas.clientWidth || canvas.width);
    const maxIndex = Math.max(0, getDataLength() - 1);
    const domainSpan = interaction.panDomainEnd - interaction.panDomainStart;
    const currentPx = toCanvasX(event);
    const deltaPx = currentPx - interaction.panStartPx;
    const deltaDomain = (deltaPx / width) * domainSpan;
    let nextStart = interaction.panDomainStart - deltaDomain;
    let nextEnd = interaction.panDomainEnd - deltaDomain;
    if (nextStart < 0) {
      nextEnd += -nextStart;
      nextStart = 0;
    }
    if (nextEnd > maxIndex) {
      const over = nextEnd - maxIndex;
      nextStart -= over;
      nextEnd = maxIndex;
    }
    interaction.zoomDomain = normalizeDomain({ start: nextStart, end: nextEnd }, maxIndex);
    requestRender();
  };

  const endPan = () => {
    if (!interaction.isPanning) return;
    interaction.isPanning = false;
    interaction.pointerId = null;
    plotArea.classList.remove('is-panning');
    requestRender();
  };

  plotArea.addEventListener('pointermove', (event) => {
    if (interaction.isPanning) {
      updatePan(event);
      return;
    }
    if (interaction.isDragging) {
      interaction.dragCurrentPx = toCanvasX(event);
      requestRender();
      return;
    }
    interaction.hoverPx = toCanvasX(event);
    requestRender();
    showTooltip(event);
  });

  plotArea.addEventListener('pointerleave', () => {
    interaction.hoverPx = null;
    hideTooltip();
    requestRender();
  });

  plotArea.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    // Keep default behavior as zoom (click or drag). Pan only with modifier.
    if (interaction.zoomDomain && (event.altKey || event.shiftKey) && startPan(event)) {
      event.preventDefault();
      return;
    }
    interaction.isDragging = true;
    interaction.pointerId = event.pointerId;
    interaction.dragStartPx = toCanvasX(event);
    interaction.dragCurrentPx = interaction.dragStartPx;
    hideTooltip();
    plotArea.setPointerCapture(event.pointerId);
    requestRender();
    event.preventDefault();
  });

  plotArea.addEventListener('pointerup', (event) => {
    if (interaction.isPanning) {
      if (interaction.pointerId !== null && event.pointerId !== interaction.pointerId) return;
      endPan();
      return;
    }
    if (!interaction.isDragging) return;
    if (interaction.pointerId !== null && event.pointerId !== interaction.pointerId) return;
    endDrag(event);
  });

  plotArea.addEventListener('pointercancel', () => {
    if (interaction.isPanning) {
      endPan();
      return;
    }
    if (!interaction.isDragging) return;
    endDrag();
  });

  window.addEventListener('blur', () => {
    if (interaction.isPanning) {
      endPan();
      return;
    }
    if (!interaction.isDragging) return;
    endDrag();
  });

  plotArea.addEventListener('wheel', (event) => {
    if (!interaction.zoomDomain) return;
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    if (direction === 0) return;
    const maxIndex = Math.max(0, getDataLength() - 1);
    const domain = getDomain();
    const span = Math.max(1, domain.end - domain.start);
    const panStep = Math.max(1, span * 0.12);
    const shift = direction > 0 ? panStep : -panStep;
    let nextStart = domain.start + shift;
    let nextEnd = domain.end + shift;
    if (nextStart < 0) {
      nextEnd += -nextStart;
      nextStart = 0;
    }
    if (nextEnd > maxIndex) {
      const over = nextEnd - maxIndex;
      nextStart -= over;
      nextEnd = maxIndex;
    }
    interaction.zoomDomain = normalizeDomain({ start: nextStart, end: nextEnd }, maxIndex);
    requestRender();
  }, { passive: false });

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      resetZoom();
    });
  }

  if (zoomOutButton) {
    zoomOutButton.addEventListener('click', () => {
      const maxIndex = Math.max(0, getDataLength() - 1);
      if (maxIndex <= 0) return;
      const domain = getDomain();
      const span = Math.max(1, domain.end - domain.start);
      const center = (domain.start + domain.end) / 2;
      const nextSpan = Math.min(maxIndex, Math.round(span * 2));
      let nextStart = center - nextSpan / 2;
      let nextEnd = center + nextSpan / 2;
      if (nextStart < 0) {
        nextEnd += -nextStart;
        nextStart = 0;
      }
      if (nextEnd > maxIndex) {
        const over = nextEnd - maxIndex;
        nextStart -= over;
        nextEnd = maxIndex;
      }
      interaction.zoomDomain = normalizeDomain({ start: nextStart, end: nextEnd }, maxIndex);
      requestRender();
    });
  }

  return {
    resetZoom,
    getRenderOptions() {
      return {
        domain: getDomain(),
        selection: getSelection(),
        hoverSelection: getHoverSelection()
      };
    }
  };
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

function renderPlots() {
  const timeOptions = plotInteractions.time
    ? plotInteractions.time.getRenderOptions()
    : { domain: null, selection: null, hoverSelection: null };
  const originalSpectrumOptions = plotInteractions.originalSpectrum
    ? plotInteractions.originalSpectrum.getRenderOptions()
    : { domain: null, selection: null, hoverSelection: null };
  const filteredSpectrumOptions = plotInteractions.filteredSpectrum
    ? plotInteractions.filteredSpectrum.getRenderOptions()
    : { domain: null, selection: null, hoverSelection: null };

  drawSignalOverlay(els.signalCanvas, state.analysisSignal, state.reconstructedSignal, timeOptions);
  drawSpectrum(els.originalSpectrumCanvas, state.originalSpectrumHalf, '#10a77f', originalSpectrumOptions);
  drawSpectrum(els.filteredSpectrumCanvas, state.filteredSpectrumHalf, '#d1691b', filteredSpectrumOptions);
}

async function analyze() {
  setStatus('Analyzing...');
  if (state.source === 'phone-call-demo') {
    const ready = await ensurePhoneDemoLoaded();
    if (!ready || !state.phoneDemoBuffer) {
      setStatus('Demo audio failed to load');
      return;
    }
    state.sampleRate = state.phoneDemoBuffer.sampleRate || DEFAULT_SAMPLE_RATE;
  } else {
    state.sampleRate = DEFAULT_SAMPLE_RATE;
  }
  const rawSignal = generateSignalRaw();
  state.rawSignal = rawSignal;
  state.analysisSignal = applyWindow(rawSignal);
  const fullSpectrum = dft(state.analysisSignal);
  state.originalSpectrumFull = fullSpectrum;
  state.originalSpectrumHalf = magnitudeHalf(fullSpectrum);

  if (state.source === 'phone-call-demo') {
    const start = getPhoneDemoSegmentStart();
    const cleanSegment = sliceWithPad(state.phoneDemoCleanMono, start, state.sampleCount);
    const cleanWindowed = applyWindow(cleanSegment);
    const cleanSpectrum = dft(cleanWindowed);
    state.filteredSpectrumFull = filterSpectrum(cleanSpectrum);
    state.filteredSpectrumHalf = magnitudeHalf(state.filteredSpectrumFull);
    state.reconstructedSignal = idft(state.filteredSpectrumFull);
    const metrics = computePhoneDemoMetrics(
      cleanWindowed,
      state.analysisSignal,
      state.reconstructedSignal,
      state.originalSpectrumHalf,
      state.filteredSpectrumHalf
    );
    renderPhoneDemoMetrics(metrics);
  } else {
    state.filteredSpectrumFull = filterSpectrum(fullSpectrum);
    state.filteredSpectrumHalf = magnitudeHalf(state.filteredSpectrumFull);
    state.reconstructedSignal = idft(state.filteredSpectrumFull);
    renderPhoneDemoMetrics(null);
  }

  renderPlots();
  renderComponentsList(state.originalSpectrumHalf);
  renderFormulaPanel();
  renderBinHzHelpers();
  setStatus('Ready');
}

function setupPlotInteractionBindings() {
  plotInteractions.time = attachPlotInteractions({
    canvas: els.signalCanvas,
    tooltip: els.timeTooltip,
    resetButton: els.resetZoomTime,
    zoomOutButton: els.zoomOutTime,
    getDataLength: () => state.analysisSignal.length,
    getTooltipHtml: (index) => {
      const original = state.analysisSignal[index] ?? 0;
      const reconstructed = state.reconstructedSignal[index] ?? 0;
      const timeSec = index / state.sampleRate;
      return [
        `n: ${index}`,
        `t: ${timeSec.toFixed(4)} s`,
        `amp: ${original.toFixed(3)}`,
        `recon: ${reconstructed.toFixed(3)}`
      ].join('<br>');
    },
    requestRender: renderPlots
  });

  plotInteractions.originalSpectrum = attachPlotInteractions({
    canvas: els.originalSpectrumCanvas,
    tooltip: els.originalSpectrumTooltip,
    resetButton: els.resetZoomOriginalSpectrum,
    zoomOutButton: els.zoomOutOriginalSpectrum,
    getDataLength: () => state.originalSpectrumHalf.length,
    getTooltipHtml: (index) => {
      const bin = state.originalSpectrumHalf[index];
      const magnitude = bin ? bin.magnitude : 0;
      const hz = (index * state.sampleRate) / state.sampleCount;
      return [
        `k: ${index}`,
        `${hz.toFixed(1)} Hz`,
        `mag: ${magnitude.toFixed(6)}`
      ].join('<br>');
    },
    requestRender: renderPlots
  });

  plotInteractions.filteredSpectrum = attachPlotInteractions({
    canvas: els.filteredSpectrumCanvas,
    tooltip: els.filteredSpectrumTooltip,
    resetButton: els.resetZoomFilteredSpectrum,
    zoomOutButton: els.zoomOutFilteredSpectrum,
    getDataLength: () => state.filteredSpectrumHalf.length,
    getTooltipHtml: (index) => {
      const bin = state.filteredSpectrumHalf[index];
      const magnitude = bin ? bin.magnitude : 0;
      const hz = (index * state.sampleRate) / state.sampleCount;
      return [
        `k: ${index}`,
        `${hz.toFixed(1)} Hz`,
        `mag: ${magnitude.toFixed(6)}`
      ].join('<br>');
    },
    requestRender: renderPlots
  });
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

function resetAll() {
  stopPlayback();
  hideCosmoGreeting();

  state.source = 'sine';
  state.sampleRate = DEFAULT_SAMPLE_RATE;
  state.sampleCount = 1024;
  state.freq1 = 120;
  state.freq2 = 260;
  state.harmonics = 9;
  state.windowType = 'rectangular';
  state.notchEnabled = false;
  state.notchWidth = 3;
  state.lowPassCutoff = halfSpectrumMaxBin(state.sampleCount);
  state.notchBin = Math.min(60, state.lowPassCutoff);

  els.source.value = state.source;
  els.samples.value = String(state.sampleCount);
  els.freq1.value = String(state.freq1);
  els.freq2.value = String(state.freq2);
  els.harmonics.value = String(state.harmonics);
  els.windowType.value = state.windowType;
  els.notchEnabled.checked = state.notchEnabled;

  setEditableValueText(els.samplesValue, state.sampleCount, els.samples);
  setEditableValueText(els.freq1Value, state.freq1, els.freq1);
  setEditableValueText(els.freq2Value, state.freq2, els.freq2);
  setEditableValueText(els.harmonicsValue, state.harmonics, els.harmonics);

  setAdvancedOpen(false);
  updateSourceControlVisibility();
  updateFilterBounds();

  plotInteractions.time?.resetZoom?.();
  plotInteractions.originalSpectrum?.resetZoom?.();
  plotInteractions.filteredSpectrum?.resetZoom?.();

  analyze();
}

function applyPhoneDemoDefaults() {
  const perBin = hzPerBin();
  const maxBin = halfSpectrumMaxBin(state.sampleCount);
  const targetBin = clamp(Math.round(60 / perBin), 1, maxBin);
  const cutoffBin = clamp(Math.round(7000 / perBin), 1, maxBin);
  state.windowType = 'hann';
  if (els.windowType) {
    els.windowType.value = state.windowType;
  }
  state.notchEnabled = true;
  state.lowPassCutoff = cutoffBin;
  state.notchBin = targetBin;
  state.notchWidth = 2;
  els.notchEnabled.checked = true;
  updateFilterBounds();
}

function bindEvents() {
  els.source.addEventListener('change', (event) => {
    const previousSource = state.source;
    state.source = event.target.value;
    updateSourceControlVisibility();
    ensurePhoneDemoOption();
    if (state.source === 'phone-call-demo' && previousSource !== 'phone-call-demo') {
      applyPhoneDemoDefaults();
    }
    analyze();
  });

  els.samples.addEventListener('input', (event) => {
    state.sampleCount = Number(event.target.value);
    setEditableValueText(els.samplesValue, state.sampleCount, els.samples);
    updateFilterBounds();
    analyze();
  });

  els.freq1.addEventListener('input', (event) => {
    state.freq1 = Number(event.target.value);
    setEditableValueText(els.freq1Value, state.freq1, els.freq1);
    analyze();
  });

  els.freq2.addEventListener('input', (event) => {
    state.freq2 = Number(event.target.value);
    setEditableValueText(els.freq2Value, state.freq2, els.freq2);
    analyze();
  });

  els.harmonics.addEventListener('input', (event) => {
    state.harmonics = Number(event.target.value);
    setEditableValueText(els.harmonicsValue, state.harmonics, els.harmonics);
    analyze();
  });

  els.windowType.addEventListener('change', (event) => {
    state.windowType = event.target.value;
    analyze();
  });

  if (els.spectrumScale) {
    els.spectrumScale.addEventListener('change', (event) => {
      state.spectrumScale = event.target.value;
      renderPlots();
    });
  }

  els.lowPass.addEventListener('input', (event) => {
    state.lowPassCutoff = Number(event.target.value);
    setEditableValueText(els.lowPassValue, state.lowPassCutoff, els.lowPass);
    renderBinHzHelpers();
    analyze();
  });

  els.notchEnabled.addEventListener('change', (event) => {
    state.notchEnabled = Boolean(event.target.checked);
    updateSourceControlVisibility();
    analyze();
  });

  els.notchBin.addEventListener('input', (event) => {
    state.notchBin = Number(event.target.value);
    setEditableValueText(els.notchBinValue, state.notchBin, els.notchBin);
    renderBinHzHelpers();
    analyze();
  });

  els.notchWidth.addEventListener('input', (event) => {
    state.notchWidth = Number(event.target.value);
    setEditableValueText(els.notchWidthValue, state.notchWidth, els.notchWidth);
    renderBinHzHelpers();
    analyze();
  });

  els.resetFilters.addEventListener('click', resetFilters);
  if (els.resetAll) els.resetAll.addEventListener('click', resetAll);
  if (els.examplePhoneDemo) {
    els.examplePhoneDemo.addEventListener('click', () => {
      const previousSource = state.source;
      state.source = 'phone-call-demo';
      ensurePhoneDemoOption();
      updateSourceControlVisibility();
      if (previousSource !== 'phone-call-demo') applyPhoneDemoDefaults();
      analyze();
    });
  }
  els.playOriginal.addEventListener('click', async () => {
    if (state.source === 'phone-call-demo') {
      const ready = await ensurePhoneDemoLoaded();
      if (!ready) {
        setStatus('Demo audio failed to load');
        return;
      }
      const raw = getPhoneDemoPlaybackRaw();
      playSignal(raw, 'Playing original demo', {
        tile: false,
        sampleRate: state.sampleRate,
        referencePeak: peakAbs(raw)
      });
      return;
    }
    playSignal(state.rawSignal, 'Playing original');
  });
  els.playReconstructed.addEventListener('click', async () => {
    if (state.source === 'phone-call-demo') {
      const ready = await ensurePhoneDemoLoaded();
      if (!ready) {
        setStatus('Demo audio failed to load');
        return;
      }
      setStatus('Preparing reconstructed demo...');
      setDemoProcessing(true, 'Processing… 0%');
      const raw = getPhoneDemoPlaybackRaw();
      const clean = getPhoneDemoPlaybackClean();
      let reconstructed = [];
      try {
        reconstructed = await getPhoneDemoFilteredPlayback(clean, (done, total) => {
          const pct = Math.round((done / Math.max(1, total)) * 100);
          setDemoProcessing(true, `Processing… ${pct}%`);
        });
      } finally {
        setDemoProcessing(false);
      }
      const leveledReconstructed = matchPerceivedLoudness(reconstructed, raw, 10);
      playSignal(leveledReconstructed, 'Playing reconstructed demo', {
        tile: false,
        sampleRate: state.sampleRate,
        gain: 2.5,
        nearEndSeconds: 0.5,
        onNearEnd: () => {
          if (cosmoHearYouShown) return;
          cosmoHearYouShown = true;
          showCosmoOneShot({
            src: '/i_can_hear_you.png',
            alt: 'Cosmo can hear you',
            text: 'Yes, I can hear you now.'
          }, 6500);
        }
      });
      return;
    }
    playSignal(state.reconstructedSignal, 'Playing reconstructed');
  });
  els.playDifference.addEventListener('click', async () => {
    if (state.source === 'phone-call-demo') {
      const ready = await ensurePhoneDemoLoaded();
      if (!ready) {
        setStatus('Demo audio failed to load');
        return;
      }
      setStatus('Preparing difference demo...');
      setDemoProcessing(true, 'Processing… 0%');
      const raw = getPhoneDemoPlaybackRaw();
      let reconstructed = [];
      try {
        reconstructed = await getPhoneDemoFilteredPlayback(raw, (done, total) => {
          const pct = Math.round((done / Math.max(1, total)) * 100);
          setDemoProcessing(true, `Processing… ${pct}%`);
        });
      } finally {
        setDemoProcessing(false);
      }
      const diff = raw.map((v, i) => v - (reconstructed[i] ?? 0));
      playSignal(diff, 'Playing difference demo', {
        tile: false,
        sampleRate: state.sampleRate,
        referencePeak: peakAbs(raw)
      });
      return;
    }
    const diff = state.rawSignal.map((v, i) => v - (state.reconstructedSignal[i] ?? 0));
    playSignal(diff, 'Playing difference');
  });
  els.help.addEventListener('click', () => els.helpDialog.showModal());
  els.closeHelp.addEventListener('click', () => els.helpDialog.close());

  if (cosmoEls.close) {
    cosmoEls.close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      cosmoLastDismissedAt = Date.now();
      hideCosmoGreeting();
      scheduleCosmoGreeting();
    });
  }
}

function initializeDefaults() {
  els.source.value = state.source;
  updateSourceControlVisibility();
  ensurePhoneDemoOption();
  setAdvancedOpen(false);
  els.freq1.value = String(state.freq1);
  setEditableValueText(els.freq1Value, state.freq1, els.freq1);
  els.freq2.value = String(state.freq2);
  setEditableValueText(els.freq2Value, state.freq2, els.freq2);
  els.harmonics.value = String(state.harmonics);
  setEditableValueText(els.harmonicsValue, state.harmonics, els.harmonics);
  els.samples.value = String(state.sampleCount);
  setEditableValueText(els.samplesValue, state.sampleCount, els.samples);
  els.windowType.value = state.windowType;
  if (els.spectrumScale) els.spectrumScale.value = state.spectrumScale;
  els.notchEnabled.checked = state.notchEnabled;
  updateFilterBounds();
  setupEditableNumberValue(els.freq1Value, els.freq1);
  setupEditableNumberValue(els.freq2Value, els.freq2);
  setupEditableNumberValue(els.samplesValue, els.samples);
  setupEditableNumberValue(els.harmonicsValue, els.harmonics);
  setupEditableNumberValue(els.lowPassValue, els.lowPass);
  setupEditableNumberValue(els.notchBinValue, els.notchBin);
  setupEditableNumberValue(els.notchWidthValue, els.notchWidth);
  renderFormulaPanel();
  renderBinHzHelpers();
}

function init() {
  setupPlotInteractionBindings();
  bindSidebarUi();
  initializeDefaults();
  bindEvents();
  analyze();
  scheduleCosmoGreeting();
}

init();
