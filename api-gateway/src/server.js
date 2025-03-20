require('dotenv').config()
const express = require('express')
const cors = require('cors')
const Redis = require('ioredis')
const helmet = require('helmet')
const { rateLimit } = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const logger = require('./utils/logger')
const proxy = require('express-http-proxy')
const errorHandler = require('./middleware/errorHandler')
const { validateToken } = require('./middleware/auth-middleware')

const app = express()

const PORT = process.env.PORT

const redisClient = new Redis(process.env.REDIS_URL)

app.use(helmet())
app.use(cors())
app.use(express.json())

const rateLimitOptions = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
  max: parseInt(process.env.RATE_LIMIT_MAX), //time limit for rate limit in milliseconds
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`)
    res.status(429).json({
      success: false,
      message: 'Too many requests',
    })
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    })
  },
})

app.use(rateLimitOptions)

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`)
  logger.info(`Received body, ${req.body}`)
  next()
})

const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/^\/v1/, '/api')
  },
  proxyErrorHandler: (err, res, next) => {
    logger.error(`Proxy error: ${err.message}`)
    res.status(500).json({
      success: false,
      message: `Internal server error`,
      error: err.message,
    })
    next(err)
  },
}

//setting up proxy for identity service
app.use(
  '/v1/auth',
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers['Content-Type'] = 'application/json'
      return proxyReqOpts
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Identity service: ${proxyRes.statusCode}`
      )
      return proxyResData
    },
  })
)

//setting up proxy for post service
app.use(
  '/v1/posts',
  validateToken,
  proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers['Content-Type'] = 'application/json'
      proxyReqOpts.headers['x-user-id'] = srcReq.user.userId
      return proxyReqOpts
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(`Response received from Post service: ${proxyRes.statusCode}`)
      return proxyResData
    },
  })
)

//setting up proxy for media service
app.use(
  '/v1/media',
  validateToken,
  proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers['x-user-id'] = srcReq.user.userId
      if (!srcReq.headers['content-type'].startsWith('multipart/form-data')) {
        proxyReqOpts.headers['Content-Type'] = 'application/json'
      }
      return proxyReqOpts
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from media service: ${proxyRes.statusCode}`
      )
      return proxyResData
    },
    parseReqBody: false,
  })
)

//setting up proxy for search service
app.use(
  '/v1/search',
  validateToken,
  proxy(process.env.SEARCH_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers['x-user-id'] = srcReq.user.userId
      proxyReqOpts.headers['Content-Type'] = 'application/json'
      return proxyReqOpts
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from media service: ${proxyRes.statusCode}`
      )
      return proxyResData
    },
    parseReqBody: false,
  })
)

app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Apigateway running on port ${PORT}\n`)
  logger.info(
    `Identity service running on  ${process.env.IDENTITY_SERVICE_URL}\n`
  ),
    logger.info(`Post service running on  ${process.env.POST_SERVICE_URL}\n`),
    logger.info(
      `Media service running on port ${process.env.MEDIA_SERVICE_URL}\n`
    )
  logger.info(
    `Search service running on port ${process.env.SEARCH_SERVICE_URL}\n`
  )
  logger.info(`Redis Url ${process.env.REDIS_URL}`)
})
