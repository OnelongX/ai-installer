import { expect, test } from '@playwright/test'

test('user can move from api key step to install plan', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('API Key').fill('sk-test-key')
  await page.getByRole('button', { name: '继续', exact: true }).click()
  await expect(page.getByText('环境检测')).toBeVisible()
  await page.getByRole('button', { name: '继续到安装计划' }).click()
  await expect(page.getByText('安装计划')).toBeVisible()
  await page.getByRole('button', { name: '开始安装' }).click()
  await expect(page.getByText('Claude 已可使用。')).toBeVisible()
})
