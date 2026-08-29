import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = resolve('public/icons');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

function drawIcon(ctx, size) {
  const radius = size * 0.25;
  const center = size / 2;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6366f1');
  gradient.addColorStop(1, '#8b5cf6');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fill();

  // Task lines
  const lineHeight = size * 0.045;
  const lineGap = size * 0.06;
  const startY = size * 0.38;
  const startX = size * 0.31;
  const lineWidths = [size * 0.375, size * 0.25, size * 0.125];

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  lineWidths.forEach((width, i) => {
    const y = startY + i * lineGap;
    ctx.roundRect(startX, y, width, lineHeight, lineHeight / 2);
    ctx.fill();
    if (i > 0) ctx.fillStyle = `rgba(255, 255, 255, ${0.7 - i * 0.2})`;
  });

  // Plus circle in corner
  const circleX = size * 0.78;
  const circleY = size * 0.22;
  const circleR = size * 0.09;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
  ctx.fill();

  // Plus sign
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = size * 0.015;
  ctx.lineCap = 'round';
  const plusSize = size * 0.05;

  ctx.beginPath();
  ctx.moveTo(circleX - plusSize, circleY);
  ctx.lineTo(circleX + plusSize, circleY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(circleX, circleY - plusSize);
  ctx.lineTo(circleX, circleY + plusSize);
  ctx.stroke();
}

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  drawIcon(ctx, size);

  const buffer = canvas.toBuffer('image/png');
  writeFileSync(resolve(outputDir, `icon-${size}x${size}.png`), buffer);
  console.log(`Generated icon-${size}x${size}.png`);
});

console.log('All icons generated successfully!');