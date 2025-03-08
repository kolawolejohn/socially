const Joi = require('joi')

const validateCreatePost = (data) => {
  const schema = Joi.object({
    publicKey: Joi.string().required(),
  })

  return schema.validate(data)
}

module.exports = { validateCreatePost }
