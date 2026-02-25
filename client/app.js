const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_PLAY_SECONDS = 1.25;
const DEFAULT_GAIN = 0.12;
const DEFAULT_FADE_SECONDS = 0.015;

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
  lowPassHz: document.getElementById('low-pass-hz'),
  notchEnabled: document.getElementById('notch-enabled'),
  notchBin: document.getElementById('notch-bin'),
  notchBinValue: document.getElementById('notch-bin-value'),
  notchBinHz: document.getElementById('notch-bin-hz'),
  notchWidth: document.getElementById('notch-width'),
  notchWidthValue: document.getElementById('notch-width-value'),
  notchWidthHz: document.getElementById('notch-width-hz'),
  analyze: document.getElementById('btn-analyze'),
  resetFilters: document.getElementById('btn-reset-filters'),
  playOriginal: document.getElementById('btn-play-original'),
  playReconstructed: document.getElementById('btn-play-reconstructed'),
  playDifference: document.getElementById('btn-play-difference'),
  signalCanvas: document.getElementById('signal-canvas'),
  originalSpectrumCanvas: document.getElementById('spectrum-noisy-canvas'),
  filteredSpectrumCanvas: document.getElementById('spectrum-filtered-canvas'),
  timeTooltip: document.getElementById('tooltip-time'),
  originalSpectrumTooltip: document.getElementById('tooltip-original-spectrum'),
  filteredSpectrumTooltip: document.getElementById('tooltip-filtered-spectrum'),
  resetZoomTime: document.getElementById('btn-reset-zoom-time'),
  resetZoomOriginalSpectrum: document.getElementById('btn-reset-zoom-original-spectrum'),
  resetZoomFilteredSpectrum: document.getElementById('btn-reset-zoom-filtered-spectrum'),
  componentsList: document.getElementById('components-list'),
  formulaBody: document.getElementById('formula-body'),
  help: document.getElementById('btn-help'),
  helpDialog: document.getElementById('help-dialog'),
  closeHelp: document.getElementById('btn-close-help')
};

const plotInteractions = {
  time: null,
  originalSpectrum: null,
  filteredSpectrum: null
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

function renderFormulaPanel() {
  if (!els.formulaBody) return;
  const f1 = state.freq1;
  const f2 = state.freq2;
  const h = state.harmonics;

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

function stopPlayback() {
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

function tileToDuration(signal, seconds) {
  const targetSamples = Math.max(1, Math.floor(state.sampleRate * seconds));
  const out = new Float32Array(targetSamples);
  for (let i = 0; i < targetSamples; i += 1) {
    out[i] = signal[i % signal.length];
  }
  return out;
}

function playSignal(signal, label) {
  if (!signal || !signal.length) return;
  const context = getAudioContext();
  if (!context) {
    setStatus('Audio not supported');
    return;
  }

  stopPlayback();

  const sourceData = clampSignal(normalizeSignal(tileToDuration(signal, DEFAULT_PLAY_SECONDS)));

  const buffer = context.createBuffer(1, sourceData.length, state.sampleRate);
  buffer.copyToChannel(sourceData, 0);

  const sourceNode = context.createBufferSource();
  sourceNode.buffer = buffer;

  const gainNode = context.createGain();
  gainNode.gain.value = 0;

  sourceNode.connect(gainNode);
  gainNode.connect(context.destination);

  const now = context.currentTime;
  const fade = DEFAULT_FADE_SECONDS;
  const endTime = now + buffer.duration;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(DEFAULT_GAIN, now + fade);
  gainNode.gain.setValueAtTime(DEFAULT_GAIN, Math.max(now + fade, endTime - fade));
  gainNode.gain.linearRampToValueAtTime(0, endTime);

  context.resume().catch(() => {});
  sourceNode.start();

  activeSourceNode = sourceNode;
  setStatus(label);

  sourceNode.onended = () => {
    if (activeSourceNode === sourceNode) {
      activeSourceNode.disconnect();
      activeSourceNode = null;
    }
    setStatus('Ready');
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
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
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
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  clearCanvas(ctx, width, height, 'y');
  if (!bins.length) return;

  const domain = normalizeDomain(options.domain, bins.length - 1);
  const start = Math.floor(domain.start);
  const end = Math.ceil(domain.end);
  const visible = bins.slice(start, end + 1);
  if (!visible.length) return;
  const maxMagnitude = Math.max(...visible.map((bin) => bin.magnitude), 1e-9);
  const barWidth = width / visible.length;
  ctx.fillStyle = color;
  for (let i = 0; i < visible.length; i += 1) {
    const barHeight = (visible[i].magnitude / maxMagnitude) * (height * 0.9);
    const x = i * barWidth + 1;
    const y = height - barHeight;
    ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);
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
    const clientWidth = Math.max(1, canvas.clientWidth || canvas.width);
    const scaleX = canvas.width / clientWidth;
    return {
      x0: interaction.dragStartPx * scaleX,
      x1: interaction.dragCurrentPx * scaleX
    };
  };

  const getHoverSelection = () => {
    if (interaction.isDragging || interaction.hoverPx === null) return null;
    const dataLength = getDataLength();
    if (!dataLength) return null;
    const domain = getDomain();
    const span = Math.max(1, domain.end - domain.start);
    const previewSpan = Math.max(8, Math.round(span * 0.24));
    const width = Math.max(1, canvas.clientWidth || canvas.width);
    const centerRatio = clamp(interaction.hoverPx / width, 0, 1);
    const center = domain.start + centerRatio * span;
    const start = center - previewSpan / 2;
    const end = center + previewSpan / 2;
    const clamped = normalizeDomain({ start, end }, Math.max(0, dataLength - 1));
    const scaleX = canvas.width / width;
    const x0 = ((clamped.start - domain.start) / Math.max(1e-9, span)) * width * scaleX;
    const x1 = ((clamped.end - domain.start) / Math.max(1e-9, span)) * width * scaleX;
    return { x0, x1 };
  };

  const hideTooltip = () => {
    if (tooltip) tooltip.hidden = true;
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
      interaction.zoomDomain = null;
      interaction.hoverPx = null;
      interaction.isPanning = false;
      plotArea.classList.remove('is-panning');
      hideTooltip();
      requestRender();
    });
  }

  return {
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

function analyze() {
  setStatus('Analyzing...');
  const rawSignal = generateSignalRaw();
  state.analysisSignal = applyWindow(rawSignal);
  const fullSpectrum = dft(state.analysisSignal);
  state.originalSpectrumHalf = magnitudeHalf(fullSpectrum);
  state.filteredSpectrumFull = filterSpectrum(fullSpectrum);
  state.filteredSpectrumHalf = magnitudeHalf(state.filteredSpectrumFull);
  state.reconstructedSignal = idft(state.filteredSpectrumFull);

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

function bindEvents() {
  els.source.addEventListener('change', (event) => {
    state.source = event.target.value;
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

  els.lowPass.addEventListener('input', (event) => {
    state.lowPassCutoff = Number(event.target.value);
    setEditableValueText(els.lowPassValue, state.lowPassCutoff, els.lowPass);
    renderBinHzHelpers();
    analyze();
  });

  els.notchEnabled.addEventListener('change', (event) => {
    state.notchEnabled = Boolean(event.target.checked);
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

  els.analyze.addEventListener('click', analyze);
  els.resetFilters.addEventListener('click', resetFilters);
  els.playOriginal.addEventListener('click', () => {
    const raw = generateSignalRaw();
    playSignal(raw, 'Playing original');
  });
  els.playReconstructed.addEventListener('click', () => {
    playSignal(state.reconstructedSignal, 'Playing reconstructed');
  });
  els.playDifference.addEventListener('click', () => {
    const raw = generateSignalRaw();
    const diff = raw.map((v, i) => v - (state.reconstructedSignal[i] ?? 0));
    playSignal(diff, 'Playing difference');
  });
  els.help.addEventListener('click', () => els.helpDialog.showModal());
  els.closeHelp.addEventListener('click', () => els.helpDialog.close());
}

function initializeDefaults() {
  els.source.value = state.source;
  els.freq1.value = String(state.freq1);
  setEditableValueText(els.freq1Value, state.freq1, els.freq1);
  els.freq2.value = String(state.freq2);
  setEditableValueText(els.freq2Value, state.freq2, els.freq2);
  els.harmonics.value = String(state.harmonics);
  setEditableValueText(els.harmonicsValue, state.harmonics, els.harmonics);
  els.samples.value = String(state.sampleCount);
  setEditableValueText(els.samplesValue, state.sampleCount, els.samples);
  els.windowType.value = state.windowType;
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
  initializeDefaults();
  bindEvents();
  analyze();
}

init();
