import passport from 'passport'
import { Strategy as FacebookStrategy } from 'passport-facebook'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as LocalStrategy } from 'passport-local'

import { findOrCreateOAuthUser, validateCredentials } from './auth.service'

/**
 * Returns whether a given OAuth provider should be registered.
 * v2.5+: provider only registers when its `*_APP_ENABLE` flag is `'true'`
 * AND the credentials (`*_APP_ID` + `*_APP_SECRET`) are non-empty.
 */
export function isOAuthProviderEnabled(provider: 'google' | 'facebook'): boolean {
  if (provider === 'google') {
    return (
      process.env.GOOGLE_APP_ENABLE === 'true' &&
      !!process.env.GOOGLE_APP_ID &&
      !!process.env.GOOGLE_APP_SECRET
    )
  }
  return (
    process.env.FACEBOOK_APP_ENABLE === 'true' &&
    !!process.env.FACEBOOK_APP_ID &&
    !!process.env.FACEBOOK_APP_SECRET
  )
}

export function configurePassport() {
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await validateCredentials(email, password)
        done(null, user as unknown as Express.User)
      } catch (err) {
        done(err)
      }
    })
  )

  if (isOAuthProviderEnabled('google')) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_APP_ID!,
          clientSecret: process.env.GOOGLE_APP_SECRET!,
          // Placeholder — o callbackURL real é calculado em auth.routes.ts a partir do host do request
          callbackURL: '/api/v1/auth/google/callback',
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value
            if (!email) return done(new Error('Email não encontrado no perfil Google'))

            const result = await findOrCreateOAuthUser({
              email,
              name: profile.displayName,
              provider: 'google',
              providerId: profile.id,
            })

            // Pass tokens through passport user so controller can redirect
            done(null, { accessToken: result.accessToken, refreshToken: result.refreshToken } as unknown as Express.User)
          } catch (err) {
            done(err as Error)
          }
        }
      )
    )
  }

  if (isOAuthProviderEnabled('facebook')) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_APP_ID!,
          clientSecret: process.env.FACEBOOK_APP_SECRET!,
          // Placeholder — o callbackURL real é calculado em auth.routes.ts a partir do host do request
          callbackURL: '/api/v1/auth/facebook/callback',
          profileFields: ['id', 'emails', 'name', 'displayName'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value
            if (!email) return done(new Error('Email não encontrado no perfil Facebook'))

            const result = await findOrCreateOAuthUser({
              email,
              name: profile.displayName,
              provider: 'facebook',
              providerId: profile.id,
            })

            done(null, { accessToken: result.accessToken, refreshToken: result.refreshToken } as unknown as Express.User)
          } catch (err) {
            done(err as Error)
          }
        }
      )
    )
  }

  // Minimal serialization (stateless JWT — only needed for passport internals)
  passport.serializeUser((user, done) => done(null, user))
  passport.deserializeUser((user, done) => done(null, user as Express.User))
}
