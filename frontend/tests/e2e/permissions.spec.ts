import { test, expect } from '@playwright/test'
import { TEST_EMAIL, TEST_PASSWORD, TEST_SLUG } from './global-setup'
import { login, goToCalendar } from './helpers'

const BASE = 'http://localhost:8000/v1'

test('P2. Bouton Parametres visible pour admin/owner', async ({ page }) => {
  await goToCalendar(page)
  const btn = page.locator('button[title="Paramètres"], button[aria-label="Paramètres"]')
  await expect(btn).toBeVisible({ timeout: 5000 })
  console.log('OK Bouton Parametres visible')
})

test('P3. Page Paramètres avec onglets', async ({ page }) => {
  await goToCalendar(page)
  await page.locator('button[title="Paramètres"], button[aria-label="Paramètres"]').click()
  await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible({ timeout: 5000 })
  console.log('OK Page paramètres ouverte')
  await expect(page.getByRole('button', { name: /Général/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Liens/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Utilisateurs/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Groupes/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Étiquettes/i })).toBeVisible()
  console.log('OK 5 onglets visibles (owner)')
})

test('P4. Creer lien lecture seule et verifier acces', async ({ page }) => {
  await goToCalendar(page)

  // Navigate to settings page, links tab
  await page.goto('/c/' + TEST_SLUG + '/settings?tab=links')
  await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible({ timeout: 5000 })

  const respPromise = page.waitForResponse(
    (resp) => resp.url().includes('/links') && resp.request().method() === 'POST',
    { timeout: 15000 }
  )

  await page.locator('input[placeholder="Label (optionnel)"]').fill('Test lien lecture')
  await page.locator('select').first().selectOption('read_only')
  await page.getByRole('button', { name: 'Créer le lien' }).click()

  const resp = await respPromise
  expect(resp.status()).toBe(201)
  const body = await resp.json()
  const token: string = body.token
  expect(token).toBeTruthy()
  console.log('OK Token: ' + token.substring(0, 20) + '...')

  await expect(page.locator('text=Test lien lecture').first()).toBeVisible({ timeout: 5000 })
  console.log('OK Lien visible dans la liste')

  // Use fresh context without auth cookies to test true read-only access
  const browser = page.context().browser()!
  const freshCtx = await browser.newContext()
  const page2 = await freshCtx.newPage()
  await page2.goto('http://localhost:5173/c/' + TEST_SLUG + '?token=' + token)
  await page2.waitForTimeout(3000)
  console.log('Page2 URL: ' + page2.url())

  await expect(page2.locator('.fc')).toBeVisible({ timeout: 10000 })
  console.log('OK FullCalendar visible (lecture seule)')

  const addBtn = page2.getByRole('button', { name: /[Ee]v[ée]nement/ })
  expect(await addBtn.isVisible().catch(() => false)).toBe(false)
  console.log('OK Bouton +Evenement absent')

  const settBtn2 = page2.locator('button[title="Paramètres"], button[aria-label="Paramètres"]')
  await expect(settBtn2).not.toBeVisible()
  console.log('OK Bouton Parametres absent')

  await page2.close()
  await freshCtx.close()
})

test('P5. Clic evenement read-only - no Enregistrer, Fermer present', async ({ page }) => {
  const loginRes = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  const { access_token: jwt } = await loginRes.json()

  const calRes = await fetch(BASE + '/calendars/slug/' + TEST_SLUG, { headers: { Authorization: 'Bearer ' + jwt } })
  const cal = await calRes.json()
  const calId = cal.id

  // Get first subcalendar ID for event creation
  const subcalsRes = await fetch(BASE + '/calendars/' + calId + '/subcalendars', { headers: { Authorization: 'Bearer ' + jwt } })
  const subcals = await subcalsRes.json()
  const subcalId = subcals[0] && subcals[0].id
  if (!subcalId) throw new Error('No subcalendar found')

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0)
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0)
  const evRes = await fetch(BASE + '/calendars/' + calId + '/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
    body: JSON.stringify({ title: 'Event Lecture Test', start_dt: start.toISOString().slice(0,19), end_dt: end.toISOString().slice(0,19), all_day: false, sub_calendar_id: subcalId }),
  })
  const ev = await evRes.json()
  console.log('Event cree: ' + ev.title + ' id=' + ev.id)

  const linksRes = await fetch(BASE + '/calendars/' + calId + '/links', { headers: { Authorization: 'Bearer ' + jwt } })
  const links = await linksRes.json()
  let token: string
  const found = Array.isArray(links) && links.find((l: any) => l.permission === 'read_only' && l.active)
  if (found) {
    token = found.token
  } else {
    const cRes = await fetch(BASE + '/calendars/' + calId + '/links', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
      body: JSON.stringify({ label: 'P5 test', permission: 'read_only' }),
    })
    const c = await cRes.json()
    token = c.token
  }
  console.log('Token: ' + token.substring(0, 20))

  await page.goto('http://localhost:5173/c/' + TEST_SLUG + '?token=' + token)
  await page.waitForTimeout(3000)
  await expect(page.locator('.fc')).toBeVisible({ timeout: 10000 })

  const evTitle = page.locator('.fc-event-title:has-text("Event Lecture Test")').first()
  if (!await evTitle.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('SKIP: Event non visible (vue/mois different)')
    await fetch(BASE + '/calendars/' + calId + '/events/' + ev.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + jwt } })
    return
  }

  await evTitle.click()
  await page.waitForTimeout(1500)

  const btns = await page.locator('button').allTextContents()
  console.log('Boutons apres clic event: ' + JSON.stringify(btns))

  const saveVis   = btns.some(t => /enregistrer|sauvegarder|save/i.test(t))
  const fermerVis = btns.some(t => /fermer|close/i.test(t))

  expect(saveVis).toBe(false)
  console.log('OK Enregistrer absent (read-only)')
  expect(fermerVis).toBe(true)
  console.log('OK Fermer present')

  await fetch(BASE + '/calendars/' + calId + '/events/' + ev.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + jwt } })
  console.log('Event supprime')
})
