const sharp = require('sharp');
const fs = require('fs');

const headlineText = 'QUIT YOUR JOB';
const words = headlineText.split(/\s+/).filter(Boolean).slice(0, 8);
const mid = Math.ceil(words.length / 2);
const line1 = words.slice(0, mid).join(' ');
const line2 = words.slice(mid).join(' ');
const longestLine = line1.length >= line2.length ? line1 : line2;
const rawFontSize = Math.floor((1280 * 0.85) / Math.max(longestLine.length, 1) / 0.55);
const fontSize = Math.max(80, Math.min(160, rawFontSize));
const lineHeightPx = Math.floor(fontSize * 1.15);
const strokeW = Math.max(6, Math.floor(fontSize * 0.06));
const twoLines = line2.length > 0;
const l1Y = 700 - (twoLines ? lineHeightPx + 8 : 0);
const l2Y = 700;
const gradTop = Math.max(0, l1Y - 60);
const line2Words2 = line2.split(' ');
const line2Main = line2Words2.length > 1 ? line2Words2.slice(0, -1).join(' ') + ' ' : '';
const line2Accent = line2Words2[line2Words2.length - 1] || '';
function escXml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

console.log('line1:', line1, '| line2:', line2, '| fontSize:', fontSize, 'strokeW:', strokeW);

const svg = `<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0"/>
      <stop offset="40%" stop-color="black" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.88"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="50%" r="70%">
      <stop offset="50%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.45"/>
    </radialGradient>
  </defs>
  <rect x="0" y="${gradTop}" width="1280" height="${720 - gradTop}" fill="url(#grad)"/>
  <rect x="0" y="0" width="1280" height="720" fill="url(#vig)"/>
  <text x="640" y="${l1Y}" text-anchor="middle" dominant-baseline="auto"
    font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="${fontSize}"
    fill="white" stroke="black" stroke-width="${strokeW}" stroke-linejoin="round" paint-order="stroke fill"
  >${escXml(line1)}</text>
  ${twoLines ? `<text x="640" y="${l2Y}" text-anchor="middle" dominant-baseline="auto"
    font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="${fontSize}"
    fill="white" stroke="black" stroke-width="${strokeW}" stroke-linejoin="round" paint-order="stroke fill"
  >${escXml(line2Main)}<tspan fill="#FF3300">${escXml(line2Accent)}</tspan></text>` : ''}
</svg>`;

async function test() {
  // Test on a dark photo-like background
  const bg = await sharp({ create: { width: 1280, height: 720, channels: 3, background: {r:30,g:40,b:80} } }).png().toBuffer();
  const overlayBuf = await sharp(Buffer.from(svg)).png().toBuffer();
  const out = await sharp(bg).composite([{ input: overlayBuf, blend: 'over' }]).png().toBuffer();
  fs.writeFileSync('/tmp/reed-svg-text-test.png', out);
  console.log('Saved /tmp/reed-svg-text-test.png');
  
  // Also test on the Kontext face image from earlier
  const faceUrl = 'https://v3b.fal.media/files/b/0a944d86/9v9ZGD8-DtMnBW71PrQsn_061edad4ecf54ef1bba6fc9713ece305.jpg';
  try {
    const res = await fetch(faceUrl);
    const imgBuf = Buffer.from(await res.arrayBuffer());
    const out2 = await sharp(imgBuf)
      .resize(1280, 720, { fit: 'cover' })
      .composite([{ input: overlayBuf, blend: 'over' }])
      .modulate({ saturation: 1.08 })
      .sharpen({ sigma: 0.6 })
      .png().toBuffer();
    fs.writeFileSync('/tmp/reed-test2-sample.png', out2);
    console.log('Saved /tmp/reed-test2-sample.png');
  } catch(e) {
    console.log('Face URL fetch failed (expired):', e.message);
  }
}
test().catch(e => console.error('FAIL:', e.message, e.stack));
