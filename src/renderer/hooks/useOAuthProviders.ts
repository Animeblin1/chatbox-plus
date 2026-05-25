// No-op OAuth providers hook for open-source edition
import type { OAuthProviderInfo } from '@shared/oauth'

export function useOAuthProviders() {
  return {
    oauthProviders: [] as OAuthProviderInfo[],
    isLoading: false,
  }
}
