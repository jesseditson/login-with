const express = require('express')
const passport = require('passport')
const cookieParser = require('cookie-parser')
const expressSession = require('express-session')
const MemoryStore = require('session-memory-store')(expressSession)
const routes = require('./src/routes')

const port = parseInt(process.argv[2], 10) || 3000

const profileCookieName = process.env.LW_PROFILE_COOKIENAME || 'profile'
const tokenCookieName = process.env.LW_JWT_COOKIENAME || 'jwt'
const tokenSecret = process.env.LW_JWT_SECRET
const sessionSecret = process.env.LW_SESSION_SECRET
const subDomain = process.env.LW_SUBDOMAIN || `localhost:${port}`
const cookieDomain = process.env.LW_SUBDOMAIN ? '.' + subDomain.split('.').slice(1).join('.') : null
const protocol = process.env.LW_SUBDOMAIN ? 'https:/' : 'http:/'
const tenDays = 1000 * 60 * 60 * 24 * 10
const maxAge = process.env.LW_COOKIE_MAXAGE || tenDays

if (!tokenSecret) {
  console.error('no LW_TOKEN_SECRET env variable specified')
  process.exit(1)
}

if (!sessionSecret) {
  console.error('no LW_SESSION_SECRET env variable specified')
  process.exit(1)
}

const rootUrl = protocol + '/' + subDomain

console.log(`Using subdomain "${rootUrl}" for callback urls`)

const strategies = require('./src/strategies')(process.env, rootUrl)
console.log(`Configured strategies: ${strategies.map(strategy => strategy.type).join('/')}`)

strategies.forEach(strategy => {
  passport.use(new strategy.Ctor(strategy.config, strategy.toUser))
  console.log(`Using login with "${strategy.type}" strategy`)
})

passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user))

const app = express()
app.use(cookieParser())
app.use(expressSession({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore()
}))
app.use(passport.initialize())

if (strategies.length > 0) {
  app.get(
    strategies.map(strategy => `/${strategy.type}`),
    routes.onAuthenticationRequest({
      strategies,
      passport,
      tokenSecret,
      tokenCookieName,
      profileCookieName,
      cookieDomain,
      maxAge
    })
  )

  app.get(
    strategies.map(strategy => `/${strategy.type}/callback`),
    routes.onAuthenticationCallback({
      strategies,
      passport,
      tokenSecret,
      tokenCookieName,
      profileCookieName,
      cookieDomain,
      maxAge
    })
  )

  app.get('/logout', routes.onLogout({tokenCookieName, profileCookieName, cookieDomain}))
  app.get('/', routes.onIndex({tokenCookieName, profileCookieName}))
}

app.listen(port)
