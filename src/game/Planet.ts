import * as THREE from 'three';

/** Small procedural globe: blue oceans, brown soil and green vegetation. */
export function planetSurface() {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 384;
  const context = canvas.getContext('2d')!, pixels = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    const longitude = x / canvas.width * Math.PI * 2, latitude = (y / canvas.height - 0.5) * Math.PI;
    const land = Math.sin(longitude * 2 + Math.sin(latitude * 2.3)) + Math.cos(longitude * 4 - latitude * 3) * 0.43 + Math.sin(latitude * 5 + longitude) * 0.3;
    const dry = Math.sin(longitude * 1.4 + latitude * 2.6) > -0.05 && land > 0.4;
    const grain = Math.sin(x * 0.14 + Math.cos(y * 0.16)) * 5;
    const rgb = land < 0 ? land > -0.13 ? [67, 151, 174] : [46, 112, 169] : land < 0.13 ? [180, 159, 106] : dry ? [152, 106, 65] : [83, 133, 67];
    const i = (y * canvas.width + x) * 4;
    for (let k = 0; k < 3; k++) pixels.data[i + k] = rgb[k] + grain;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
