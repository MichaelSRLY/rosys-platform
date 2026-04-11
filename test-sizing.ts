/**
 * Playwright stress test for the deployed sizing flow.
 * Tests the full journey: login → sizing → pattern → measurements → results → preferences → lock → downloads
 *
 * Run: npx playwright test test-sizing.ts --headed
 * Or:  npx tsx test-sizing.ts (standalone mode)
 */

import { chromium, type Page, type Browser } from 'playwright';

const BASE = 'https://platform-rosys.vercel.app';
const EMAIL = 'michael@willowwisp.io';
const PASSWORD = 'Sebas123!';

// Test measurements
const TESTS = [
  { name: 'Hourglass (90/60/90/169)', bust: '90', waist: '60', hip: '90', height: '169' },
  { name: 'Standard M (88/72/96/168)', bust: '88', waist: '72', hip: '96', height: '168' },
  { name: 'Plus (110/96/116/165)', bust: '110', waist: '96', hip: '116', height: '165' },
];

let browser: Browser;
let page: Page;
const errors: string[] = [];
const warnings: string[] = [];
const successes: string[] = [];

function log(emoji: string, msg: string) {
  console.log(`${emoji} ${msg}`);
}

function pass(msg: string) { successes.push(msg); log('✅', msg); }
function warn(msg: string) { warnings.push(msg); log('⚠️', msg); }
function fail(msg: string) { errors.push(msg); log('❌', msg); }

async function screenshot(name: string) {
  await page.screenshot({ path: `/tmp/sizing-test-${name}-${Date.now()}.png`, fullPage: true });
}

async function waitForText(text: string, timeout = 15000): Promise<boolean> {
  try {
    await page.waitForSelector(`text=${text}`, { timeout });
    return true;
  } catch {
    return false;
  }
}

async function login() {
  log('🔑', 'Logging in...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check if already logged in
  if (page.url().includes('/login') || await page.isVisible('input[type="email"]')) {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    if (page.url().includes('/login')) {
      fail('Login failed — still on login page');
      await screenshot('login-failed');
      return false;
    }
    pass('Logged in successfully');
  } else {
    pass('Already logged in');
  }
  return true;
}

async function testSizingPicker() {
  log('📋', 'Testing sizing pattern picker...');
  await page.goto(`${BASE}/sizing`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await page.textContent('h1');
  if (title?.includes('Find Your Size')) {
    pass('Sizing picker loaded');
  } else {
    fail(`Sizing picker title wrong: "${title}"`);
    await screenshot('picker-wrong');
    return false;
  }

  // Count pattern cards
  const links = await page.$$('a[href*="/sizing"]');
  if (links.length > 0) {
    pass(`Found ${links.length} patterns with size charts`);
  } else {
    fail('No pattern cards found');
    await screenshot('no-patterns');
    return false;
  }

  return true;
}

async function testFullSizingFlow(patternSlug: string, measurements: typeof TESTS[0]) {
  log('👗', `\nTesting: ${measurements.name} on ${patternSlug}`);

  // Navigate to sizing page
  await page.goto(`${BASE}/patterns/${patternSlug}/sizing`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check entry screen or measurements screen (auto-skips if saved profile)
  const onEntry = await waitForText('Find Your', 3000);
  const onMeasurements = await waitForText('Your Measurements', 3000);

  if (onEntry) {
    pass('Entry screen loaded');
    const measureBtn = await page.$('button:has-text("Measure yourself")');
    if (measureBtn) {
      await measureBtn.click();
      await page.waitForTimeout(500);
      pass('Clicked "Measure yourself"');
    }
  } else if (onMeasurements) {
    pass('Measurements screen loaded (saved profile auto-skipped entry)');
  } else {
    fail('Neither entry nor measurements screen found');
    await screenshot(`entry-fail-${patternSlug}`);
    return;
  }

  // Fill measurements
  await page.waitForSelector('#bust', { timeout: 5000 });

  // Clear and fill each field
  for (const [id, value] of [['bust', measurements.bust], ['waist', measurements.waist], ['hip', measurements.hip], ['height', measurements.height]]) {
    const input = await page.$(`#${id}`);
    if (input) {
      await input.click({ clickCount: 3 });
      await input.fill(value);
      await page.waitForTimeout(100);
    }
  }

  pass(`Filled measurements: ${measurements.bust}/${measurements.waist}/${measurements.hip}/${measurements.height}`);

  // Check "Analyze my fit" button is enabled
  const analyzeBtn = await page.$('button:has-text("Analyze my fit")');
  if (analyzeBtn) {
    const disabled = await analyzeBtn.getAttribute('disabled');
    if (disabled !== null && disabled !== '') {
      fail('Analyze button is disabled despite measurements filled');
      await screenshot(`analyze-disabled-${patternSlug}`);
      return;
    }
  }

  // Click analyze
  await page.click('button:has-text("Analyze my fit")');
  log('⏳', 'Analyzing...');

  // Wait for analyzing screen — should see steps
  if (await waitForText('Comparing against size chart', 10000)) {
    pass('Analyzing screen: step 1 visible');
  } else {
    warn('Step 1 text not found on analyzing screen');
  }

  // Wait for results (the AI streaming takes 5-15 seconds)
  const gotResults = await page.waitForSelector('.size-badge, .size-hero, [class*="badge"]', { timeout: 30000 }).catch(() => null);

  // Also wait for phase to be results
  await page.waitForTimeout(3000);

  // Check for size recommendation
  const pageText = await page.textContent('body');

  // Check for errors
  if (pageText?.includes('AI error') || pageText?.includes('Something went wrong') || pageText?.includes('Connection failed')) {
    const errorText = pageText.match(/(AI error[^\n]*|Something went wrong[^\n]*|Connection failed[^\n]*)/)?.[1];
    fail(`Error on results: ${errorText}`);
    await screenshot(`error-${patternSlug}`);
    return;
  }

  // Check for size badge
  const sizeRegex = /\b(XXS|XS|S|M|L|XL|2XL|XXL)\b/;
  if (pageText && sizeRegex.test(pageText)) {
    pass('Size recommendation visible');
  } else {
    warn('Could not verify size recommendation text');
    await screenshot(`no-size-${patternSlug}`);
  }

  // Check for fit cards
  if (pageText?.includes('exact') || pageText?.includes('loose') || pageText?.includes('comfortable') || pageText?.includes('tight')) {
    pass('Fit analysis tags visible');
  } else {
    warn('Fit tags not found');
  }

  // Check for narrative sections (Why this size, etc)
  if (pageText?.includes('Why this size') || pageText?.includes('why this size')) {
    pass('AI narrative "Why this size" section present');
  } else {
    warn('"Why this size" section not found');
  }

  if (pageText?.includes('Adjustments') || pageText?.includes('adjustments')) {
    pass('Adjustments section present');
  } else {
    warn('Adjustments section not found');
  }

  await screenshot(`results-${patternSlug}`);

  // Test fine-tune preferences
  log('🔧', 'Testing fine-tune preferences...');
  const fineTuneBtn = await page.$('button:has-text("Fine-tune")');
  if (fineTuneBtn) {
    await fineTuneBtn.click();
    await page.waitForTimeout(500);

    // Click "Fitted & close"
    const fittedBtn = await page.$('button:has-text("Fitted & close")');
    if (fittedBtn) {
      await fittedBtn.click();
      pass('Selected "Fitted & close" preference');
    }

    // Click "Woven (no stretch)"
    const wovenBtn = await page.$('button:has-text("Woven")');
    if (wovenBtn) {
      await wovenBtn.click();
      pass('Selected "Woven" fabric');
    }

    // Click update
    const updateBtn = await page.$('button:has-text("Update recommendation")');
    if (updateBtn) {
      await updateBtn.click();
      log('⏳', 'Updating recommendation...');

      // Wait for overlay to appear and disappear
      await page.waitForTimeout(2000);

      // Wait for refining to complete (overlay disappears)
      await page.waitForSelector('.refine-overlay', { state: 'hidden', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1000);

      const updatedText = await page.textContent('body');
      if (updatedText?.includes('Updated') || updatedText?.includes('Still Size') || updatedText?.includes('suggest Size')) {
        pass('Refined recommendation visible');
      } else {
        warn('Could not verify refined recommendation');
      }

      await screenshot(`refined-${patternSlug}`);
    }
  } else {
    warn('Fine-tune button not found');
  }

  // Test lock size
  log('🔒', 'Testing lock size...');
  const lockBtn = await page.$('button:has-text("Lock in size")');
  if (lockBtn) {
    await lockBtn.click();
    await page.waitForTimeout(500);

    if (await waitForText('confirmed', 3000) || await waitForText('locked', 3000)) {
      pass('Size locked successfully');
    } else {
      warn('Lock confirmation text not found');
    }

    // Check download buttons
    const dlBtns = await page.$$('a[href*="single-size"]');
    if (dlBtns.length >= 3) {
      pass(`${dlBtns.length} download buttons visible (A0/A4/Letter)`);
    } else {
      warn(`Only ${dlBtns.length} download buttons found`);
    }

    await screenshot(`locked-${patternSlug}`);
  } else {
    warn('Lock button not found');
  }

  // Test expandable panels
  log('📊', 'Testing expandable panels...');

  const finishedBtn = await page.$('button:has-text("Finished garment")');
  if (finishedBtn) {
    await finishedBtn.click();
    await page.waitForTimeout(500);
    const tableVisible = await page.isVisible('table');
    if (tableVisible) {
      pass('Finished measurements table visible');
    } else {
      warn('Finished measurements table not found after click');
    }
  }

  const profileBtn = await page.$('button:has-text("Body profile")');
  if (profileBtn) {
    await profileBtn.click();
    await page.waitForTimeout(500);
    pass('Body profile panel toggled');
  }
}

async function testMultiplePatterns() {
  // Get a few pattern slugs from the picker page
  await page.goto(`${BASE}/sizing`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const links = await page.$$eval('a[href*="/sizing"]', els =>
    els.map(el => el.getAttribute('href')).filter(h => h && h.includes('/patterns/'))
  );

  // Pick first 2 patterns for testing
  const slugs = links.slice(0, 2).map(l => {
    const match = l!.match(/\/patterns\/([^/]+)\//);
    return match ? match[1] : null;
  }).filter(Boolean) as string[];

  log('🎯', `Testing ${slugs.length} patterns: ${slugs.join(', ')}`);

  for (let i = 0; i < slugs.length; i++) {
    const measurements = TESTS[i % TESTS.length];
    await testFullSizingFlow(slugs[i], measurements);
  }
}

async function main() {
  log('🚀', `Starting stress test on ${BASE}\n`);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 }, // iPhone 15 Pro Max
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  page = await context.newPage();

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('404')) {
        warn(`Console error: ${text.substring(0, 200)}`);
      }
    }
  });

  // Capture network failures
  page.on('response', response => {
    if (response.status() >= 500) {
      fail(`Server error ${response.status()} on ${response.url().substring(0, 100)}`);
    }
  });

  try {
    // Login
    if (!await login()) {
      log('💀', 'Cannot proceed without login');
      return;
    }

    // Test picker
    if (!await testSizingPicker()) {
      log('💀', 'Picker failed, cannot continue');
      return;
    }

    // Test full flows
    await testMultiplePatterns();

  } catch (e: any) {
    fail(`Unhandled error: ${e.message}`);
    await screenshot('crash');
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('═'.repeat(60));
  console.log(`✅ Passed: ${successes.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);
  console.log(`❌ Failed: ${errors.length}`);

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    warnings.forEach(w => console.log(`  ⚠️  ${w}`));
  }
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  ❌ ${e}`));
  }

  console.log('\n' + (errors.length === 0 ? '🎉 ALL TESTS PASSED!' : `💥 ${errors.length} FAILURES — fix before Jovi tests!`));
}

main();
