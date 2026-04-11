/**
 * E2E — Auto-cadastro de loja + flags OAuth (Epic 13, v2.5+)
 *
 * Pré-requisitos para executar:
 *   1. `npm i -D @playwright/test`
 *   2. `npx playwright install`
 *   3. Backend rodando em http://localhost:3001 (ou WEB_URL=http://localhost:5173 com proxy)
 *   4. Banco de teste limpo + Stripe em modo test
 *
 * Mocks:
 *   - Stripe Customer + Subscription são mockados via `STRIPE_SECRET_KEY=sk_test_*`
 *   - Email transporter pode ser MailHog (porta 1025) ou nodemailer-mock no backend
 */
import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

const validInput = {
  storeName: 'Pizzaria E2E Teste',
  whatsapp: '(48) 99999-0000',
  segment: 'PIZZERIA',
  email: 'e2e+teste@example.com',
  password: 'senha1234',
  confirmPassword: 'senha1234',
  cep: '88010-000',
  street: 'Praça XV de Novembro',
  number: '1',
  neighborhood: 'Centro',
  city: 'Florianópolis',
  state: 'SC',
} as const

async function fillRegistrationForm(page: Page, input = validInput) {
  await page.fill('#storeName', input.storeName)
  await page.fill('#whatsapp', input.whatsapp)
  await page.selectOption('#segment', input.segment)
  await page.fill('#email', input.email)
  await page.fill('#password', input.password)
  await page.fill('#confirmPassword', input.confirmPassword)
  await page.fill('#cep', input.cep)
  // Aguarda ViaCEP autocompletar (street, neighborhood, city, state)
  await page.waitForTimeout(500)
  await page.fill('#number', input.number)
}

test.describe('Epic 13 — Auto-cadastro de loja', () => {
  test('Cenário 1 — Happy path: cria loja com trial 7d e redireciona para dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastro`)

    await expect(page.getByRole('heading', { name: 'Teste 100% grátis' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Crie sua loja' })).toBeVisible()

    await fillRegistrationForm(page)

    // ViaCEP deve ter preenchido city e state
    await expect(page.locator('#city')).toHaveValue(/Florianópolis/i)
    await expect(page.locator('#state')).toHaveValue('SC')

    await page.getByRole('button', { name: /Preencha os dados para cadastrar|Criando sua loja/i }).click()

    await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10_000 })
    expect(page.url()).toContain('/dashboard')
  })

  test('Cenário 2 — Senhas não coincidem: erro inline em confirmPassword', async ({ page }) => {
    await page.goto(`${BASE_URL}/cadastro`)

    await fillRegistrationForm(page, { ...validInput, confirmPassword: 'outra-senha' })

    await page.getByRole('button', { name: /Preencha os dados para cadastrar|Criando sua loja/i }).click()

    const error = page.locator('text=As senhas não coincidem')
    await expect(error).toBeVisible()
  })

  test('Cenário 3 — Email duplicado: backend retorna 422 + erro inline em email', async ({ page, request }) => {
    // Pre-cria uma loja com o email
    await request.post(`${BASE_URL}/api/v1/auth/register-store`, {
      data: { ...validInput, email: 'duplicado@example.com', whatsapp: '48999990001', cep: '88010000' },
    })

    await page.goto(`${BASE_URL}/cadastro`)
    await fillRegistrationForm(page, { ...validInput, email: 'duplicado@example.com' })

    await page.getByRole('button', { name: /Preencha os dados para cadastrar|Criando sua loja/i }).click()

    const error = page.locator('text=Email já cadastrado')
    await expect(error).toBeVisible()
  })

  test('Cenário 4 — Rate limit: 6º cadastro do mesmo IP é bloqueado', async ({ page, request }) => {
    // 5 cadastros válidos via API
    for (let i = 0; i < 5; i++) {
      await request.post(`${BASE_URL}/api/v1/auth/register-store`, {
        data: { ...validInput, email: `rl-${i}@example.com`, whatsapp: '48999990000', cep: '88010000' },
      })
    }

    // 6º via UI deve cair no rate-limit
    await page.goto(`${BASE_URL}/cadastro`)
    await fillRegistrationForm(page, { ...validInput, email: 'rl-6@example.com' })
    await page.getByRole('button', { name: /Preencha os dados para cadastrar|Criando sua loja/i }).click()

    const toast = page.locator('text=Muitas tentativas')
    await expect(toast).toBeVisible()
  })

  test('Cenário 5 — OAuth flag desligada: botões sociais não aparecem em /login', async ({ page }) => {
    // Mock /api/v1/auth/config retornando ambos false
    await page.route('**/api/v1/auth/config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ providers: { google: false, facebook: false } }),
      })
    )

    await page.goto(`${BASE_URL}/login`)

    await expect(page.getByRole('button', { name: /Entrar com Google/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Entrar com Facebook/i })).toHaveCount(0)
    await expect(page.getByText('ou continue com')).toHaveCount(0)
  })

  test('Cenário 6 — Só Google habilitado: botão Google visível, Facebook ausente', async ({ page }) => {
    await page.route('**/api/v1/auth/config', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ providers: { google: true, facebook: false } }),
      })
    )

    await page.goto(`${BASE_URL}/login`)

    await expect(page.getByRole('button', { name: /Entrar com Google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Entrar com Facebook/i })).toHaveCount(0)
  })
})
