import platform from '../platform'
import { CHATBOX_BUILD_TARGET } from '../variables'

switch (CHATBOX_BUILD_TARGET) {
  case 'mobile_app':
    break
  case 'unknown':
    if (platform.type === 'web') {
      // No-op in the no-subscription build.
    }
    break
}
