// Mock nodemailer before importing the service
const sendMail = jest.fn().mockResolvedValue({ messageId: 'fake-id' })

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail })),
}))

// Fixa o domínio raiz pra os testes serem determinísticos independente do shell.
process.env.PUBLIC_ROOT_DOMAIN = 'menupanda.com.br'
delete process.env.SUPPORT_EMAIL

import {
  __test__,
  sendPaymentFailedEmail,
  sendPlanChangeEmail,
  sendTrialSuspendedEmail,
  sendWelcomeEmail,
  sendWelcomeSelfRegisterEmail,
} from '../email.service'

beforeEach(() => {
  sendMail.mockClear()
  __test__.clearCache()
})

describe('renderTemplate (template engine)', () => {
  it('substitutes {{var}} placeholders', () => {
    const out = __test__.renderTemplate('Hello {{name}}!', { name: 'World' })
    expect(out).toBe('Hello World!')
  })

  it('handles whitespace inside braces ({{ name }})', () => {
    const out = __test__.renderTemplate('Hi {{ name }}', { name: 'X' })
    expect(out).toBe('Hi X')
  })

  it('replaces missing variables with empty string', () => {
    const out = __test__.renderTemplate('A {{missing}} B', {})
    expect(out).toBe('A  B')
  })

  it('substitutes the same variable multiple times', () => {
    const out = __test__.renderTemplate('{{x}} and {{x}}', { x: 'foo' })
    expect(out).toBe('foo and foo')
  })

  it('strips HTML comments before rendering', () => {
    const out = __test__.renderTemplate(
      '<!-- documentation comment with {{var}} --><p>Hi {{name}}</p>',
      { name: 'X', var: 'Y' }
    )
    expect(out).not.toContain('<!--')
    expect(out).not.toContain('documentation')
    expect(out).toContain('Hi X')
  })
})

describe('renderEmailHtml (layout + template)', () => {
  it('wraps body template inside _layout and injects content', () => {
    const html = __test__.renderEmailHtml('welcome-self-register', 'Test Subject', {
      adminName: 'Dona Maria',
      adminEmail: 'maria@example.com',
      storeName: 'Pizzaria',
      trialEndsStr: '17 de abril de 2026',
      publicUrl: 'https://pizzaria.menupanda.com.br',
      loginUrl: 'https://app.menupanda.com.br/login',
    })

    // Layout is present
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Menu Panda')
    // Subject injected
    expect(html).toContain('<title>Test Subject</title>')
    // Body content rendered with variables
    expect(html).toContain('Dona Maria')
    expect(html).toContain('Pizzaria')
    expect(html).toContain('17 de abril de 2026')
    expect(html).toContain('https://pizzaria.menupanda.com.br')
    // Footer with current year
    expect(html).toContain(String(new Date().getFullYear()))
  })
})

describe('sendWelcomeSelfRegisterEmail', () => {
  const baseParams = {
    adminEmail: 'dona.maria@example.com',
    adminName: 'Dona Maria',
    storeName: 'Pizzaria Dona Maria',
    storeSlug: 'pizzaria-dona-maria',
    trialEndsAt: new Date('2026-04-17T12:00:00Z'),
    loginUrl: 'https://app.menupanda.com.br/login',
  }

  it('sends email containing trial end date, public URL and login URL', async () => {
    await sendWelcomeSelfRegisterEmail(baseParams)

    expect(sendMail).toHaveBeenCalledTimes(1)
    const callArgs = sendMail.mock.calls[0][0]
    expect(callArgs.to).toBe('dona.maria@example.com')
    expect(callArgs.subject).toContain('Pizzaria Dona Maria')

    const html: string = callArgs.html
    expect(html).toContain('https://pizzaria-dona-maria.menupanda.com.br')
    expect(html).toContain('https://app.menupanda.com.br/login')
    expect(html).toContain('dona.maria@example.com')
    expect(html).toContain('Dona Maria')
  })

  it('does NOT contain the word "senha" (no password leak)', async () => {
    await sendWelcomeSelfRegisterEmail(baseParams)
    const html: string = sendMail.mock.calls[0][0].html
    expect(html.toLowerCase()).not.toContain('senha')
  })

  it('uses the welcome-self-register template name', async () => {
    await sendWelcomeSelfRegisterEmail(baseParams)
    const html: string = sendMail.mock.calls[0][0].html
    // The template body has this specific heading
    expect(html).toContain('Bem-vindo ao Menu Panda')
  })
})

describe('sendWelcomeEmail (Owner-created)', () => {
  it('sends email with temporary password', async () => {
    await sendWelcomeEmail({
      adminEmail: 'admin@example.com',
      adminName: 'Admin',
      storeName: 'Loja X',
      tempPassword: 'temp1234',
      loginUrl: 'https://app.menupanda.com.br/login',
    })

    const html: string = sendMail.mock.calls[0][0].html
    expect(html).toContain('temp1234')
    expect(html).toContain('admin@example.com')
    expect(html).toContain('Loja X')
  })
})

describe('sendPlanChangeEmail', () => {
  it('sends email with old and new plan', async () => {
    await sendPlanChangeEmail({
      adminEmail: 'admin@example.com',
      adminName: 'Admin',
      storeName: 'Loja Y',
      oldPlan: 'PROFESSIONAL',
      newPlan: 'PREMIUM',
    })

    const html: string = sendMail.mock.calls[0][0].html
    expect(html).toContain('PROFESSIONAL')
    expect(html).toContain('PREMIUM')
    expect(html).toContain('Loja Y')
  })
})

describe('sendTrialSuspendedEmail', () => {
  const baseParams = {
    adminEmail: 'admin@example.com',
    adminName: 'Dona Maria',
    storeName: 'Pizzaria Dona Maria',
    billingUrl: 'https://app.menupanda.com.br/admin/configuracoes',
  }

  it('envia email com nome do admin, loja e link de billing', async () => {
    await sendTrialSuspendedEmail(baseParams)

    expect(sendMail).toHaveBeenCalledTimes(1)
    const callArgs = sendMail.mock.calls[0][0]
    expect(callArgs.to).toBe('admin@example.com')
    expect(callArgs.subject).toContain('Pizzaria Dona Maria')

    const html: string = callArgs.html
    expect(html).toContain('Dona Maria')
    expect(html).toContain('Pizzaria Dona Maria')
    expect(html).toContain('https://app.menupanda.com.br/admin/configuracoes')
    expect(html).toContain('suspensa')
  })

  it('usa email de suporte default quando não fornecido', async () => {
    await sendTrialSuspendedEmail(baseParams)
    const html: string = sendMail.mock.calls[0][0].html
    expect(html).toContain('contato@menupanda.com.br')
  })

  it('aceita email de suporte custom', async () => {
    await sendTrialSuspendedEmail({ ...baseParams, supportEmail: 'help@x.com' })
    const html: string = sendMail.mock.calls[0][0].html
    expect(html).toContain('help@x.com')
    expect(html).not.toContain('contato@menupanda.com.br')
  })

  it('renderiza dentro do _layout', async () => {
    await sendTrialSuspendedEmail(baseParams)
    const html: string = sendMail.mock.calls[0][0].html
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain(String(new Date().getFullYear())) // footer
  })
})

describe('sendPaymentFailedEmail', () => {
  it('sends email with store name and grace period', async () => {
    await sendPaymentFailedEmail({
      adminEmail: 'admin@example.com',
      storeName: 'Loja Z',
      graceDays: 1,
    })

    const html: string = sendMail.mock.calls[0][0].html
    expect(html).toContain('Loja Z')
    expect(html).toContain('Falha no pagamento')
    expect(html).toContain('1 dia')
  })

  it('pluralizes "dias" when graceDays > 1', async () => {
    await sendPaymentFailedEmail({
      adminEmail: 'admin@example.com',
      storeName: 'Loja W',
      graceDays: 5,
    })

    const html: string = sendMail.mock.calls[0][0].html
    expect(html).toContain('5 dias')
  })
})
