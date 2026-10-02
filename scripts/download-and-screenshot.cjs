/**
 * download-and-screenshot.cjs
 * Downloads PDF + DOCX for Cleo, Cruz, Dale
 * Opens them with qlmanage (Quick Look) and screenshots
 */

'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { chromium } = require('/Users/3rdshift/openclaw-backup/state/workspace/screenshots/worker-categories-v5/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');

const OUT = path.join(__dirname, '../screenshots/output-purity');
const DL = path.join(OUT, 'downloads');
fs.mkdirSync(DL, { recursive: true });

// Task IDs — use the clean post-deploy tasks
const TASKS = {
  cleo: '82c94d12-2397-4fc1-94d3-e477018a3d99',  // Maria Hernandez / Linear
  cruz: 'd15a2c08-90ec-4437-b7fb-13c45d2c6627',  // Productized content retainer
  dale: '64d9326d-4a39-4c6c-aa7f-fc5a51301bbb',  // Hiring Head of Growth
};

async function login(page) {
  await page.goto('https://3rdshift.ai/login');
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', 'test-roger@3rdshift.ai');
  await page.fill('input[type="password"]', '<SCREENSHOT_TEST_PASSWORD>');
  await page.locator('button').nth(1).click();
  await page.waitForTimeout(5000);
  console.log('  Logged in:', page.url().includes('dashboard') ? 'OK' : 'FAILED');
}

async function downloadFormat(page, taskId, format, filename) {
  await page.goto(`https://3rdshift.ai/dashboard/tasks/result?taskId=${taskId}`);
  await page.waitForTimeout(5000);

  const dlPath = path.join(DL, filename);

  // The Download button is a dropdown — click it to open menu
  const downloadBtn = page.locator('button:has-text("Download")').first();
  const btnCount = await downloadBtn.count();
  if (!btnCount) {
    console.log(`  ⚠️  No Download button found for ${filename}`);
    return null;
  }

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    (async () => {
      await downloadBtn.click();
      await page.waitForTimeout(600);
      
      // Look for the format option in the dropdown
      const formatText = format === 'pdf' ? 'PDF' : 'Word';
      const option = page.locator(`text=/${formatText}/i`).last();
      const count = await option.count();
      if (count > 0) {
        await option.click();
      } else {
        // Some workers have a single download button without dropdown
        // Try direct download button
        const directBtn = page.locator(`button:has-text("${formatText}")`).first();
        await directBtn.click().catch(() => {});
      }
    })(),
  ]).catch(e => {
    console.log(`  ⚠️  Download event missed for ${filename}: ${e.message.slice(0, 60)}`);
    return [null];
  });

  if (download) {
    await download.saveAs(dlPath);
    const size = fs.statSync(dlPath).size;
    console.log(`  ✅ Downloaded ${filename} (${size} bytes)`);
    
    // Verify magic bytes
    const buf = fs.readFileSync(dlPath);
    const magic = buf.slice(0, 4).toString('hex');
    if (format === 'pdf' && !magic.startsWith('25504446')) {
      console.log(`  ⚠️  PDF magic bytes wrong: ${magic} (expected 25504446)`);
    } else if (format === 'docx' && magic !== '504b0304') {
      console.log(`  ⚠️  DOCX magic bytes wrong: ${magic} (expected 504b0304)`);
    } else {
      console.log(`  ✅ File format valid (magic: ${magic})`);
    }
    return dlPath;
  }
  return null;
}

async function screenshotFileContents(filePath, outPath, format) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log(`  ⚠️  Cannot screenshot — file not found: ${filePath}`);
    return false;
  }

  if (format === 'pdf') {
    // Use qlmanage to render PDF page 1 to PNG
    const result = spawnSync('qlmanage', ['-t', '-s', '1400', '-o', path.dirname(outPath), filePath], {
      timeout: 15000, encoding: 'utf8'
    });
    
    // qlmanage creates <filename>.qlpreview/Quick_Look_Preview.png or similar
    const basename = path.basename(filePath);
    const previewDir = path.join(path.dirname(outPath), basename + '.qlpreview');
    
    if (fs.existsSync(previewDir)) {
      const files = fs.readdirSync(previewDir);
      if (files.length > 0) {
        const previewFile = path.join(previewDir, files[0]);
        fs.copyFileSync(previewFile, outPath);
        console.log(`  ✅ PDF screenshot: ${outPath}`);
        return true;
      }
    }
    
    // Try alternate approach: automator / screencapture after opening in Preview
    try {
      // Open in Preview, wait, screenshot
      execSync(`open -a Preview "${filePath}"`);
      await new Promise(r => setTimeout(r, 3000));
      execSync(`screencapture -l $(osascript -e 'tell app "Preview" to id of window 1') "${outPath}"`);
      execSync(`osascript -e 'tell application "Preview" to close window 1'`);
      if (fs.existsSync(outPath)) {
        console.log(`  ✅ PDF screenshot via Preview: ${outPath}`);
        return true;
      }
    } catch(e) {
      console.log(`  ⚠️  Preview screenshot failed: ${e.message.slice(0, 80)}`);
    }
    
    // Last resort: use pandoc to convert PDF text to verify content
    try {
      const text = execSync(`pdftotext "${filePath}" - 2>/dev/null || pandoc "${filePath}" -t plain 2>/dev/null || echo "CANNOT_READ"`, { encoding: 'utf8', timeout: 10000 });
      fs.writeFileSync(outPath.replace('.png', '-content.txt'), text);
      console.log(`  ✅ PDF content extracted to text (${text.length} chars)`);
      return true;
    } catch(e) {}
    
  } else if (format === 'docx') {
    // Use pandoc to extract text content from DOCX
    try {
      const text = execSync(`pandoc "${filePath}" -t plain 2>/dev/null`, { encoding: 'utf8', timeout: 10000 });
      const contentFile = outPath.replace('.png', '-content.txt');
      fs.writeFileSync(contentFile, text);
      console.log(`  ✅ DOCX content extracted (${text.length} chars)`);
      
      // Check for pollution in DOCX text
      const POLLUTION = [
        ['word count', /^\*{0,2}word count:\s*\d+/im],
        ['keep going', /keep going with (the )?team/i],
        ['click a name', /click a name above/i],
        ['handoff header', /### ⚡/],
        ['## Sources', /\n## sources\n/i],
        ['character count', /character count:\s*\d+/i],
      ];
      const hits = POLLUTION.filter(([,p]) => p.test(text)).map(([n]) => n);
      if (hits.length) {
        console.log(`  ❌ DOCX POLLUTION FOUND: ${hits.join(', ')}`);
      } else {
        console.log(`  ✅ DOCX content CLEAN — no pollution`);
      }
      console.log(`  DOCX first 300: ${text.slice(0, 300).replace(/\n/g, ' ')}`);
      console.log(`  DOCX last 200:  ${text.slice(-200).replace(/\n/g, ' ')}`);
      return true;
    } catch(e) {
      console.log(`  ⚠️  pandoc failed: ${e.message.slice(0, 80)}`);
    }
  }
  return false;
}

async function main() {
  console.log('=== Test A: PDF + DOCX Download Integrity ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await login(page);

  const results = {};

  for (const [name, taskId] of Object.entries(TASKS)) {
    console.log(`\n── ${name.toUpperCase()} (${taskId.slice(0,8)}) ──`);
    results[name] = { pdf: {}, docx: {} };

    // PDF
    console.log('\n  Downloading PDF...');
    const pdfPath = await downloadFormat(page, taskId, 'pdf', `${name}.pdf`);
    if (pdfPath) {
      results[name].pdf.downloaded = true;
      results[name].pdf.size = fs.statSync(pdfPath).size;
      await screenshotFileContents(pdfPath, path.join(OUT, `TA-${name}-pdf.png`), 'pdf');
    } else {
      results[name].pdf.downloaded = false;
    }

    // DOCX
    console.log('\n  Downloading DOCX...');
    const docxPath = await downloadFormat(page, taskId, 'docx', `${name}.docx`);
    if (docxPath) {
      results[name].docx.downloaded = true;
      results[name].docx.size = fs.statSync(docxPath).size;
      await screenshotFileContents(docxPath, path.join(OUT, `TA-${name}-docx.png`), 'docx');
    } else {
      results[name].docx.downloaded = false;
    }
  }

  await browser.close();

  console.log('\n\n══ SUMMARY ══');
  for (const [name, r] of Object.entries(results)) {
    const pdfOk = r.pdf.downloaded ? `✅ ${r.pdf.size}b` : '❌ failed';
    const docxOk = r.docx.downloaded ? `✅ ${r.docx.size}b` : '❌ failed';
    console.log(`${name}: PDF=${pdfOk} | DOCX=${docxOk}`);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
