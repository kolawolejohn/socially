const Media = require('../models/Media')
const { uploadMediaToCloudinary } = require('../utils/cloudinary')
const logger = require('../utils/logger')

const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      logger.error('File not found')
      return res.status(400).json({
        success: false,
        message: 'File not found',
      })
    }

    const { originalname, mimetype, buffer } = req.file
    const userId = req.user.userId

    logger.info(`file details: name=${originalname}, type=${mimetype}`)
    logger.info(`Uploading to cloudinary starting..`)

    const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file)
    logger.info(
      `Cloudinary upload successful... Public Id: ${cloudinaryUploadResult.public_id}`
    )

    const newlyCreatedMedia = new Media({
      publicId: cloudinaryUploadResult.public_id,
      originalName: originalname,
      mimeType: mimetype,
      url: cloudinaryUploadResult.secure_url,
      userId,
    })

    await newlyCreatedMedia.save()

    res.status(201).json({
      success: true,
      message: 'New Media uploaded successfully',
      mediaId: newlyCreatedMedia._id,
      url: newlyCreatedMedia.url,
    })
  } catch (error) {
    logger.error('Error occured uploading media')
    return res.status(500).json({
      success: false,
      message: 'Error occured uploading media',
    })
  }
}

const getAllMediaFromCloudinary = async (req, res) => {
  try {
    const results = await Media.find({})
    res.json({ results })
  } catch (error) {
    logger.error('Error occured ufetching media')
    return res.status(500).json({
      success: false,
      message: 'Error occured ufetching media',
    })
  }
}

module.exports = { uploadMedia, getAllMediaFromCloudinary }
