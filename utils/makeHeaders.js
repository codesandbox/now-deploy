module.exports = (token, ...rest) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    ...rest
  }
})
