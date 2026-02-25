// This script generates PWA icons in different sizes
// You can replace the base icon with your own design

const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG template for the icon (purple gradient background with chart symbol)
const createSVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6d28d9;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
  <text x="50%" y="52%" font-family="system-ui" font-size="${size * 0.4}px" text-anchor="middle" fill="white">📊</text>
</svg>
`;

// Icon sizes for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate placeholder HTML files for each icon
sizes.forEach(size => {
  const svg = createSVG(size);
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  ${svg}
</body>
</html>`;
  
  // Save as HTML (since we can't generate actual PNGs without a graphics library)
  // In production, you would use a proper image generation library
  fs.writeFileSync(
    path.join(iconsDir, `icon-${size}x${size}.html`),
    htmlContent
  );
  
  console.log(`Generated icon-${size}x${size}.html`);
});

// Create a simple PNG placeholder for demonstration
// In production, use a library like sharp or canvas to generate actual PNGs
const createPlaceholderPNG = () => {
  console.log('\n⚠️  Note: HTML icon placeholders have been created.');
  console.log('For production, you should:');
  console.log('1. Create actual PNG icons using a design tool');
  console.log('2. Or use a library like "sharp" to convert SVG to PNG');
  console.log('3. Place them in the public/icons directory');
  console.log('\nIcon requirements:');
  console.log('- Transparent background or solid color');
  console.log('- Square aspect ratio');
  console.log('- Clear at small sizes');
  console.log('- Follow Material Design guidelines for maskable icons');
};

createPlaceholderPNG();

// Create sample icon files (empty files for now)
sizes.forEach(size => {
  const filePath = path.join(iconsDir, `icon-${size}x${size}.png`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, ''); // Create empty file as placeholder
  }
});

console.log('\n✅ Icon placeholders created in public/icons/');
console.log('Replace these with actual PNG icons for production.');
