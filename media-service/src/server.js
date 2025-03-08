require('dotenv').config()
const cors = require('cors')
const express = require('express')
const mongoose = require('mongoose')
const helmet = require('helmet')
const Redis = require('ioredis')
const { rateLimit } = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const logger = require('./utils/logger')
const mediaRoutes = require('./routes/media-routes')
const errorHandler = require('./middleware/errorhandler')
const { connectToRabbitMQ, consumeEvent } = require('./utils/rabbitmq')
const { handlePostDeleted } = require('./eventHandlers/media-event-handlers')

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

const rateLimitOptions = rateLimit({
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

app.use('/api/media', rateLimitOptions)

app.use(
  '/api/media',
  (req, res, next) => {
    req.redisClient = redisClient
    next()
  },
  mediaRoutes
)

app.use(errorHandler)

async function startServer() {
  try {
    await connectToRabbitMQ()
    await consumeEvent(`post.deleted`, handlePostDeleted)
    app.listen(PORT, () => {
      logger.info(`Media service running on port ${PORT}`)
    })
  } catch (error) {
    logger.error('Failed to connect to media service ...', error)
    process.exit(1)
  }
}

startServer()

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at`, promise, 'reason:', reason)
})
