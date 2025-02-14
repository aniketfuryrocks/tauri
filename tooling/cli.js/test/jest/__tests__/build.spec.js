import path from 'path'
import * as fixtureSetup from '../fixtures/app-test-setup.js'
import { spawn } from 'helpers/spawn'

const appDir = path.join(fixtureSetup.fixtureDir, 'app')
const distDir = path.join(appDir, 'dist')

function runBuildTest(args) {
  fixtureSetup.initJest('app')
  console.log(2)
  return new Promise(async (resolve, reject) => {
    try {
      let success = false
      const { server, responses } = fixtureSetup.startServer(() => {
        success = true
        try {
          process.kill(appPid)
        } catch {}
        // wait for the app process to be killed
        setTimeout(resolve, 2000)
      })
      process.chdir(appDir)
      const { build } = await import('dist/api/cli')
      const { promise } = await build(args)
      await promise

      const artifactFolder = args.debug ? 'debug' : 'release'
      const artifactPath = path.resolve(
        appDir,
        `src-tauri/target/${artifactFolder}/app`
      )

      const appPid = spawn(
        process.platform === 'win32'
          ? `${artifactPath}.exe`
          : artifactPath.replace(
              `${artifactFolder}/app`,
              `${artifactFolder}/./app`
            ),
        [],
        null
      )

      setTimeout(() => {
        if (!success) {
          server.close(() => {
            try {
              process.kill(appPid)
            } catch {}
            const failedCommands = Object.keys(responses)
              .filter((k) => responses[k] === null)
              .join(', ')
            reject("App didn't reply to " + failedCommands)
          })
        }
      }, 15000)
    } catch (error) {
      reject(error)
    }
  })
}

describe('Tauri Build', () => {
  const build = {
    devPath: distDir,
    distDir: distDir,
    withGlobalTauri: true
  }

  it.each`
    mode                 | flag
    ${'custom-protocol'} | ${'debug'}
    ${'custom-protocol'} | ${'release'}
  `('works with the $mode $flag mode', ({ mode, flag }) => {
    return runBuildTest({
      debug: flag === 'debug',
      config: {
        build,
        tauri: {
          allowlist: {
            all: true
          }
        }
      }
    })
  })
})
