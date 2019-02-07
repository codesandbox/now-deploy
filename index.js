const { send, json, buffer } = require('micro')
const { router, get, post, del } = require('microrouter')
const axios = require('axios')
const microCors = require('micro-cors')
const makeHeaders = require('./utils/makeHeaders')

const cors = microCors()

const url = `https://api.zeit.co`

const alias = async (req, res) => {
  const { token } = req.query
  const { alias } = await json(req)
  try {
    const { data } = await axios.post(
      `${url}/v2/now/deployments/${req.params.id}/aliases`,
      { alias },
      makeHeaders(token)
    )

    send(res, 200, {
      url: `https://${data.alias}`
    })
  } catch (e) {
    send(res, 500, { error: 'There was a problem aliasing your domain' })
  }
}

const getAlias = async (req, res) => {
  const { token } = req.query
  const { id } = req.params
  try {
    const { data } = await axios.get(
      `${url}/v2/now/deployments/${id}/aliases`,
      makeHeaders(token)
    )

    send(res, 200, data)
  } catch (e) {
    send(res, 500, { error: 'There was a problem getting your aliases' })
  }
}

const deleteDeployment = async (req, res) => {
  const { token } = req.query
  const id = req.params.id.split('/')[0]
  try {
    const { data } = await axios.delete(
      `${url}/v2/now/deployments/${id}`,
      makeHeaders(token)
    )

    send(res, 200, data)
  } catch (e) {
    send(res, 500, { error: 'There was a problem deleting your deployment' })
  }
}

module.exports = cors(
  router(
    post('/alias/:id', alias),
    get('/alias/:id', getAlias),
    del('/deployments/:id', deleteDeployment)
  )
)
