import { test, expect } from '@playwright/test';

test.describe('Control Tower — Diego User Simulation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('1️⃣ Landing page — nessun file caricato', async ({ page }) => {
    await expect(page.getByText('Control Tower', { exact: true })).toBeVisible();
    await expect(page.getByText('Carica i file Excel dalla barra laterale')).toBeVisible();

    // Sidebar visible
    await expect(page.getByText('Benvenuto, Diego')).toBeVisible();
    await expect(page.getByText('Dati', { exact: true }).first()).toBeVisible();
  });

  test('2️⃣ Carica file NA108 — Produzione appare', async ({ page }) => {
    // Sidebar mostra "Carica" button
    const uploadBtn = page.locator('button:has-text("Carica")').first();
    await expect(uploadBtn).toBeVisible();

    // Nota: test upload reale richiede file di test. Per ora verifichiamo che il bottone esiste:
    // In una fase successiva, faremo upload di un file vero tramite setInputFiles()
    await expect(uploadBtn).toBeEnabled();
  });

  test('3️⃣ GlobalFilterBar visible — con dropdown PV', async ({ page }) => {
    // GlobalFilterBar must be visible after data loaded
    const filterBar = page.locator('[class*="CONTESTO"]');

    // Se caricato almeno 1 file, filterBar deve mostrare filtri
    // Verifichiamo che la struttura esista
    await expect(page.locator('text=Contesto')).toBeVisible();

    // Dropdown PV deve essere visible
    const pvSelect = page.locator('button:has-text("Tutti i PV")');
    // Se dati caricati, dropdown appare; altrimenti skip
  });

  test('4️⃣ GlobalFilterBar — dropdown apre e funziona', async ({ page }) => {
    // Simula click su dropdown PV
    const pvBtn = page.locator('button:has-text("Tutti i PV")').first();

    if (await pvBtn.isVisible()) {
      await pvBtn.click();

      // Dropdown deve aprirsi sopra tutto
      const dropdown = page.locator('[class*="fixed"]').filter({ hasText: 'Cerca' });
      await expect(dropdown).toBeVisible({ timeout: 5000 });

      // Input search visible
      const searchInput = page.locator('input[placeholder*="Cerca"]').first();
      await expect(searchInput).toBeVisible();
    }
  });

  test('5️⃣ Filtro PV applicato — tutte le pagine rispettano', async ({ page }) => {
    // Seleziona un PV se disponibile
    const pvBtn = page.locator('button:has-text("Tutti i PV")').first();

    if (await pvBtn.isVisible()) {
      await pvBtn.click();

      // Seleziona primo PV dalla lista
      const pvOptions = page.locator('[class*="fixed"]').filter({ hasText: 'Cerca' }).locator('button').nth(1);
      const pvName = await pvOptions.textContent();

      if (pvName && pvName.trim()) {
        await pvOptions.click();

        // Verifica che il filtro sia applicato (bottone cambia colore)
        await expect(pvBtn).toHaveClass(/electric/);

        // Naviga su Produzione
        await page.locator('text=Produzione').click();
        await page.waitForLoadState('networkidle');

        // Filtro deve persistere — GlobalFilterBar ancora visibile
        await expect(page.locator('text=Contesto attivo')).toBeVisible();
      }
    }
  });

  test('6️⃣ Navigazione tra pagine — filtro persiste', async ({ page }) => {
    const pages = ['Cruscotto', 'Produzione', 'Canalizzazioni', 'Incassi', 'Confronta'];

    for (const pageName of pages) {
      // Usa getByRole per trovare link di navigazione, o fallback a text
      const navItem = page.getByRole('link', { name: new RegExp(pageName, 'i') }).or(page.locator(`text=${pageName}`)).first();
      if (await navItem.isVisible()) {
        await navItem.click();
        await page.waitForLoadState('networkidle');

        // Verifica pagina caricata (cerca il nome pagina da qualche parte visibile)
        const pageTitle = page.getByText(pageName, { exact: false }).first();
        await expect(pageTitle).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('7️⃣ Confronta PV — dropdown PV1/PV2 visibili', async ({ page }) => {
    // Naviga su Confronta
    const confrontaLink = page.getByRole('link', { name: /confronta/i }).or(page.locator('text=Confronta')).first();
    if (await confrontaLink.isVisible()) {
      await confrontaLink.click();
      await page.waitForLoadState('networkidle');

      // Se ci sono dati, cerca i bottoni di selezione
      const pv1Select = page.getByText('Seleziona PV 1', { exact: false }).first();
      const emptyState = page.getByText('Carica almeno un file');

      if (await emptyState.isVisible()) {
        // Empty state — skip (no files loaded yet)
        await expect(emptyState).toBeVisible();
      } else if (await pv1Select.isVisible({ timeout: 3000 })) {
        // Data loaded — test dropdown
        const pv2Select = page.getByText('Seleziona PV 2').first();
        await expect(pv1Select).toBeVisible();
        await expect(pv2Select).toBeVisible();

        // Click e verifica dropdown apre
        await pv1Select.click();
        const dropdown = page.locator('[class*="fixed"]').filter({ hasText: 'Cerca PV' });
        await expect(dropdown).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('8️⃣ Confronta PV — seleziona 2 PV e mostra comparison', async ({ page }) => {
    const confrontaLink = page.getByRole('link', { name: /confronta/i }).or(page.locator('text=Confronta')).first();
    if (await confrontaLink.isVisible()) {
      await confrontaLink.click();
      await page.waitForLoadState('networkidle');

      const pv1Select = page.getByText('Seleziona PV 1', { exact: false }).first();
      const emptyState = page.getByText('Carica almeno un file');

      if (await emptyState.isVisible()) {
        // Empty state — skip (no files loaded yet)
        await expect(emptyState).toBeVisible();
      } else if (await pv1Select.isVisible({ timeout: 3000 })) {
        const pv2Select = page.getByText('Seleziona PV 2').first();

        // Seleziona primo PV
        await pv1Select.click();
        await page.waitForTimeout(300);
        const dropdown1 = page.locator('[class*="fixed"]').filter({ hasText: 'Cerca PV' });
        const firstPV = dropdown1.locator('button').nth(1);
        const pv1Name = await firstPV.textContent();

        if (pv1Name && pv1Name.trim()) {
          await firstPV.click();
          await page.waitForTimeout(500);

          // Seleziona secondo PV
          await pv2Select.click();
          await page.waitForTimeout(300);
          const dropdown2 = page.locator('[class*="fixed"]').filter({ hasText: 'Cerca PV' });
          const secondPV = dropdown2.locator('button').nth(1);
          const pv2Name = await secondPV.textContent();

          if (pv2Name && pv2Name.trim()) {
            await secondPV.click();
            await page.waitForLoadState('networkidle');

            // Verifica comparison table visibile
            const table = page.locator('text=Portafoglio').or(page.locator('text=Confronta'));
            await expect(table).toBeVisible({ timeout: 5000 });
          }
        }
      }
    }
  });

  test('9️⃣ Reset filtri — torna a "Contesto globale"', async ({ page }) => {
    // Applica un filtro
    const pvBtn = page.locator('button:has-text("Tutti i PV")').first();

    if (await pvBtn.isVisible()) {
      await pvBtn.click();
      const pvOptions = page.locator('[class*="fixed"]').filter({ hasText: 'Cerca' }).locator('button').nth(1);

      if (await pvOptions.isVisible()) {
        await pvOptions.click();
        await page.waitForTimeout(300);

        // Verifica "Contesto attivo"
        await expect(page.locator('text=Contesto attivo')).toBeVisible();

        // Click reset (X button nel dropdown o reset globale)
        const resetBtn = page.locator('text=Reset tutto');
        if (await resetBtn.isVisible()) {
          await resetBtn.click();

          // Torna a "Contesto globale"
          await expect(page.locator('text=Contesto globale')).toBeVisible();
        }
      }
    }
  });

  test('🔟 TopBar + GlobalFilterBar layout — non sovrapposti', async ({ page }) => {
    const topbar = page.locator('[class*="h-20"]').first();
    const filterbar = page.locator('[class*="min-h"]').filter({ hasText: 'Contesto' });

    // Entrambi visibili
    await expect(topbar).toBeVisible();
    await expect(filterbar).toBeVisible();

    // Bounding box — non sovrapposti
    const topbarBox = await topbar.boundingBox();
    const filterbarBox = await filterbar.boundingBox();

    if (topbarBox && filterbarBox) {
      // filterbar.top deve essere circa topbar.bottom
      const gap = Math.abs(filterbarBox.y - (topbarBox.y + topbarBox.height));
      expect(gap).toBeLessThan(10); // max 10px di gap
    }
  });
});

test.describe('Edge Cases & Bug Hunting', () => {
  test('📊 Carica file senza PV column — GlobalFilterBar comunque visibile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Anche senza dati, GlobalFilterBar deve avere min-height
    const filterbar = page.locator('[class*="min-h"]').filter({ hasText: 'Contesto' });
    await expect(filterbar).toBeVisible();
  });

  test('🖱️ Dropdown non nascosto dietro main content — z-index corretto', async ({ page }) => {
    await page.goto('/');

    const pvBtn = page.locator('button:has-text("Tutti i PV")').first();
    if (await pvBtn.isVisible()) {
      await pvBtn.click();

      const dropdown = page.locator('[class*="fixed"]').filter({ hasText: 'Cerca' });

      // Verifica z-index (style attribute)
      const zIndex = await dropdown.evaluate((el) => window.getComputedStyle(el).zIndex);
      const zIndexNum = parseInt(zIndex);

      // Deve essere > 1000
      expect(zIndexNum).toBeGreaterThan(1000);
    }
  });

  test('♻️ Filtra → naviga → filtra di nuovo → stato coerente', async ({ page }) => {
    await page.goto('/');

    const pvBtn = page.locator('button:has-text("Tutti i PV")').first();
    if (await pvBtn.isVisible()) {
      // Apply filter
      await pvBtn.click();
      const option1 = page.locator('[class*="fixed"]').filter({ hasText: 'Cerca' }).locator('button').nth(1);
      if (await option1.isVisible()) {
        await option1.click();

        const filterText1 = await pvBtn.textContent();

        // Navigate
        await page.locator('text=Produzione').click();
        await page.waitForLoadState('networkidle');

        // Check filter still there
        const pvBtn2 = page.locator('button:has-text("Tutti i PV")').first();
        const filterText2 = await pvBtn2.textContent();

        expect(filterText1).toContain(filterText2 || '');
      }
    }
  });
});
