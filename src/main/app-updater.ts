import { autoUpdater } from 'electron-updater'
import { getSettings } from './store-node'
import { getLogger } from './util'

const log = getLogger('app-updater')

export class AppUpdater {
  constructor(onUpdateDownloaded: () => void) {
    log.transports.file.level = 'info'
    autoUpdater.logger = log

    autoUpdater.once('update-downloaded', (event) => {
      // Notify renderer process about the update
      onUpdateDownloaded()
    })
    const settings = getSettings()
    if (settings.autoUpdate) {
      log.info('Official auto-update feed disabled in no-subscription build')
    }
  }

  async tryUpdate() {
    log.info('Official auto-update feed disabled in no-subscription build')
    return null
  }
}
