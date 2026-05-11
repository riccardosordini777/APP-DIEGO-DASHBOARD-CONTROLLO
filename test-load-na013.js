import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('Carica NA013 e verifica PV estratti', async ({ page }) => {
  await page.goto('http://localhost:5179/');
  await page.waitForTimeout(2000);
  
  // Upload file
  const filePath = 'C:/Users/richi/Downloads/NA013 Incassi.xlsx';
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  
  // Attendi parsing
  await page.waitForTimeout(5000);
  
  // Verifica che il GlobalFilterBar sia visibile
  const filterBar = page.locator('[class*="GlobalFilter"], [class*="filter"]').first();
  const isVisible = await filterBar.isVisible().catch(() => false);
  console.log(`GlobalFilterBar visibile: ${isVisible}`);
  
  // Verifica content
  const content = await page.content();
  const hasPV = content.includes('TERNI') || content.includes('069');
  console.log(`Contiene TERNI/069: ${hasPV}`);
  
  if (hasPV) {
    console.log('✓ File caricato correttamente');
  } else {
    console.log('✗ File non caricato bene');
  }
});
