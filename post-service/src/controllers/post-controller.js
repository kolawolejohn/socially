require('dotenv').config()
const logger = require('../utils/logger')
const Post = require('../models/Post')
const { validateCreatePost } = require('../utils/validation')
const invalidatePostCache = require('../utils/invalidate-cache')
const { publishEvent } = require('../utils/rabbitmq')

const createPost = async (req, res) => {
  logger.info('Create post endpoint hit...')

  try {
    const { error } = validateCreatePost(req.body)
    if (error) {
      logger.warn('Validation error', error.details[0].message)
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      })
    }

    const { content, mediaIds } = req.body
    const newlyCreatedPost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    })

    await newlyCreatedPost.save()

    //publish post create method
    await publishEvent(`post.created`, {
      postId: newlyCreatedPost.id.toString(),
      userId: newlyCreatedPost.user.toString(),
      content: newlyCreatedPost.content,
      createdAt: newlyCreatedPost.createdAt,
    })

    await invalidatePostCache(req, newlyCreatedPost.id.toString())
    logger.info('Post created successfully...')
    res.status(201).json({
      success: true,
      message: 'Post created successfully...',
    })
  } catch (error) {
    logger.error(`Error creating post`, error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  }
}

const getAllPost = async (req, res) => {
  logger.info('Request get all posts hit...')
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const startIndex = (page - 1) * limit
    const cacheKey = `posts:${page}:${limit}`
    const cacheDuration =
      parseInt(process.env.GET_ALL_POSTS_CACHE_DURATION) || 300

    // Check cache
    const cachedPosts = await req.redisClient.get(cacheKey)
    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts))
    }

    // Fetch posts from database
    logger.info('Fetching posts from database...')
    const posts = await Post.find({ deletedAt: null })
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
    logger.info('Posts fetched successfully')

    // Get total number of posts
    const totalNumberOfPosts = await Post.countDocuments({ deletedAt: null })
    const totalPages = Math.ceil(totalNumberOfPosts / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    const result = {
      posts,
      currentPage: page,
      hasNextPage,
      hasPreviousPage,
      totalPages,
      totalPosts: totalNumberOfPosts,
    }

    // Cache the result
    await req.redisClient.setex(cacheKey, cacheDuration, JSON.stringify(result))

    return res.json(result)
  } catch (error) {
    logger.error(`Error fetching posts`, error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error, error fetching posts',
    })
  }
}

const getPost = async (req, res) => {
  logger.info('Get post endpoint hit...')

  try {
    const postId = req.params.id
    const cacheKey = `post:${postId}`
    const cachedPost = await req.redisClient.get(cacheKey)
    const cacheDuration = parseInt(process.env.GET_POST_CACHE_DURATION) || 3600
    if (isNaN(cacheDuration)) {
      logger.warn('Invalid GET_POST_CACHE_DURATION environment variable')
      throw new Error('Invalid GET_POST_CACHE_DURATION environment variable')
    }

    if (cachedPost) {
      logger.info('Posts fetched from cache')
      return res.json(JSON.parse(cachedPost))
    }

    const post = await Post.findById(postId)

    if (!post) {
      logger.warn('Post not found')
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      })
    }

    logger.info('Post set to cache')
    await req.redisClient.setex(cachedPost, cacheDuration, JSON.stringify(post))

    logger.info('Post fetched successfully')
    return res.json(post)
  } catch (error) {
    logger.error(`Error fetching post`, error)
    res.status(500).json({
      success: false,
      message: 'Internal server error, error fetching post by id',
    })
  }
}

const deletePost = async (req, res) => {
  logger.info('Request delete post hit...')

  try {
    const postId = req.params.id

    const post = await Post.findOneAndDelete({
      _id: postId,
      user: req.user.userId,
    })

    if (!post) {
      logger.warn('Post not found')
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      })
    }

    //publish post delete method
    await publishEvent(`post.deleted`, {
      postId: post._id.toString(),
      userId: req.user.userId,
      mediaIds: post.mediaIds,
    })

    await invalidatePostCache(req, postId.toString())

    // Send success response
    return res.json({
      success: true,
      message: 'Post deleted successfully',
    })
  } catch (error) {
    logger.error(`Error fetching post`, error)
    res.status(500).json({
      success: false,
      message: 'Internal server error, error deleting post',
    })
  }
}

const softDeletePost = async (req, res) => {
  logger.info('Request delete post hit...')

  try {
    const postId = req.params.id

    // Find the post in the database
    const post = await Post.findById(postId)

    if (!post) {
      logger.warn(`Post not found with ID: ${postId}`)
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      })
    }

    // Soft delete the post by setting deletedAt to the current date
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { deletedAt: new Date() },
      { new: true } // Return the updated document
    )

    if (!updatedPost) {
      logger.warn(`Post not found with ID: ${postId}`)
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      })
    }

    await invalidatePostCache(req, postId.toString())

    logger.info(
      `Soft deleted post with ID: ${postId}, deletedAt: ${updatedPost.deletedAt}`
    )

    // Send success response
    return res.json({
      success: true,
      message: 'Post soft deleted successfully',
    })
  } catch (error) {
    logger.error(`Error soft deleting post`, error)
    return res.status(500).json({
      success: false,
      message: 'Internal server error, error soft deleting post',
    })
  }
}

module.exports = { createPost, getAllPost, getPost, deletePost, softDeletePost }
