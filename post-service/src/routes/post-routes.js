const express = require('express')
const {
  createPost,
  getAllPost,
  getPost,
  deletePost,
  softDeletePost,
} = require('../controllers/post-controller')
const { authenticateRequest } = require('../middleware/auth-middleware')

const router = express.Router()

//middleware -> this will tell if a user is an auth user
router.use(authenticateRequest)
router.post('/', createPost)
router.get('/', getAllPost)
router.get('/:id', getPost)
router.delete('/:id', deletePost)
router.delete('/:id/soft', softDeletePost)

module.exports = router
