import * as THREE from 'three';

function finalizeTexture(tex: THREE.CanvasTexture, maxAniso: number, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export function createTerrainTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c59d6c';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 3.5;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(155, 112, 68, 0.22)' : 'rgba(222, 188, 142, 0.18)';
    ctx.fillRect(x, y, r, r);
  }

  // Dry highland grass tufts
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = 'rgba(116, 122, 69, 0.25)';
    ctx.fillRect(x, y, 4 + Math.random() * 8, 2 + Math.random() * 4);
  }

  return finalizeTexture(new THREE.CanvasTexture(canvas), maxAniso, 28, 28);
}

export function createAsphaltTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2a2e35';
  ctx.fillRect(0, 0, 256, 512);

  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const shade = 35 + Math.floor(Math.random() * 28);
    ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Road side solid curbs/lines
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(10, 0, 5, 512);
  ctx.fillRect(241, 0, 5, 512);

  // Center dashed line
  ctx.fillStyle = '#f59e0b';
  for (let y = 20; y < 512; y += 64) {
    ctx.fillRect(124, y, 8, 36);
  }

  return finalizeTexture(new THREE.CanvasTexture(canvas), maxAniso, 1, 18);
}

export function createBuildingFacadeTexture(
  maxAniso: number,
  wallHex: string,
  accentHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = wallHex;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle plaster grain
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }

  // Horizontal trim band
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 120, 256, 10);
  ctx.fillRect(0, 240, 256, 16);

  // Windows grid (Algerian apartment shutters)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const wx = 26 + col * 78;
      const wy = 24 + row * 124;
      ctx.fillStyle = '#26303d';
      ctx.fillRect(wx, wy, 44, 58);
      // Warm interior glow in some windows
      ctx.fillStyle = (row + col) % 2 === 0 ? '#d99b4e' : '#3a4a5e';
      ctx.fillRect(wx + 4, wy + 4, 36, 50);
      // Shutter bars
      ctx.fillStyle = accentHex;
      ctx.fillRect(wx - 4, wy - 2, 52, 6);
    }
  }

  return finalizeTexture(new THREE.CanvasTexture(canvas), maxAniso, 1, 1);
}

export function createSignTexture(
  maxAniso: number,
  title: string,
  subtitle: string,
  bgColor = '#141923',
  textColor = '#fbbf24'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = textColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = textColor;
  ctx.font = 'bold 46px Cairo, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 64);

  ctx.fillStyle = '#e7e5e4';
  ctx.font = '600 24px Tajawal, sans-serif';
  ctx.fillText(subtitle, 256, 118);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function createAlgerianPlateTexture(maxAniso: number, plateText: string, isRear: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  // Algerian standard: white front, yellow rear
  ctx.fillStyle = isRear ? '#facc15' : '#f8fafc';
  ctx.fillRect(0, 0, 256, 64);

  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 250, 58);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(plateText, 128, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
