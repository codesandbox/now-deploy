var omit = require('lodash.omit')
var JSZip = require('JSZip')
var jsZip = new JSZip()

/**
 * Alter the apiData to ZEIT for making deployment work
 */
const alterDeploymentData = (apiData, distDir) => {
  const packageJSONFile = apiData.files.find(x => x.file === 'package.json')
  const parsedFile = JSON.parse(packageJSONFile.data)

  const newParsedFile = {
    ...parsedFile,
    devDependencies: {
      ...parsedFile.devDependencies,
      serve: '^10.1.1'
    },
    scripts: {
      'now-start': `cd ${distDir} && serve -s ./`,
      ...parsedFile.scripts
    }
  }

  return {
    ...apiData,
    files: [
      ...apiData.files.filter(x => x.file !== 'package.json'),
      {
        file: 'package.json',
        data: JSON.stringify(newParsedFile, null, 2)
      }
    ]
  }
}

module.exports = async (file, id, distDir) => {
  const contents = await jsZip.loadAsync(file)

  let apiData = {
    files: []
  }

  let packageJSON = {}
  let nowJSON = {}
  const projectPackage = contents.files['package.json']
  const nowFile = contents.files['now.json']

  if (projectPackage) {
    const data = await projectPackage.async('text')

    const parsed = JSON.parse(data)
    packageJSON = parsed
  }

  if (nowFile) {
    const data = await nowFile.async('text')

    const parsed = JSON.parse(data)
    nowJSON = parsed
  } else if (packageJSON.now) {
    // Also support package.json if imported like that
    nowJSON = packageJSON.now
  }
  const nowDefaults = {
    name: `csb-${id}`,
    public: true
  }

  const filePaths = nowJSON.files || Object.keys(contents.files)

  // We'll omit the homepage-value from package.json as it creates wrong assumptions over the now deployment environment.
  packageJSON = omit(packageJSON, 'homepage')

  // We force the sandbox id, so ZEIT will always group the deployments to a
  // single sandbox
  packageJSON.name = nowJSON.name || nowDefaults.name

  apiData.name = nowJSON.name || nowDefaults.name
  apiData.deploymentType = nowJSON.type || nowDefaults.type
  apiData.public = nowJSON.public || nowDefaults.public

  // if now v2 we need to tell now the version, builds and routes
  if (nowJSON.version === 2) {
    apiData.version = 2
    apiData.builds = nowJSON.builds
    apiData.routes = nowJSON.routes
  } else {
    apiData.config = omit(nowJSON, ['public', 'type', 'name', 'files'])
    apiData.forceNew = true
  }

  if (!nowJSON.files) {
    apiData.files.push({
      file: 'package.json',
      data: JSON.stringify(packageJSON, null, 2)
    })
  }

  for (let i = 0; i < filePaths.length; i += 1) {
    const filePath = filePaths[i]
    const file = contents.files[filePath]

    if (!file.dir && filePath !== 'package.json') {
      const data = await file.async('base64')

      apiData.files.push({ file: filePath, data, encoding: 'base64' })
    }
  }

  if (alterDeploymentData && nowJSON.version !== 2) {
    apiData = alterDeploymentData(apiData, distDir)
  }

  return apiData
}
