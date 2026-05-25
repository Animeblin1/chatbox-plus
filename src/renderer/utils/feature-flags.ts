import platform from '@/platform'
import { commercialServicesEnabled } from './commercial-flags'

export const featureFlags = {
  commercialServices: commercialServicesEnabled,
  mcp: platform.type === 'desktop',
  knowledgeBase: platform.type === 'desktop',
  skills: false,
  taskMode: false,
}
