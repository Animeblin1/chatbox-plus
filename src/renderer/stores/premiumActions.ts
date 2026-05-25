import { useEffect } from 'react'
import { mcpController } from '@/packages/mcp/controller'
import { authInfoStore } from './authInfoStore'
import { settingsStore, useSettingsStore } from './settingsStore'

function clearCommercialState() {
  const settings = settingsStore.getState()
  const enabledBuiltinServers = settings.mcp?.enabledBuiltinServers || []

  settingsStore.setState((state) => ({
    licenseKey: '',
    licenseDetail: undefined,
    licenseActivationMethod: undefined,
    licenseInstances: undefined,
    lastSelectedLicenseByUser: undefined,
    memorizedManualLicenseKey: '',
    mcp: {
      ...state.mcp,
      enabledBuiltinServers: [],
    },
  }))

  enabledBuiltinServers.forEach((serverId) => {
    mcpController.stopServer(serverId).catch(console.error)
  })
}

export function useAutoValidate(): boolean {
  const licenseKey = useSettingsStore((state) => state.licenseKey)
  const licenseInstances = useSettingsStore((state) => state.licenseInstances)

  useEffect(() => {
    if (licenseKey || licenseInstances) {
      clearCommercialState()
    }
  }, [licenseKey, licenseInstances])

  return false
}

export async function deactivate() {
  authInfoStore.getState().clearTokens()
  clearCommercialState()
}

export async function activate() {
  clearCommercialState()
  return {
    valid: false,
    error: 'commercial_services_disabled',
  }
}
