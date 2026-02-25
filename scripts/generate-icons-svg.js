const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Read the main SVG icon
const svgContent = fs.readFileSync(path.join(process.cwd(), 'public', 'icon.svg'), 'utf8');

// Icon sizes for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate SVG files for each size (as a fallback)
sizes.forEach(size => {
  // Modify SVG viewBox and dimensions for each size
  const modifiedSvg = svgContent
    .replace('width="512"', `width="${size}"`)
    .replace('height="512"', `height="${size}"`);
  
  // Save SVG version
  fs.writeFileSync(
    path.join(iconsDir, `icon-${size}x${size}.svg`),
    modifiedSvg
  );
  
  console.log(`Generated icon-${size}x${size}.svg`);
});

// Create a simple favicon.ico equivalent
fs.copyFileSync(
  path.join(process.cwd(), 'public', 'icon.svg'),
  path.join(process.cwd(), 'public', 'favicon.svg')
);

console.log('\n✅ SVG icons generated successfully!');
console.log('Note: For production, consider using a tool like:');
console.log('- sharp (npm install sharp) to convert SVG to PNG');
console.log('- Or online tools like https://cloudconvert.com/svg-to-png');
console.log('\nAlternatively, install the required package:');
console.log('npm install puppeteer');
console.log('Then run: node scripts/svg-to-png.js');
