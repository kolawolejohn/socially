const express = require('express')
const { searchPosts } = require('../controllers/search-controller')
const { authenticateRequest } = require('../middleware/auth-middleware')

const router = express.Router()

router.use(authenticateRequest)
router.get('/posts', searchPosts)

module.exports = router
