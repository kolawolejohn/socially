const amqp = require('amqplib')
const logger = require('../utils/logger')

let connection = null
let channel = null

const EXCHANGE_NAME = 'x_events'

async function connectToRabbitMQ() {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL)
    channel = await connection.createChannel()

    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: false })
    logger.info('Connected to RabbitMQ ...')

    return channel
  } catch (error) {
    logger.error('Error connecting to rabbitmq', error)
  }
}

async function consumeEvent(routingKey, callback) {
  if (!channel) {
    await connectToRabbitMQ()
  }

  const q = await channel.assertQueue('', { exclusive: true })
  await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey)
  channel.consume(q.queue, (msg) => {
    if (msg !== null) {
      const content = JSON.parse(msg.content.toString())
      callback(content)
      channel.ack(msg)
    }
  })

  logger.info(`Subscribed to event: ${routingKey}`)
}

module.exports = { connectToRabbitMQ, consumeEvent }
