import type { AttachmentResolver } from '@shared/context'
import storage from '@/storage'

export function createAttachmentResolver(): AttachmentResolver {
  return {
    read(attachmentId: string): Promise<string | null> {
      return storage.getBlob(attachmentId).catch(() => null)
    },
  }
}
