const multer = require('multer')

const logger = require('../utils/logger')
const { upload } = require('../utils/upload-multer')

const uploadErrorCheck = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      logger.error('Multer error while uploading...', err)
      return res.status(400).json({
        stack: err.stack,
        message: 'Multer error while uploading...',
        error: err.message,
      })
    } else if (err) {
      logger.error('Unkown error occured while uploading...', err)
      return res.status(500).json({
        stack: err.stack,
        message: 'Unkown error occured while uploading...',
        error: err.message,
      })
    }

    if (!req.file) {
      return res.status(400).json({
        success: failed,
        message: 'File not found',
      })
    }

    next()
  })
}

module.exports = { uploadErrorCheck }
