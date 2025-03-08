const RefreshToken = require('../models/RefreshToken')
const User = require('../models/User')
const generateTokens = require('../utils/generateToken')
const logger = require('../utils/logger')
const { validateRegisteration, validateLogin } = require('../utils/validation')

const registerUser = async (req, res) => {
  logger.info(`Registration endpoint hit...`)
  try {
    // Validate the schema
    const { error } = validateRegisteration(req.body)
    if (error) {
      logger.warn('Validation error', error.details[0].message)
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      })
    }

    const { username, email, password } = req.body

    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { username }] })
    if (user) {
      logger.warn('User already exists')
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      })
    }

    // Create a new user
    user = new User({ username, email, password })
    await user.save()
    logger.info('User saved successfully', user._id)

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user)

    // Respond with success
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      refreshToken,
    })
  } catch (error) {
    logger.error('Registration error occurred', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  }
}

const loginUser = async (req, res) => {
  logger.info('Login endpoint hit...')

  try {
    const { error } = validateLogin(req.body)
    if (error) {
      logger.warn('Validation error', error.details[0].message)
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      })
    }

    const { email, password } = req.body
    let user = await User.findOne({ email })
    if (!user) {
      logger.warn('Invalid user')
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials',
      })
    }

    const isValidPassword = await user.comparePassword(password)
    if (!isValidPassword) {
      logger.warn('Invalid password')
      return res.status(400).json({
        success: false,
        message: 'Invalid password',
      })
    }

    const { accessToken, refreshToken } = await generateTokens(user)

    // Respond with tokens and user ID
    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      userId: user._id,
    })
  } catch (error) {
    logger.error('Login error occurred', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  }
}

const createNewRefreshToken = async (req, res) => {
  logger.info('RefreshToken endpoint hit...')
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      logger.warn('Refresh token missing')
      return res.status(400).json({
        success: false,
        message: 'Refresh token missing',
      })
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken })
    if (!storedToken || storedToken.expiresAt < new Date()) {
      logger.warn('Invalid or expired refresh token')
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      })
    }

    const user = await User.findById(storedToken.user)
    if (!user) {
      logger.warn('User not found')
      return res.status(400).json({
        success: false,
        message: 'User not found',
      })
    }

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateTokens(user)

    //delete the expired or old token
    await RefreshToken.deleteOne({ _id: storedToken._id })

    res.status(200).json({
      success: true,
      message: 'New refresh token generated',
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      userId: user._id,
    })
  } catch (error) {
    logger.error('Refresh token occurred', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  }
}

const logoutUser = async (req, res) => {
  logger.info('logout endpoint hit...')
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      logger.warn('Refresh token missing')
      return res.status(400).json({
        success: false,
        message: 'Refresh token missing',
      })
    }
    await RefreshToken.deleteOne({ token: refreshToken })
    logger.info('Refresh token deleted for logout')

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    logger.error('Error while on logout', error)
    res.status(500).json({
      success: false,
      message: 'Error while on logout',
    })
  }
}

module.exports = { registerUser, loginUser, createNewRefreshToken, logoutUser }
