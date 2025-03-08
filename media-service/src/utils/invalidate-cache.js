const invalidateMediaCache = async (req, input) => {
  const cachedKey = `media:${input}`
  await req.redisClient.del(cachedKey)
  const keys = await req.redisClient.keys('media:*')
  if (keys.length > 0) {
    await req.redisClient.del(keys)
  }
}

module.exports = invalidateMediaCache
