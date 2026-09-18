import { expect, test } from '@playwright/test'

test('Rachel receives one reroute alert, accepts it, reloads offline, expires, and reconnects', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-09-21T00:00:00Z') })
  await page.goto('/')
  await expect(page.getByText(/deterministic demo/i)).toBeVisible()
  await page.getByRole('button', { name: /reset scenario/i }).click()
  await page.getByRole('button', { name: /start monitoring/i }).click()
  await expect(page.getByTestId('recommendation-card')).toContainText(/stay|monitor/i)

  const baseline = await page.getByTestId('route-card').first().locator('.route-probability').textContent()
  await page.getByRole('button', { name: /advance 5 min/i }).click()
  await expect(page.getByTestId('inbox')).toContainText('0')

  await page.getByRole('button', { name: /trigger ewl fault/i }).click()
  await expect(page.getByTestId('recommendation-card')).toContainText(/switch|reroute/i)
  const disrupted = await page.getByTestId('route-card').first().locator('.route-probability').textContent()
  expect(disrupted).not.toBe(baseline)
  await expect(page.getByTestId('inbox')).toContainText('1')

  await page.getByRole('button', { name: /re-evaluate/i }).click()
  await expect(page.getByTestId('inbox')).toContainText('1')
  const accept = page.getByRole('button', { name: /accept this route/i }).first()
  await accept.click()
  await expect(page.getByText('Selected route')).toBeVisible()

  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText(/you’re offline/i)).toBeVisible()
  await expect(page.getByTestId('offline-plan')).toContainText(/route version/i)
  await expect(page.getByTestId('offline-plan')).toContainText(/last synced/i)

  await page.clock.fastForward('02:00:00')
  await expect(page.getByTestId('offline-plan')).toContainText(/do not rely on this plan/i)
  await expect(page.getByTestId('recommendation-card')).toContainText(/reconnect for current advice/i)

  await context.setOffline(false)
  await page.reload()
  await expect(page.getByText('Connected')).toBeVisible()
  await expect(page.getByTestId('recommendation-card')).not.toContainText(/reconnect for current advice/i)
})
