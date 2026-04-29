const sharp = require('sharp');
let pngToIco = require('png-to-ico');
if (typeof pngToIco !== 'function' && pngToIco.default) pngToIco = pngToIco.default;
const fs = require('fs');
const path = require('path');

async function convert() {
  const svgPath = path.join(__dirname, '../public/window-icon.svg');
  const pngPath = path.join(__dirname, '../public/window-icon.png');
  const icoPath = path.join(__dirname, '../public/window-icon.ico');

  try {
    console.log('Converting SVG to PNG...');
    // Generate a high-res PNG first (256x256 is good for ICO conversion)
    await sharp(svgPath)
      .resize(256, 256)
      .png()
      .toFile(pngPath);
    
    console.log('Converting PNG to ICO...');
    const buf = await pngToIco(pngPath);
    fs.writeFileSync(icoPath, buf);
    
    console.log('Icon conversion complete!');
    console.log(`Saved to: ${icoPath}`);
    
    // Clean up temporary PNG if you want, or keep it
    // fs.unlinkSync(pngPath);
  } catch (err) {
    console.error('Error during conversion:', err);
  }
}

convert();
