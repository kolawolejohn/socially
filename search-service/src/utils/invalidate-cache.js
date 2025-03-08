const invalidateSearchCache = async (req, query) => {
  const cachedKey = `search:${query}`
  await req.redisClient.del(cachedKey)
  const keys = await req.redisClient.keys('search:*')
  if (keys.length > 0) {
    await req.redisClient.del(keys)
  }
}

module.exports = invalidateSearchCache
