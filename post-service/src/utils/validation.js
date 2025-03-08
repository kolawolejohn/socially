const Joi = require('joi')

const validateCreatePost = (data) => {
  const schema = Joi.object({
    content: Joi.string().min(2).max(3000).required(),
    mediaIds: Joi.array(),
  })

  return schema.validate(data)
}

module.exports = { validateCreatePost }
