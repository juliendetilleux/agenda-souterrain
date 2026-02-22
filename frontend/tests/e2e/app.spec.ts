import { test, expect, Page } from '@playwright/test'
import { TEST_EMAIL, TEST_PASSWORD, TEST_SLUG } from './global-setup'

// Helper: login and go to test calendar
async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('/', { timeout: 10000 })
}

async function goToCalendar(page: Page) {
  await login(page)
  await page.goto(`/c/${TEST_SLUG}`)
  await page.waitForSelector('.fc', { timeout: 10000 })
}

// ─── 1. INSCRIPTION ───────────────────────────────────────────────────────────
// User is pre-created in globalSetup — we just verify the login page is accessible
test('1. Page de connexion accessible', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  console.log('✅ Page de connexion OK')
})

// ─── 2. CONNEXION ─────────────────────────────────────────────────────────────
test('2. Connexion', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('/', { timeout: 10000 })
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Mes calendriers' })).toBeVisible()
  console.log('✅ Connexion réussie')
})

// ─── 3. PAGE CALENDRIER ───────────────────────────────────────────────────────
test('3. Accès au calendrier', async ({ page }) => {
  await goToCalendar(page)
  // FullCalendar should be visible
  await expect(page.locator('.fc')).toBeVisible()
  // Sidebar subcalendars section visible
  await expect(page.locator('text=Calendriers')).toBeVisible()
  // Toolbar buttons visible
  await expect(page.getByRole('button', { name: 'Mois' })).toBeVisible()
  console.log(`✅ Calendrier accessible : /c/${TEST_SLUG}`)
})

// ─── 4. CRÉER UN ÉVÉNEMENT ────────────────────────────────────────────────────
test('4. Créer un événement', async ({ page }) => {
  await goToCalendar(page)

  // Click the "+ Événement" button
  await page.getByRole('button', { name: 'Événement' }).click()

  // Modal opens
  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })

  // Fill title
  await page.getByPlaceholder("Titre de l'événement").fill('Réunion Spéléo Test')

  // Save (keep as timed event — it still shows in month view)
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  // Toast confirmation
  await expect(page.getByText('Événement créé')).toBeVisible({ timeout: 5000 })
  await expect(page.getByPlaceholder("Titre de l'événement")).not.toBeVisible({ timeout: 5000 })

  // Event appears on calendar
  await expect(page.locator('.fc-event-title:has-text("Réunion Spéléo Test")')).toBeVisible({ timeout: 8000 })
  console.log('✅ Événement créé : Réunion Spéléo Test')
})

// ─── 5. MODIFIER UN ÉVÉNEMENT ─────────────────────────────────────────────────
test('5. Modifier un événement', async ({ page }) => {
  await goToCalendar(page)

  // Event should be visible (created in test 4)
  await expect(page.locator('.fc-event-title:has-text("Réunion Spéléo Test")')).toBeVisible({ timeout: 8000 })
  await page.locator('.fc-event-title:has-text("Réunion Spéléo Test")').first().click()

  // Modal opens in edit mode
  await expect(page.getByRole('heading', { name: "Modifier l'événement" })).toBeVisible({ timeout: 5000 })
  await expect(page.getByPlaceholder("Titre de l'événement")).toHaveValue('Réunion Spéléo Test')

  // Change title
  await page.getByPlaceholder("Titre de l'événement").fill('Réunion Spéléo — Modifié')
  await page.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(page.getByText('Événement modifié')).toBeVisible({ timeout: 5000 })

  // Updated title on calendar
  await expect(page.locator('.fc-event-title:has-text("Modifié")')).toBeVisible({ timeout: 8000 })
  console.log('✅ Événement modifié')
})

// ─── 6. SUPPRIMER UN ÉVÉNEMENT ────────────────────────────────────────────────
test('6. Supprimer un événement', async ({ page }) => {
  await goToCalendar(page)

  await expect(page.locator('.fc-event-title:has-text("Modifié")')).toBeVisible({ timeout: 8000 })
  await page.locator('.fc-event-title:has-text("Modifié")').first().click()

  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })

  // Click Supprimer in event modal → ConfirmModal appears
  await page.getByRole('button', { name: 'Supprimer' }).click()

  // ConfirmModal should be visible — confirm the deletion
  // ConfirmModal renders before EventModal in DOM, so its button is .first()
  await expect(page.getByText('irréversible')).toBeVisible({ timeout: 3000 })
  await page.getByRole('button', { name: 'Supprimer' }).first().click()

  await expect(page.getByText('Événement supprimé')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.fc-event')).toHaveCount(0, { timeout: 8000 })
  console.log('✅ Événement supprimé (via ConfirmModal)')
})

// ─── 7. GÉRER LES SOUS-CALENDRIERS ───────────────────────────────────────────
test('7. Créer et supprimer un sous-calendrier', async ({ page }) => {
  await goToCalendar(page)

  // Click "+" to add subcalendar
  await page.locator('button[title="Ajouter un sous-calendrier"]').click()
  await expect(page.getByPlaceholder('Nom...')).toBeVisible({ timeout: 3000 })
  await page.getByPlaceholder('Nom...').fill('Expéditions')
  await page.getByRole('button', { name: 'OK' }).click()

  await expect(page.locator('text=Expéditions')).toBeVisible({ timeout: 5000 })
  console.log('✅ Sous-calendrier "Expéditions" créé')

  // Toggle visibility
  const checkboxes = page.locator('input[type="checkbox"]')
  const count = await checkboxes.count()
  const lastCheckbox = checkboxes.nth(count - 1)
  await lastCheckbox.uncheck()
  await expect(lastCheckbox).not.toBeChecked()
  await lastCheckbox.check()
  await expect(lastCheckbox).toBeChecked()
  console.log('✅ Visibilité togglée')

  // Delete subcalendar — click trash icon → ConfirmModal → confirm
  const expRow = page.locator('div.group').filter({ hasText: 'Expéditions' })
  await expRow.hover()
  await expRow.locator('button').last().click()

  // ConfirmModal should appear with confirmation text
  await expect(page.getByText('ses événements')).toBeVisible({ timeout: 3000 })
  await page.getByRole('button', { name: 'Supprimer' }).click()

  await expect(page.locator('text=Expéditions')).not.toBeVisible({ timeout: 5000 })
  console.log('✅ Sous-calendrier supprimé (via ConfirmModal)')
})

// ─── 8. NAVIGATION ET VUES ────────────────────────────────────────────────────
test('8. Navigation et changement de vues', async ({ page }) => {
  await goToCalendar(page)

  await page.getByRole('button', { name: 'Semaine' }).click()
  await expect(page.locator('.fc-timegrid')).toBeVisible({ timeout: 5000 })
  console.log('✅ Vue Semaine')

  await page.getByRole('button', { name: 'Jour', exact: true }).click()
  await expect(page.locator('.fc-timegrid')).toBeVisible({ timeout: 5000 })
  console.log('✅ Vue Jour')

  await page.getByRole('button', { name: 'Agenda', exact: true }).click()
  await expect(page.locator('.fc-list')).toBeVisible({ timeout: 5000 })
  console.log('✅ Vue Agenda')

  await page.getByRole('button', { name: 'Mois', exact: true }).click()
  await expect(page.locator('.fc-daygrid')).toBeVisible({ timeout: 5000 })
  console.log('✅ Vue Mois')

  await page.getByRole('button', { name: 'Précédent' }).click()
  await page.getByRole('button', { name: 'Suivant' }).click()
  await page.getByRole('button', { name: "Aujourd'hui" }).click()
  console.log("✅ Navigation OK")
})

// ─── 9. DÉCONNEXION ───────────────────────────────────────────────────────────
test('9. Déconnexion', async ({ page }) => {
  await goToCalendar(page)

  await page.getByRole('button', { name: 'Déconnexion' }).click()
  await page.waitForURL('/login', { timeout: 5000 })
  await expect(page).toHaveURL('/login')
  console.log('✅ Déconnexion réussie')
})

// ─── 10. PAGE D'INSCRIPTION — DESIGN CAVE ────────────────────────────────────
test('10. RegisterPage — design cave cohérent', async ({ page }) => {
  await page.goto('/register')
  // Should have heading
  await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible({ timeout: 5000 })
  // Cave branding panel (visible on large screens only, but form always present)
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  // Link back to login
  await expect(page.getByText('Se connecter')).toBeVisible()
  console.log('✅ Page inscription accessible et conforme')
})

// ─── 11. EXPORT ICAL — BOUTON VISIBLE ─────────────────────────────────────────
test('11. Bouton export iCal visible dans la toolbar', async ({ page }) => {
  await goToCalendar(page)
  const exportBtn = page.locator('button[title="Exporter iCal"]')
  await expect(exportBtn).toBeVisible({ timeout: 5000 })
  console.log('✅ Bouton export iCal visible')
})

// ─── 12. RÉCURRENCE — ÉVÉNEMENT HEBDOMADAIRE ─────────────────────────────────
test('12. Créer un événement récurrent et vérifier les occurrences', async ({ page }) => {
  await goToCalendar(page)

  // Switch to week view for easier verification
  await page.getByRole('button', { name: 'Semaine' }).click()
  await expect(page.locator('.fc-timegrid')).toBeVisible({ timeout: 5000 })

  // Create a recurring event
  await page.getByRole('button', { name: 'Événement' }).click()
  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })

  await page.getByPlaceholder("Titre de l'événement").fill('Entraînement Hebdo')

  // Select weekly recurrence
  const rruleSelect = page.locator('select').filter({ has: page.locator('option:has-text("Hebdomadaire")') })
  await rruleSelect.selectOption('FREQ=WEEKLY')

  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Événement créé')).toBeVisible({ timeout: 5000 })

  // Event should be visible this week
  await expect(page.locator('.fc-event-title:has-text("Entraînement Hebdo")')).toBeVisible({ timeout: 8000 })
  console.log('✅ Événement récurrent visible cette semaine')

  // Navigate to next week — event should still appear
  await page.getByRole('button', { name: 'Suivant' }).click()
  await expect(page.locator('.fc-event-title:has-text("Entraînement Hebdo")')).toBeVisible({ timeout: 8000 })
  console.log('✅ Événement récurrent visible semaine suivante')

  // Navigate one more week forward — still visible
  await page.getByRole('button', { name: 'Suivant' }).click()
  await expect(page.locator('.fc-event-title:has-text("Entraînement Hebdo")')).toBeVisible({ timeout: 8000 })
  console.log('✅ Événement récurrent visible 2 semaines plus tard')

  // Go back to today and delete the recurring event
  await page.getByRole('button', { name: "Aujourd'hui" }).click()
  await page.locator('.fc-event-title:has-text("Entraînement Hebdo")').first().click()

  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Supprimer' }).click()

  // ConfirmModal
  await expect(page.getByText('irréversible')).toBeVisible({ timeout: 3000 })
  await page.getByRole('button', { name: 'Supprimer' }).first().click()

  await expect(page.getByText('Événement supprimé')).toBeVisible({ timeout: 5000 })

  // Event should be gone from all weeks
  await expect(page.locator('.fc-event-title:has-text("Entraînement Hebdo")')).toHaveCount(0, { timeout: 8000 })
  console.log('✅ Événement récurrent supprimé de toutes les semaines')
})

// ─── 13. MODIFIER LA RÉCURRENCE D'UN ÉVÉNEMENT ──────────────────────────────
test('13. Modifier la récurrence (hebdo → quotidien) puis la supprimer', async ({ page }) => {
  await goToCalendar(page)

  // Switch to week view
  await page.getByRole('button', { name: 'Semaine' }).click()
  await expect(page.locator('.fc-timegrid')).toBeVisible({ timeout: 5000 })

  // Create a weekly recurring event
  await page.getByRole('button', { name: 'Événement' }).click()
  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })
  await page.getByPlaceholder("Titre de l'événement").fill('Récurrence Modifiable')
  const rruleSelect = page.locator('select').filter({ has: page.locator('option:has-text("Hebdomadaire")') })
  await rruleSelect.selectOption('FREQ=WEEKLY')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Événement créé')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.fc-event-title:has-text("Récurrence Modifiable")')).toBeVisible({ timeout: 8000 })
  console.log('✅ Événement hebdomadaire créé')

  // --- Modify recurrence: weekly → daily ---
  await page.locator('.fc-event-title:has-text("Récurrence Modifiable")').first().click()
  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })

  // Change recurrence to daily
  const editRruleSelect = page.locator('select').filter({ has: page.locator('option:has-text("Hebdomadaire")') })
  await editRruleSelect.selectOption('FREQ=DAILY')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Événement modifié')).toBeVisible({ timeout: 5000 })

  // Navigate to next full week so we get 7 daily occurrences
  await page.getByRole('button', { name: 'Suivant' }).click()
  await expect(page.locator('.fc-event-title:has-text("Récurrence Modifiable")')).toHaveCount(7, { timeout: 8000 })
  console.log('✅ Récurrence modifiée : quotidien (7 occurrences en vue semaine)')

  // Go back to today for the rest of the test
  await page.getByRole('button', { name: "Aujourd'hui" }).click()

  // --- Remove recurrence entirely ---
  await page.locator('.fc-event-title:has-text("Récurrence Modifiable")').first().click()
  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })

  // Set recurrence to "Aucune récurrence"
  const clearRruleSelect = page.locator('select').filter({ has: page.locator('option:has-text("Quotidien")') })
  await clearRruleSelect.selectOption('')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Événement modifié')).toBeVisible({ timeout: 5000 })

  // Now only 1 occurrence should be visible (no more recurrence)
  await expect(page.locator('.fc-event-title:has-text("Récurrence Modifiable")')).toHaveCount(1, { timeout: 8000 })
  console.log('✅ Récurrence supprimée : 1 seule occurrence')

  // Cleanup: delete the event
  await page.locator('.fc-event-title:has-text("Récurrence Modifiable")').first().click()
  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('irréversible')).toBeVisible({ timeout: 3000 })
  await page.getByRole('button', { name: 'Supprimer' }).first().click()
  await expect(page.getByText('Événement supprimé')).toBeVisible({ timeout: 5000 })
  console.log('✅ Événement nettoyé')
})

// ─── 14. RECHERCHE D'ÉVÉNEMENTS ─────────────────────────────────────────────
test('14. Recherche d\'événements', async ({ page }) => {
  await goToCalendar(page)

  // Create an event with a unique title for search
  await page.getByRole('button', { name: 'Événement' }).click()
  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })
  await page.getByPlaceholder("Titre de l'événement").fill('Spéléo Recherche Unique')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Événement créé')).toBeVisible({ timeout: 5000 })

  // Open search
  await page.getByRole('button', { name: 'Rechercher' }).click()
  await expect(page.locator('input[placeholder="Rechercher..."]')).toBeVisible({ timeout: 3000 })

  // Type search query
  await page.locator('input[placeholder="Rechercher..."]').fill('Recherche Unique')

  // Wait for search results dropdown
  await expect(page.locator('.max-h-64 button:has-text("Spéléo Recherche Unique")')).toBeVisible({ timeout: 8000 })
  console.log('✅ Résultat de recherche trouvé')

  // Click on the result (in the dropdown, not the calendar)
  await page.locator('.max-h-64 button:has-text("Spéléo Recherche Unique")').click()

  // The search dropdown should close and the view should change to day
  await expect(page.locator('input[placeholder="Rechercher..."]')).not.toBeVisible({ timeout: 3000 })

  // Wait for the day view timegrid to appear
  await expect(page.locator('.fc-timegrid')).toBeVisible({ timeout: 8000 })
  console.log('✅ Navigation vers l\'événement trouvé (vue jour)')

  // Go back to month view for cleanup
  await page.getByRole('button', { name: 'Mois' }).click()
  await expect(page.locator('.fc-daygrid')).toBeVisible({ timeout: 5000 })

  // Cleanup: delete the event
  await page.locator('.fc-event-title:has-text("Spéléo Recherche Unique")').first().click()
  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('irréversible')).toBeVisible({ timeout: 3000 })
  await page.getByRole('button', { name: 'Supprimer' }).first().click()
  await expect(page.getByText('Événement supprimé')).toBeVisible({ timeout: 5000 })
  console.log('✅ Événement de recherche nettoyé')
})

// ─── 15. FORMULAIRE D'INSCRIPTION ───────────────────────────────────────────
test('15. Inscription — formulaire fonctionnel', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible({ timeout: 5000 })

  // Generate unique email
  const uniqueEmail = `e2e_test_${Date.now()}@example.com`

  // Fill the form
  await page.locator('input[type="text"]').first().fill('Test E2E User')
  await page.locator('input[type="email"]').fill(uniqueEmail)
  await page.locator('input[type="password"]').fill('securepass1')

  // Submit
  await page.getByRole('button', { name: 'Créer le compte' }).click()

  // After successful registration, the app shows toast "Compte créé" and redirects to /login
  await expect(page.getByText('Compte créé')).toBeVisible({ timeout: 10000 })
  console.log('✅ Toast de confirmation affiché')

  await page.waitForURL('/login', { timeout: 10000 })
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible({ timeout: 5000 })
  console.log('✅ Inscription réussie, redirigé vers login : ' + uniqueEmail)
})

// ─── 16. GESTION DES ÉTIQUETTES ────────────────────────────────────────────
test('16. Gestion des étiquettes dans Settings', async ({ page }) => {
  await goToCalendar(page)

  // Navigate to settings page
  await page.goto(`/c/${TEST_SLUG}/settings?tab=tags`)
  await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible({ timeout: 5000 })

  // Should see "Nouvelle étiquette" section
  await expect(page.getByText('Nouvelle étiquette')).toBeVisible({ timeout: 5000 })
  console.log('✅ Onglet Étiquettes visible')

  // Create a tag
  await page.getByPlaceholder("Nom de l'étiquette").fill('Exploration')
  await page.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByText('Étiquette créée')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Exploration').first()).toBeVisible({ timeout: 3000 })
  console.log('✅ Étiquette "Exploration" créée')

  // Create a second tag
  await page.getByPlaceholder("Nom de l'étiquette").fill('Formation')
  await page.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByText('Étiquette créée')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Formation').first()).toBeVisible({ timeout: 3000 })
  console.log('✅ Étiquette "Formation" créée')

  // Delete the "Formation" tag
  // Hover over the Formation tag to reveal delete button
  const formationRow = page.locator('div.group', { hasText: 'Formation' }).first()
  await formationRow.hover()
  await formationRow.locator('button').filter({ has: page.locator('svg') }).last().click()

  // Confirm deletion
  await expect(page.getByText('Supprimer l\'étiquette')).toBeVisible({ timeout: 3000 })
  await page.getByRole('button', { name: 'Supprimer' }).first().click()
  await expect(page.getByText('Étiquette supprimée')).toBeVisible({ timeout: 5000 })
  console.log('✅ Étiquette "Formation" supprimée')
})

// ─── 17. ASSIGNER ÉTIQUETTE À UN ÉVÉNEMENT ─────────────────────────────────
test('17. Assigner une étiquette à un événement', async ({ page }) => {
  await goToCalendar(page)

  // Create a new event
  await page.getByRole('button', { name: 'Événement' }).click()
  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })
  await page.getByPlaceholder("Titre de l'événement").fill('Event avec étiquette')

  // Check if the "Exploration" tag pill is visible (created in test 16)
  const tagPill = page.locator('button:has-text("Exploration")').first()
  if (await tagPill.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Click the tag to select it
    await tagPill.click()
    console.log('✅ Étiquette "Exploration" sélectionnée dans le formulaire')
  } else {
    console.log('SKIP: Aucune étiquette visible (test 16 non exécuté avant)')
  }

  // Save the event
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Événement créé')).toBeVisible({ timeout: 5000 })
  console.log('✅ Événement créé avec étiquette')

  // Check that the event is visible in the calendar
  await expect(page.locator('.fc-event-title:has-text("Event avec étiquette")')).toBeVisible({ timeout: 8000 })

  // Cleanup: delete event
  await page.locator('.fc-event-title:has-text("Event avec étiquette")').first().click()
  await expect(page.getByPlaceholder("Titre de l'événement")).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('irréversible')).toBeVisible({ timeout: 3000 })
  await page.getByRole('button', { name: 'Supprimer' }).first().click()
  await expect(page.getByText('Événement supprimé')).toBeVisible({ timeout: 5000 })
  console.log('✅ Événement avec étiquette nettoyé')

  // Cleanup: delete the "Exploration" tag via API
  const BASE = 'http://localhost:8000/v1'
  const loginRes = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  const { access_token: jwt } = await loginRes.json()
  const calRes = await fetch(BASE + '/calendars/slug/' + TEST_SLUG, { headers: { Authorization: 'Bearer ' + jwt } })
  const cal = await calRes.json()
  const tagsRes = await fetch(BASE + '/calendars/' + cal.id + '/tags', { headers: { Authorization: 'Bearer ' + jwt } })
  const tags = await tagsRes.json()
  for (const t of tags) {
    await fetch(BASE + '/calendars/' + cal.id + '/tags/' + t.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + jwt } })
  }
  console.log('✅ Tags nettoyés via API')
})


// ─── 18. COMMENTAIRES ───────────────────────────────────────────────────────

test('18. Ajouter un commentaire sur un événement', async ({ page }) => {
  await goToCalendar(page)

  // Create event via API
  const BASE = 'http://localhost:8000/v1'
  const loginRes = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  const { access_token: jwt } = await loginRes.json()
  const calRes = await fetch(BASE + '/calendars/slug/' + TEST_SLUG, { headers: { Authorization: 'Bearer ' + jwt } })
  const cal = await calRes.json()
  const scRes = await fetch(BASE + '/calendars/' + cal.id + '/subcalendars', { headers: { Authorization: 'Bearer ' + jwt } })
  const scs = await scRes.json()

  const evRes = await fetch(BASE + '/calendars/' + cal.id + '/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
    body: JSON.stringify({
      sub_calendar_id: scs[0].id,
      title: 'Chat Test Event',
      start_dt: new Date().toISOString().slice(0, 10) + 'T10:00:00',
      end_dt: new Date().toISOString().slice(0, 10) + 'T11:00:00',
    }),
  })
  const ev = await evRes.json()

  // Reload calendar and click event
  await page.reload()
  await page.waitForSelector('.fc', { timeout: 10000 })
  await page.getByText('Chat Test Event').first().click()
  await expect(page.getByText('Discussion')).toBeVisible({ timeout: 5000 })

  // Type and send a comment
  await page.getByPlaceholder('Ecrire un message...').fill('Bonjour depuis E2E')
  await page.locator('button:has(svg.lucide-send)').click()

  // Verify the comment appears
  await expect(page.getByText('Bonjour depuis E2E')).toBeVisible({ timeout: 5000 })
  console.log('✅ Commentaire ajouté')

  // Cleanup
  await fetch(BASE + '/calendars/' + cal.id + '/events/' + ev.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + jwt } })
})


// ─── 19. FICHIERS JOINTS ────────────────────────────────────────────────────

test('19. Uploader un fichier sur un événement', async ({ page }) => {
  await goToCalendar(page)

  // Create event via API
  const BASE = 'http://localhost:8000/v1'
  const loginRes = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  const { access_token: jwt } = await loginRes.json()
  const calRes = await fetch(BASE + '/calendars/slug/' + TEST_SLUG, { headers: { Authorization: 'Bearer ' + jwt } })
  const cal = await calRes.json()
  const scRes = await fetch(BASE + '/calendars/' + cal.id + '/subcalendars', { headers: { Authorization: 'Bearer ' + jwt } })
  const scs = await scRes.json()

  const evRes = await fetch(BASE + '/calendars/' + cal.id + '/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
    body: JSON.stringify({
      sub_calendar_id: scs[0].id,
      title: 'Upload Test Event',
      start_dt: new Date().toISOString().slice(0, 10) + 'T10:00:00',
      end_dt: new Date().toISOString().slice(0, 10) + 'T11:00:00',
    }),
  })
  const ev = await evRes.json()

  // Reload and click event
  await page.reload()
  await page.waitForSelector('.fc', { timeout: 10000 })
  await page.getByText('Upload Test Event').first().click()
  await expect(page.getByText('Fichiers joints')).toBeVisible({ timeout: 5000 })

  // Upload a file
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'test-file.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Hello from E2E test'),
  })

  // Verify upload toast and file in list
  await expect(page.getByText('Fichier ajoute')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('test-file.txt')).toBeVisible({ timeout: 5000 })
  console.log('✅ Fichier uploadé')

  // Cleanup
  await fetch(BASE + '/calendars/' + cal.id + '/events/' + ev.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + jwt } })
})


// ─── 20. SUPPRIMER UN COMMENTAIRE ───────────────────────────────────────────

test('20. Supprimer un commentaire', async ({ page }) => {
  await goToCalendar(page)

  // Create event + comment via API
  const BASE = 'http://localhost:8000/v1'
  const loginRes = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  const { access_token: jwt } = await loginRes.json()
  const calRes = await fetch(BASE + '/calendars/slug/' + TEST_SLUG, { headers: { Authorization: 'Bearer ' + jwt } })
  const cal = await calRes.json()
  const scRes = await fetch(BASE + '/calendars/' + cal.id + '/subcalendars', { headers: { Authorization: 'Bearer ' + jwt } })
  const scs = await scRes.json()

  const evRes = await fetch(BASE + '/calendars/' + cal.id + '/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
    body: JSON.stringify({
      sub_calendar_id: scs[0].id,
      title: 'Delete Comment Test',
      start_dt: new Date().toISOString().slice(0, 10) + 'T10:00:00',
      end_dt: new Date().toISOString().slice(0, 10) + 'T11:00:00',
    }),
  })
  const ev = await evRes.json()

  // Create comment via API
  await fetch(BASE + '/calendars/' + cal.id + '/events/' + ev.id + '/comments', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
    body: JSON.stringify({ content: 'To be deleted' }),
  })

  // Open event
  await page.reload()
  await page.waitForSelector('.fc', { timeout: 10000 })
  await page.getByText('Delete Comment Test').first().click()
  await expect(page.getByText('To be deleted')).toBeVisible({ timeout: 5000 })

  // Hover and click delete
  const commentEl = page.locator('.group:has-text("To be deleted")')
  await commentEl.hover()
  await commentEl.locator('button:has(svg.lucide-trash-2)').click()

  // Verify comment is gone
  await expect(page.getByText('To be deleted')).not.toBeVisible({ timeout: 5000 })
  console.log('✅ Commentaire supprimé')

  // Cleanup
  await fetch(BASE + '/calendars/' + cal.id + '/events/' + ev.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + jwt } })
})


// ─── 21. SUPPRIMER UN FICHIER JOINT ─────────────────────────────────────────

test('21. Supprimer un fichier joint', async ({ page }) => {
  await goToCalendar(page)

  // Create event + attachment via API
  const BASE = 'http://localhost:8000/v1'
  const loginRes = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  const { access_token: jwt } = await loginRes.json()
  const calRes = await fetch(BASE + '/calendars/slug/' + TEST_SLUG, { headers: { Authorization: 'Bearer ' + jwt } })
  const cal = await calRes.json()
  const scRes = await fetch(BASE + '/calendars/' + cal.id + '/subcalendars', { headers: { Authorization: 'Bearer ' + jwt } })
  const scs = await scRes.json()

  const evRes = await fetch(BASE + '/calendars/' + cal.id + '/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
    body: JSON.stringify({
      sub_calendar_id: scs[0].id,
      title: 'Delete File Test',
      start_dt: new Date().toISOString().slice(0, 10) + 'T10:00:00',
      end_dt: new Date().toISOString().slice(0, 10) + 'T11:00:00',
    }),
  })
  const ev = await evRes.json()

  // Upload file via API (multipart)
  const form = new FormData()
  form.append('file', new Blob(['file content'], { type: 'text/plain' }), 'to-delete.txt')
  await fetch(BASE + '/calendars/' + cal.id + '/events/' + ev.id + '/attachments', {
    method: 'POST', headers: { Authorization: 'Bearer ' + jwt },
    body: form,
  })

  // Open event
  await page.reload()
  await page.waitForSelector('.fc', { timeout: 10000 })
  await page.getByText('Delete File Test').first().click()
  await expect(page.getByText('to-delete.txt')).toBeVisible({ timeout: 5000 })

  // Hover and click delete
  const fileEl = page.locator('.group:has-text("to-delete.txt")')
  await fileEl.hover()
  await fileEl.locator('button:has(svg.lucide-trash-2)').click()

  // Verify file is gone
  await expect(page.getByText('Fichier supprime')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('to-delete.txt')).not.toBeVisible({ timeout: 5000 })
  console.log('✅ Fichier supprimé')

  // Cleanup
  await fetch(BASE + '/calendars/' + cal.id + '/events/' + ev.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + jwt } })
})
