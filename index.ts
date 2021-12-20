import { cruise, ICruiseResult, IDependency } from 'dependency-cruiser'
import * as path from 'path'
import * as fs from 'fs'

interface Config {
  source: string
  base: string
}

function getConfig(): Config {
  const index = process.argv.findIndex(
    (arg) => arg === '-c' || arg === '--config',
  )
  const configFilePath =
    index !== -1 && process.argv.length >= index + 2
      ? process.argv[index + 1]
      : './config.json'

  const config: Config = JSON.parse(fs.readFileSync(configFilePath).toString())

  if (config.base.includes('$HOME')) {
    config.base = config.base.replace(
      '$HOME',
      process.env.HOME ? process.env.HOME : '',
    )
  }
  if (config.source.includes('$HOME')) {
    config.source = config.source.replace(
      '$HOME',
      process.env.HOME ? process.env.HOME : '',
    )
  }

  return config
}

interface Relation {
  source: string
  target: string
  kind?: string
  location?: string
}

function isExternalLib(dep: IDependency): boolean {
  return (
    dep.dependencyTypes[0] === 'core' || dep.dependencyTypes[0].includes('npm')
  )
}

function isCore(dep: IDependency): boolean {
  return dep.dependencyTypes[0] === 'core'
}

function resolveModule(
  module: string,
  base: string,
  removeNodeModules?: boolean,
): string {
  const result = path.resolve(module).replace(base, '')
  return removeNodeModules ? result.replace('/node_modules/', '') : result
}

async function extractCallgraph(config: Config) {
  try {
    const result = cruise([config.source])
    const output = result.output as ICruiseResult
    // const depsCount = output.modules.reduce((acc, module) => {
    //   return acc + module.dependencies.length
    // }, 0)

    // console.log(depsCount)

    const relations: Relation[] = []
    output.modules
      .filter(
        (module) =>
          module.source.includes('fabric-gateway-v2/src/') &&
          module.dependencies.filter(isExternalLib).length > 0,
      )
      .forEach((module) => {
        const source = module.source.includes('./')
          ? resolveModule(module.source, config.base)
          : module.source

        const newRelations = module.dependencies
          .filter(isExternalLib)
          .map((dep) =>
            isCore(dep)
              ? dep.resolved
              : resolveModule(dep.resolved, config.base, true),
          )
          .map((target) => ({ source, target, location: source }))

        relations.push(...newRelations)
      })

    relations.forEach((relation) => console.log(JSON.stringify(relation)))
  } catch (err) {
    console.error(err)
  }
}

const config = getConfig()
extractCallgraph(config)
