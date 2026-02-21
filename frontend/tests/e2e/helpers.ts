import type { Page } from '@playwright/test'
import { TEST_EMAIL, TEST_PASSWORD, TEST_SLUG } from './global-setup'

export async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('/', { timeout: 10000 })
}

export async function goToCalendar(page: Page) {
  await login(page)
  await page.goto(`/c/${TEST_SLUG}`)
  await page.waitForSelector('.fc', { timeout: 10000 })
}
