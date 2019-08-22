import { promisify } from 'util'
import * as path from 'path'

import * as fs from 'fs-extra'
import got from 'got'
import ProgressBar from 'progress'
import extractC from 'extract-zip'
import globC from 'glob'

type supportedPlastform = 'darwin' | 'linux' | 'win32'

const platformMap : { [key in supportedPlastform]: string } = {
  win32: process.arch === 'x64' ? 'windows-x86_64' : 'windows-i386',
  linux: 'linux',
  darwin: 'macOS'
}

const filterAssets = asset => {
  const archStr = platformMap[process.platform] || platformMap.linux
  return asset.name.indexOf(archStr) >= 0 && asset.name.indexOf('.zip') >= 0;
}

const extract = promisify(extractC)
const glob = promisify(globC)

async function run () {
  const { body: release } = await got('https://api.github.com/repos/jgm/pandoc/releases/latest', { json: true })

  const donwloadRoot = path.join(__dirname, '../.pandoc-local')
  const downloadDir = path.join(donwloadRoot, release.tag_name)
  fs.ensureDirSync(downloadDir)

  const asset = release.assets.find(filterAssets)
  if (asset) {
    const bar = new ProgressBar('  downloading [:bar] :percent :etas', { total: 15 })
    const zipPath = `${downloadDir}/${asset.name}`

    if (!fs.existsSync(zipPath)) {
      await new Promise((resolve, reject) => {
        got
          .stream(asset.browser_download_url)
          .on('downloadProgress', progress => {
            bar.update(progress.percent)
          })
          .pipe(fs.createWriteStream(zipPath))
          .on('finish', resolve)
          .on('error', reject)
      })
    }

    await extract(zipPath, { dir: downloadDir })

    const files = await glob(`${downloadDir}/**/{pandoc,pandoc-citeproc}`)
    ;(files as string[]).forEach(f => {
      fs.copyFileSync(f, path.join(donwloadRoot, path.basename(f)))
    })
  }
}

run()

