import { Button, Flex, Paper, Stack, Switch, Text, Title } from '@mantine/core'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settingsStore'

export const Route = createFileRoute('/settings/tools/')({
  component: RouteComponent,
})

type ToolId = 'curl' | 'jsonQuery' | 'textTransform' | 'datetime' | 'htmlExtract' | 'urlTool' | 'csvPreview'

function ToolRow(props: {
  title: string
  description: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  detailsPath?: string
}) {
  const { t } = useTranslation()

  return (
    <Paper shadow="xs" radius="md" withBorder p="md">
      <Flex align="center" gap="md">
        <Stack gap={4} flex={1}>
          <Text size="sm" fw={600}>
            {props.title}
          </Text>
          <Text size="xs" c="chatbox-gray">
            {props.description}
          </Text>
        </Stack>
        {props.detailsPath && (
          <Button component={Link} to={props.detailsPath} variant="light" size="xs" color="chatbox-brand">
            {t('Details')}
          </Button>
        )}
        <Switch checked={props.enabled} onChange={(event) => props.onEnabledChange(event.currentTarget.checked)} />
      </Flex>
    </Paper>
  )
}

export function RouteComponent() {
  const { t } = useTranslation()
  const tools = useSettingsStore((state) => state.tools)
  const setSettings = useSettingsStore((state) => state.setSettings)

  const setToolEnabled = (toolId: ToolId, enabled: boolean) => {
    setSettings((draft) => {
      draft.tools[toolId].enabled = enabled
    })
  }

  return (
    <Stack p="md" gap="lg">
      <Title order={5}>{t('Tool Settings')}</Title>

      <ToolRow
        title={t('Curl Request')}
        description={t('Make HTTP requests to public web URLs without using the system command line.')}
        enabled={tools.curl.enabled ?? true}
        onEnabledChange={(enabled) => setToolEnabled('curl', enabled)}
        detailsPath="/settings/tools/curl"
      />
      <ToolRow
        title={t('JSON Query')}
        description={t('Parse JSON and extract values by simple dot/bracket paths.')}
        enabled={tools.jsonQuery.enabled ?? true}
        onEnabledChange={(enabled) => setToolEnabled('jsonQuery', enabled)}
      />
      <ToolRow
        title={t('Text Transform')}
        description={t('Run exact local text transforms such as Base64, URL encoding, SHA-256, and case conversion.')}
        enabled={tools.textTransform.enabled ?? true}
        onEnabledChange={(enabled) => setToolEnabled('textTransform', enabled)}
      />
      <ToolRow
        title={t('Date and Time')}
        description={t('Return exact current date and time values for the model.')}
        enabled={tools.datetime.enabled ?? true}
        onEnabledChange={(enabled) => setToolEnabled('datetime', enabled)}
      />
      <ToolRow
        title={t('HTML Extract')}
        description={t('Extract title, metadata, readable text, and links from HTML returned by HTTP requests.')}
        enabled={tools.htmlExtract.enabled ?? true}
        onEnabledChange={(enabled) => setToolEnabled('htmlExtract', enabled)}
      />
      <ToolRow
        title={t('URL Tool')}
        description={t('Parse URLs, resolve relative links, and add or replace query parameters.')}
        enabled={tools.urlTool.enabled ?? true}
        onEnabledChange={(enabled) => setToolEnabled('urlTool', enabled)}
      />
      <ToolRow
        title={t('CSV Preview')}
        description={t('Parse CSV or TSV text into headers, rows, and a compact preview.')}
        enabled={tools.csvPreview.enabled ?? true}
        onEnabledChange={(enabled) => setToolEnabled('csvPreview', enabled)}
      />
    </Stack>
  )
}
