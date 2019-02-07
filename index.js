const { send, json } = require('micro')
const { router, get, post, del } = require('microrouter')
const axios = require('axios')
const microCors = require('micro-cors')
const makeHeaders = require('./utils/makeHeaders')

const cors = microCors()

const url = `https://api.zeit.co`

const getAliasCall = async (id, token) => {
  const { data } = await axios.get(
    `${url}/v2/now/deployments/${id}/aliases`,
    makeHeaders(token)
  )

  return data
}

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
    const data = await getAliasCall(id, token)

    send(res, 200, data)
  } catch (e) {
    send(res, 500, { error: 'There was a problem getting your aliases' })
  }
}

const deleteDeployment = async (req, res) => {
  const { token } = req.query
  // micro adds a trailing slash
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

const getDeployments = async (req, res) => {
  const { token, name } = req.query
  try {
    const {
      data: { deployments }
    } = await axios.get(`${url}/v3/now/deployments`, makeHeaders(token))

    const deploysNoAlias = deployments
      .filter(d => d.name === name)
      .sort((a, b) => (a.created < b.created ? 1 : -1))

    const assignAlias = async deployment => {
      const alias = await getAliasCall(deployment.uid, token)
      return {
        ...deployment,
        alias: alias.aliases
      }
    }

    const sandboxAlias = await deploysNoAlias.map(assignAlias)
    const deploys = await Promise.all(sandboxAlias)

    send(res, 200, { deploys })
  } catch (e) {
    console.log(e)
    send(res, 500, { error: 'There was a problem getting your aliases' })
  }
}

module.exports = cors(
  router(
    post('/alias/:id', alias),
    get('/alias/:id', getAlias),
    get('/deployments', getDeployments),
    del('/deployments/:id', deleteDeployment)
  )
)
