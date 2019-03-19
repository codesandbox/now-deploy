const { send, json, buffer } = require('micro')
const { router, get, post, del } = require('microrouter')
const axios = require('axios')
const microCors = require('micro-cors')
const winston = require('winston')
const makeHeaders = require('./utils/makeHeaders')
const makeAPiData = require('./utils/makeApiData')

const logger = winston.createLogger({
  transports: [new winston.transports.Console()]
})

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

    logger.log('info', 'Alias Successful', data)

    send(res, 200, {
      url: `https://${data.alias}`
    })
  } catch (e) {
    logger.log('error', 'Alias Unsuccessful', e)
    send(res, 500, { error: 'There was a problem aliasing your domain' })
  }
}

const getAlias = async (req, res) => {
  const { token } = req.query
  const { id } = req.params
  try {
    const data = await getAliasCall(id, token)

    logger.log('info', 'Get Alias Successful', data)
    send(res, 200, data)
  } catch (e) {
    logger.log('error', 'Get Alias Unsuccessful', e)
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

    logger.log('info', 'Deployment Deleted', data)
    send(res, 200, data)
  } catch (e) {
    logger.log('error', 'Deployment Deletion error', e)
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

    logger.log('info', 'Deployments Gotten Succefully', deploys)
    send(res, 200, { deploys })
  } catch (e) {
    logger.log('error', 'Error getting deployments', e)
    send(res, 500, { error: 'There was a problem getting your aliases' })
  }
}

const createDeployment = async (req, res) => {
  const { token, id, distDir } = req.query
  const file = await buffer(req)
  const apiData = await makeAPiData(file, id, distDir)
  const version = apiData.version === 2 ? 'v6' : 'v3'

  try {
    const { data } = await axios.post(
      `${url}/${version}/now/deployments?forceNew=1`,
      apiData,
      makeHeaders(token)
    )

    logger.log('info', 'Deployment created', data)
    send(res, 200, data)
  } catch (e) {
    logger.log('info', 'error in creating Deployment created', e)
    send(res, 500, { error: 'There was a deploying your sandbox' })
  }
}

module.exports = cors(
  router(
    get('/', (req, res) => {
      send(res, 200, { ok: true })
    }),
    post('/alias/:id', alias),
    get('/alias/:id', getAlias),
    get('/deployments', getDeployments),
    post('/deployments', createDeployment),
    del('/deployments/:id', deleteDeployment)
  )
)
