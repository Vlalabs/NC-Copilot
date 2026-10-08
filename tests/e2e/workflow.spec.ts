import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function scenario(page: Page, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Demo case library' }).click();
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: 'Confirm this type' }).click();
  await page.getByRole('button', { name: 'Review & declare NC' }).first().click();
  await page.getByRole('button', { name: 'Declare NC', exact: true }).click();
  await page.getByRole('button', { name: 'Assess the case', exact: true }).first().click();
}
async function approve(page: Page, reason: string) {
  await page.getByRole('button', { name: 'Review disposition', exact: true }).first().click();
  await page.getByLabel('Decision rationale').fill(reason);
  await page.getByLabel('I have reviewed the case and the simulated reference.').check();
  await page.getByRole('button', { name: 'Confirm disposition' }).click();
}

test('welcome screen, workflow gates and keyboard-accessible source references', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Something doesn’t look right/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review & declare NC' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Assess & decide/ })).toBeDisabled();
  await page.screenshot({ path: 'test-results/welcome-desktop.png', fullPage: true });
  await page.getByRole('tab', { name: 'Sources' }).click();
  await expect(page.getByText('No external systems are connected.')).toBeVisible();
  await page.getByRole('tab', { name: 'Sources' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'History' })).toBeFocused();
  await page.getByRole('button', { name: 'Source systems', exact: true }).click();
  await page.getByRole('button', { name: /DR-SIM-021/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Depth ≤ 0.05 mm AND length ≤ 30 mm');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('conversation to declaration, repair, failed and passed inspection, closure, persistence and export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('Message your copilot').fill('A 28 mm scratch on the left-wing aluminium bracket, A320 MSN 12084, PN SUP-7341. Depth: 0.08 mm.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('28', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm this type' }).click();
  await page.getByRole('button', { name: 'Review & declare NC' }).first().click();
  await page.getByRole('button', { name: 'Declare NC', exact: true }).click();
  await page.getByRole('button', { name: 'Assess the case', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Repair is possible' })).toBeVisible();
  await page.getByRole('button', { name: /DR-SIM-021/ }).first().click();
  await expect(page.getByRole('dialog')).toContainText('RI-SIM-014');
  await page.getByRole('button', { name: 'Back to the case' }).click();
  await page.screenshot({ path: 'test-results/assessment-desktop.png', fullPage: true });
  await approve(page, 'Repair within DR-SIM-021 envelope, following RI-SIM-014.');
  await expect(page.getByRole('button', { name: 'Record inspection' })).toBeDisabled();
  await page.getByRole('button', { name: 'Mark complete' }).first().click();
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.getByRole('button', { name: 'Record inspection' }).click();
  await page.getByLabel('Length (mm)', { exact: true }).fill('28');
  await page.getByLabel('Depth (mm)', { exact: true }).fill('0.08');
  await page.getByLabel('Inspection reference & result').fill('INS-DEMO-004 — final inspection');
  await page.getByRole('button', { name: 'Record final inspection' }).click();
  await expect(page.getByRole('alert')).toContainText('do not meet acceptance limits');
  await page.getByLabel('Depth (mm)', { exact: true }).fill('0.03');
  await page.getByRole('button', { name: 'Record final inspection' }).click();
  await page.getByRole('button', { name: 'Close the non-conformance' }).click();
  await page.getByRole('button', { name: 'Confirm closure' }).click();
  await expect(page.getByText('Case resolved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Case resolved.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Message your copilot')).toBeDisabled();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export record', exact: true }).click()]);
  const stream = await download.createReadStream();
  let raw = ''; for await (const chunk of stream!) raw += chunk.toString();
  const exported = JSON.parse(raw);
  expect(exported.closed).toBe(true); expect(exported.simulation).toBe(true);
  expect(exported.tasks.every((t: { done: boolean }) => t.done)).toBe(true);
  expect(exported.finalCheck).toContain('0.03');
  expect(exported.audit.at(-1).text).toContain('Case closed');
  expect(errors).toEqual([]);
});

test('dimensional deviation follows its own requirement and final tolerance check', async ({ page }) => {
  await scenario(page, 'An out-of-tolerance bore');
  await expect(page.getByRole('button', { name: /DR-SIM-034/ }).first()).toBeVisible();
  await approve(page, 'Rework to RI-SIM-022, then inspect the bore.');
  await page.getByRole('button', { name: 'Mark complete' }).first().click();
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.getByRole('button', { name: 'Record inspection' }).click();
  await page.getByLabel('Diameter (mm)', { exact: true }).fill('6.32');
  await page.getByLabel('Inspection reference & result').fill('INS-DEMO-006');
  await page.getByRole('button', { name: 'Record final inspection' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Diameter (mm)', { exact: true }).fill('6.02');
  await page.getByRole('button', { name: 'Record final inspection' }).click();
  await expect(page.getByRole('button', { name: 'Close the non-conformance' })).toBeVisible();
});

test('suspected crack routes to engineering, records its opinion and resolves through replacement', async ({ page }) => {
  await scenario(page, 'A suspected crack');
  await expect(page.getByRole('heading', { name: 'Engineering review needed' })).toBeVisible();
  await approve(page, 'Request engineering assessment: no applicable demo criterion.');
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.getByRole('button', { name: 'Record opinion' }).click();
  await page.getByLabel('Engineering opinion reference').fill('ENG-DEMO-008');
  await page.getByLabel('Engineering rationale').fill('Replace the affected panel after confirming the defect.');
  await page.getByRole('button', { name: 'Record opinion & disposition' }).click();
  await expect(page.getByRole('heading', { name: 'Replace', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark complete' }).first().click();
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.getByRole('button', { name: 'Record inspection' }).click();
  await page.getByLabel('Inspection reference & result').fill('INS-DEMO-008 — replacement panel conforming, trace recorded.');
  await page.getByRole('button', { name: 'Record final inspection' }).click();
  await page.getByRole('button', { name: 'Close the non-conformance' }).click();
  await page.getByRole('button', { name: 'Confirm closure' }).click();
  await page.reload();
  await expect(page.getByText('Case resolved.', { exact: true })).toBeVisible();
});

test('editing declared measurements invalidates old assessment and rejects negative input', async ({ page }) => {
  await scenario(page, 'A scratch on a bracket');
  await page.getByRole('button', { name: 'Edit Depth (mm)' }).click();
  await page.getByLabel('Depth (mm)', { exact: true }).fill('-1');
  await page.getByRole('button', { name: 'Save & confirm' }).click();
  await expect(page.getByRole('alert')).toContainText('zero or greater');
  await page.getByLabel('Depth (mm)', { exact: true }).fill('0.2');
  await page.getByRole('button', { name: 'Save & confirm' }).click();
  await expect(page.getByRole('button', { name: /Assess & decide/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Review & declare NC' }).first().click();
  await page.getByRole('button', { name: 'Declare NC', exact: true }).click();
  await page.getByRole('button', { name: 'Assess the case', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Outside the repair envelope' })).toBeVisible();
});

test('photo evidence can be annotated, exported and survives reload as metadata', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'defect.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ3sAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('region', { name: 'Case conversation' }).getByRole('button', { name: 'defect.png', exact: true }).click();
  await page.getByRole('button', { name: 'Mark defect on photo' }).click();
  await expect(page.getByRole('dialog')).toContainText('Photo marker:');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nc-copilot-demo-v1')!));
  expect(saved.attachments[0].point).toBeTruthy(); expect(saved.attachments[0].url).toBeUndefined();
  await page.reload();
  await page.getByRole('button', { name: /defect.png/ }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Preview unavailable in this session');
  await expect(page.getByRole('dialog')).toContainText('Photo marker:');
});

test('mobile layout fits the viewport and the aircraft map can start a case', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/welcome-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Locate the defect' }).click();
  await page.getByRole('button', { name: 'Right wing', exact: true }).last().click();
  await expect(page.getByText('Right wing', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
