const Search = require('../models/Search')
const logger = require('../utils/logger')
// const invalidateSearchCache = require('../utils/invalidate-cache')

const searchPosts = async (req, res) => {
  logger.info(`Search endpoint hit ...`)
  try {
    const { query } = req.query

    // Check if the query is empty or missing
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      })
    }

    console.log('Redis Client Ready:', req.redisClient.connected)

    const cacheKey = `search:${query}`
    const cachedDuration = parseInt(process.env.SEARCH_CACHE_DURATION) || 60
    console.log('Cache duration:', cachedDuration)

    const cachedResults = await req.redisClient.get(cacheKey)
    console.log('key:', cachedResults)

    if (cachedResults) {
      logger.info('Serving search results from cache')
      return res.json(JSON.parse(cachedResults))
    }

    const results = await Search.find(
      {
        $text: { $search: query },
      },
      {
        score: { $meta: `textScore` },
      }
    )
      .sort({
        score: { $meta: `textScore` },
      })
      .limit(10)

    logger.info('Search results fetched successfully')
    const isSet = await req.redisClient.setex(
      cacheKey,
      cachedDuration,
      JSON.stringify(results)
    )
    console.log('Cache set result:', isSet)
    res.json({
      success: true,
      data: results,
    })
  } catch (error) {
    logger.error('Error while searching post')
    return res.status(500).json({
      success: false,
      message: 'Error while searching post',
    })
  }
}

module.exports = { searchPosts }
