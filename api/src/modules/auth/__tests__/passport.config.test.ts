import { isOAuthProviderEnabled } from '../passport.config'

describe('isOAuthProviderEnabled', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  describe('google provider', () => {
    it('returns true when flag is "true" and credentials are non-empty', () => {
      process.env.GOOGLE_APP_ENABLE = 'true'
      process.env.GOOGLE_APP_ID = 'fake-google-id'
      process.env.GOOGLE_APP_SECRET = 'fake-google-secret'

      expect(isOAuthProviderEnabled('google')).toBe(true)
    })

    it('returns false when flag is "false" (even with credentials)', () => {
      process.env.GOOGLE_APP_ENABLE = 'false'
      process.env.GOOGLE_APP_ID = 'fake-google-id'
      process.env.GOOGLE_APP_SECRET = 'fake-google-secret'

      expect(isOAuthProviderEnabled('google')).toBe(false)
    })

    it('returns false when flag is unset', () => {
      delete process.env.GOOGLE_APP_ENABLE
      process.env.GOOGLE_APP_ID = 'fake-google-id'
      process.env.GOOGLE_APP_SECRET = 'fake-google-secret'

      expect(isOAuthProviderEnabled('google')).toBe(false)
    })

    it('returns false when flag is "true" but credentials are empty', () => {
      process.env.GOOGLE_APP_ENABLE = 'true'
      process.env.GOOGLE_APP_ID = ''
      process.env.GOOGLE_APP_SECRET = ''

      expect(isOAuthProviderEnabled('google')).toBe(false)
    })

    it('returns false when flag is "true" but secret is missing', () => {
      process.env.GOOGLE_APP_ENABLE = 'true'
      process.env.GOOGLE_APP_ID = 'fake-google-id'
      delete process.env.GOOGLE_APP_SECRET

      expect(isOAuthProviderEnabled('google')).toBe(false)
    })
  })

  describe('facebook provider', () => {
    it('returns true when flag is "true" and credentials are non-empty', () => {
      process.env.FACEBOOK_APP_ENABLE = 'true'
      process.env.FACEBOOK_APP_ID = 'fake-fb-id'
      process.env.FACEBOOK_APP_SECRET = 'fake-fb-secret'

      expect(isOAuthProviderEnabled('facebook')).toBe(true)
    })

    it('returns false when flag is "false"', () => {
      process.env.FACEBOOK_APP_ENABLE = 'false'
      process.env.FACEBOOK_APP_ID = 'fake-fb-id'
      process.env.FACEBOOK_APP_SECRET = 'fake-fb-secret'

      expect(isOAuthProviderEnabled('facebook')).toBe(false)
    })

    it('returns false when credentials are empty', () => {
      process.env.FACEBOOK_APP_ENABLE = 'true'
      process.env.FACEBOOK_APP_ID = ''
      process.env.FACEBOOK_APP_SECRET = ''

      expect(isOAuthProviderEnabled('facebook')).toBe(false)
    })
  })
})
