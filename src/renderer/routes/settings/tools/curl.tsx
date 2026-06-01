import { Button, Flex, NumberInput, Stack, Switch, Text, Title } from '@mantine/core'
import type { ToolSettings } from '@shared/types'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { executeCurlRequest } from '@/packages/model-calls/toolsets/curl'
import { useSettingsStore } from '@/stores/settingsStore'

export const Route = createFileRoute('/settings/tools/curl')({
  component: RouteComponent,
})

export function RouteComponent() {
  const { t } = useTranslation()
  const tools = useSettingsStore((state) => state.tools)
  const setSettings = useSettingsStore((state) => state.setSettings)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<boolean>()

  const curl = tools.curl

  const updateCurlSettings = (updater: (curl: ToolSettings['curl']) => void) => {
    setSettings((draft) => {
      updater(draft.tools.curl)
    })
  }

  const checkCurl = async () => {
    setChecking(true)
    setCheckResult(undefined)
    try {
      const result = await executeCurlRequest({ url: 'https://example.com' })
      setCheckResult(result.ok)
    } catch {
      setCheckResult(false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <Stack p="md" gap="lg" maw={520}>
      <Flex align="center" justify="space-between" gap="md">
        <Title order={5}>{t('Curl Request')}</Title>
        <Button component={Link} to="/settings/tools" variant="subtle" size="xs" color="chatbox-gray">
          {t('Back')}
        </Button>
      </Flex>

      <Stack gap="xs">
        <Switch
          label={t('Enable Curl Request Tool')}
          checked={curl.enabled ?? true}
          onChange={(event) =>
            updateCurlSettings((draft) => {
              draft.enabled = event.currentTarget.checked
            })
          }
        />
        <Text size="xs" c="chatbox-gray">
          {t('Expose curl_request to models when web browsing and tool use are available.')}
        </Text>
      </Stack>

      <Stack gap="xs">
        <Switch
          label={t('Use Chatbox Official Proxy by Default')}
          checked={curl.useOfficialProxy ?? false}
          onChange={(event) =>
            updateCurlSettings((draft) => {
              draft.useOfficialProxy = event.currentTarget.checked
            })
          }
        />
        <Text size="xs" c="chatbox-gray">
          {t('Models can still override this per request. Sensitive headers are never sent through the proxy.')}
        </Text>
      </Stack>

      <NumberInput
        label={t('Default Timeout')}
        description={t('Milliseconds. Allowed range: 1000-60000.')}
        min={1000}
        max={60000}
        step={1000}
        value={curl.timeoutMs ?? 15000}
        onChange={(value) => {
          if (typeof value === 'number') {
            updateCurlSettings((draft) => {
              draft.timeoutMs = value
            })
          }
        }}
        maw={260}
      />

      <NumberInput
        label={t('Default Response Limit')}
        description={t('Characters returned to the model. Allowed range: 500-100000.')}
        min={500}
        max={100000}
        step={1000}
        value={curl.maxResponseChars ?? 20000}
        onChange={(value) => {
          if (typeof value === 'number') {
            updateCurlSettings((draft) => {
              draft.maxResponseChars = value
            })
          }
        }}
        maw={260}
      />

      <Flex align="center" gap="xs">
        <Button color="blue" variant="light" onClick={checkCurl} loading={checking} disabled={!(curl.enabled ?? true)}>
          {t('Check')}
        </Button>
        {typeof checkResult === 'boolean' ? (
          checkResult ? (
            <Text size="xs" c="chatbox-success">
              {t('Connection successful!')}
            </Text>
          ) : (
            <Text size="xs" c="chatbox-error">
              {t('Connection failed. Please check your settings.')}
            </Text>
          )
        ) : null}
      </Flex>
    </Stack>
  )
}
