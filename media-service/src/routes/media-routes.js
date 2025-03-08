const express = require('express')

const {
  uploadMedia,
  getAllMediaFromCloudinary,
} = require('../controllers/media-controller')
const { authenticateRequest } = require('../middleware/auth-middleware')
const { uploadErrorCheck } = require('../middleware/upload-error-check')

const router = express.Router()

router.post('/uploads', authenticateRequest, uploadErrorCheck, uploadMedia)
router.get('/all', authenticateRequest, getAllMediaFromCloudinary)

module.exports = router
