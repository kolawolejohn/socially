const Joi = require('joi')

const validateRegisteration = (data) => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  })

  return schema.validate(data)
}

const validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  })

  return schema.validate(data)
}

module.exports = { validateRegisteration, validateLogin }
