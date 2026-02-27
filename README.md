# CodeSignal Fourier Explorer

Interactive Fourier decomposition + filtering playground built on the CodeSignal Bespoke template.

## What It Does

- Generates synthetic signals (sine / two sines / square Fourier series / irregular shape)
- Computes DFT/IDFT and visualizes:
  - Time domain (original vs reconstructed)
  - Spectrum magnitude (original vs filtered)
  - Strongest frequency components list
- Frequency-domain filters:
  - Low-pass (by bin index)
  - Notch (center bin + width)
- Built-in example: Phone call noise removal (one click from sidebar)
- Plot interactions:
  - Hover tooltip
  - Click or drag to zoom
  - Shift/Alt + drag to pan (when zoomed)
  - Mouse wheel pans (when zoomed)
  - Zoom out / Reset zoom buttons

## Run Locally

Requirements:
- Node.js + npm

Commands:
```bash
npm install
npm run start:dev
```

Open:
- http://localhost:3000

## Production Build

```bash
npm run build
npm run start:prod
```

## Assets

Audio (phone-call example):
- `client/public/audio/Cosmo_clean.wav`
- `client/public/audio/Cosmo_noisy.wav`
- `client/public/audio/Cosmo_noisy_light.wav`

Cosmo greeter images:
- `client/public/cosmo-wave.png`
- `client/public/Torso_Thumbs_Up.png`
- `client/public/cosmo_Torso_Star_Eyes.svg`
- `client/public/Cosmo_Laying_Exhausted.svg`
- `client/public/i_can_hear_you.png`

## Notes

- DFT is intentionally implemented directly in JS for learning clarity (not an external DSP library).
- The UI uses the CodeSignal design system from `client/design-system/` and bespoke layout in `client/bespoke-template.css`.

1. Download `release.tar.gz` from the latest GitHub Release (e.g. with `wget`)
2. Extract (and remove) the tarball: `tar -xzf release.tar.gz && rm release.tar.gz`
3. Start the production server: `npm run start:prod`
