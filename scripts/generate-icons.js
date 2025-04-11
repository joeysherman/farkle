import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

// Function to create an icon
function createIcon(size, text) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Add border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = size * 0.02;
  ctx.strokeRect(0, 0, size, size);

  // Add text
  ctx.fillStyle = '#000000';
  ctx.font = `${size * 0.1}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);

  return canvas.toBuffer();
}

// Ensure the icons directory exists
const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icons
const icons = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
];

icons.forEach(({ size, name }) => {
  const buffer = createIcon(size, `${size}x${size}`);
  fs.writeFileSync(path.join(iconsDir, name), buffer);
  console.log(`Generated ${name}`);
}); 