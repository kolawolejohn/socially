require('dotenv').config()
const mongoose = require('mongoose')
const logger = require('./utils/logger')
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const { RateLimiterRedis } = require('rate-limiter-flexible')
const Redis = require('ioredis')
const { rateLimit } = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const routes = require('./routes/identity-service')
const errorHandler = require('./middleware/errorhandler')

const app = express()
const PORT = process.env.PORT

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => logger.info('Connected to mongodb'))
  .catch((error) => logger.error('Mongo connection error', error))

const redisClient = new Redis(process.env.REDIS_URL)

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`)
  logger.info(`Received body, ${req.body}`)
  next()
})

//DDOS protection and rate limiting
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'middleware',
  points: process.env.REDIS_RATE_LIMIT_POINT, //number of request
  duration: process.env.REDIS_RATE_LIMIT_DURATION, // time
})

app.use((req, res, next) => {
  rateLimiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`)
      res.status(429).json({
        success: false,
        message: 'Too many requests',
      })
    })
})

//Ip bases rate limiting for sensitive endpoints
const sensitiveEndpointsLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS,
  max: process.env.RATE_LIMIT_MAX, //time limit for rate limit in milliseconds
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

//apply sensitive endpoint limiter
app.use('/api/auth/register', sensitiveEndpointsLimiter)

app.use('/api/auth', routes)

app.post('/test', (req, res) => {
  res.json({ message: 'Test endpoint works', body: req.body })
})

app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Identity service running on port ${PORT}`)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at`, promise, 'reason:', reason)
})
