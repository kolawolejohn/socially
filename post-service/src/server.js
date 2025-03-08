require('dotenv').config()
const mongoose = require('mongoose')
const logger = require('./utils/logger')
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const Redis = require('ioredis')
const { rateLimit } = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const postRoutes = require('./routes/post-routes')
const errorHandler = require('./middleware/errorhandler')
const { connectToRabbitMQ } = require('./utils/rabbitmq')

const app = express()
const PORT = process.env.PORT

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => logger.info('Connected to mongodb ...'))
  .catch((error) => logger.error('Mongo connection error', error))

const redisClient = new Redis(process.env.REDIS_URL)

app.use(helmet())
app.use(cors())
app.use(express.json())

const rateLimitOptions = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS,
  max: process.env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`)
    res.status(429).json({
      success: false,
      message: 'Too many requests',
    })
  },
})

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`)
  logger.info(`Received body, ${req.body}`)
  next()
})

app.use('/api/posts', rateLimitOptions)

app.use(
  '/api/posts',
  (req, res, next) => {
    req.redisClient = redisClient
    next()
  },
  postRoutes
)

app.use(errorHandler)

async function startServer() {
  try {
    await connectToRabbitMQ()
    app.listen(PORT, () => {
      logger.info(`post service running on port ${PORT} ...`)
    })
  } catch (error) {
    logger.error('Failed to connect to server ...', error)
    process.exit(1)
  }
}

startServer()

// process.on('unhandledRejection', (reason, promise) => {
//   logger.error(`Unhandled Rejection at`, promise, 'reason:', reason)
// })
