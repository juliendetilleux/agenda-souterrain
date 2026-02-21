import { FullConfig } from '@playwright/test'
import { execSync } from 'child_process'

export const TEST_EMAIL = 'e2e_playwright@example.com'
export const TEST_PASSWORD = 'playwright123'
export const TEST_NAME = 'E2E Tester'
export const TEST_SLUG = 'e2e-playwright-cal'
export const TEST_CAL_TITLE = 'Calendrier E2E'

// Docker DB container name (matches the agenda-souterrain compose project)
const DB_CONTAINER = 'agenda-souterrain-db-1'

async function globalSetup(_config: FullConfig) {
  const BASE = 'http://localhost:8000/v1'

  // 1. Register user (ignore if already exists)
  const regRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, name: TEST_NAME, password: TEST_PASSWORD }),
  })
  if (regRes.ok) {
    console.log(`[Setup] Compte créé : ${TEST_EMAIL}`)
  } else {
    const err = await regRes.json()
    if (err.detail === 'Email déjà enregistré' || err.detail === 'Email already registered') {
      console.log(`[Setup] Compte existant : ${TEST_EMAIL}`)
    } else {
      throw new Error(`[Setup] Register failed: ${JSON.stringify(err)}`)
    }
  }

  // 2. Promote test user to admin (is_admin=true) and create test calendar via SQL
  // Calendar creation is superadmin-only via API, so we insert directly in DB.
  try {
    execSync(
      `docker exec ${DB_CONTAINER} psql -U postgres agenda_db -c "UPDATE users SET is_admin=true WHERE email='${TEST_EMAIL}'"`,
      { stdio: 'pipe' }
    )
    console.log(`[Setup] ${TEST_EMAIL} promu admin`)

    // Create the test calendar directly in DB (ON CONFLICT DO NOTHING = idempotent)
    const sql = `
      DO \\$\\$
      DECLARE
        v_user_id UUID;
        v_cal_id UUID := gen_random_uuid();
        v_sc_id UUID := gen_random_uuid();
      BEGIN
        SELECT id INTO v_user_id FROM users WHERE email = '${TEST_EMAIL}';
        INSERT INTO calendars (id, title, slug, owner_id, timezone, language, week_start, date_format,
          default_view, visible_time_start, visible_time_end, default_event_duration, show_weekends, created_at)
        VALUES (v_cal_id, '${TEST_CAL_TITLE}', '${TEST_SLUG}', v_user_id, 'Europe/Paris', 'fr', 1,
          'DD/MM/YYYY', 'month', '00:00', '24:00', 60, true, NOW())
        ON CONFLICT (slug) DO NOTHING;
        IF FOUND THEN
          INSERT INTO sub_calendars (id, calendar_id, name, color, active, position, created_at)
          VALUES (v_sc_id, v_cal_id, 'Principal', '#3788d8', true, 0, NOW());
        END IF;
      END \\$\\$;
    `
    execSync(`docker exec ${DB_CONTAINER} psql -U postgres agenda_db -c "${sql}"`, { stdio: 'pipe' })
    console.log(`[Setup] Calendrier existant (OK)`)
  } catch (e) {
    console.warn(`[Setup] Opérations DB ignorées (conteneur "${DB_CONTAINER}" inaccessible ?)`)
  }

  // 3. Login to get token
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  const { access_token } = await loginRes.json()

  // 4. Delete all existing events on this calendar (clean state)
  const calInfoRes = await fetch(`${BASE}/calendars/slug/${TEST_SLUG}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (calInfoRes.ok) {
    const cal = await calInfoRes.json()
    const eventsRes = await fetch(`${BASE}/calendars/${cal.id}/events`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (eventsRes.ok) {
      const events = await eventsRes.json()
      for (const ev of events) {
        await fetch(`${BASE}/calendars/${cal.id}/events/${ev.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${access_token}` },
        })
      }
      console.log(`[Setup] ${events.length} événements supprimés`)
    }
  }
}

export default globalSetup
