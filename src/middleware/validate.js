function validate(schema) {
  return (req, res, next) => {
    if (!schema) return next();
    next();
  };
}

module.exports = { validate };
