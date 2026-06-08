import type { CompactionPoint } from '@shared/types'

export interface AttachmentResolver {
  read(attachmentId: string): Promise<string | null>
}

export interface ContextBuilderOptions {
  attachmentResolver: AttachmentResolver
  maxContextMessageCount?: number
  compactionPoints?: CompactionPoint[]
  keepToolCallRounds?: number
  modelSupportToolUseForFile?: boolean
}
