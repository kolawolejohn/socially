const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const RefreshToken = require('../models/RefreshToken')

const generateTokens = async (user) => {
  try {
    // Generate access token
    const accessToken = jwt.sign(
      {
        userId: user._id,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: '60m' } // Fixed typo: 'expressIn' -> 'expiresIn'
    )

    // Generate refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Set expiration to 7 days from now

    // Save refresh token to the database
    await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt,
    })

    // Return tokens
    return { accessToken, refreshToken }
  } catch (error) {
    logger.error('Registration error occurred', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  }
}

module.exports = generateTokens
