import { getModel } from '@shared/models'
import type { ModelInterface } from '@shared/models/types'
import type { Message, Settings } from '@shared/types'
import type { ModelDependencies } from '@shared/types/adapters'
import { getModelSettings } from '@shared/utils/model_settings'
import type { ModelMessage } from 'ai'
import pMap from 'p-map'
import { createModelDependencies } from '@/adapters'

export function getOCRModel(
  globalSettings: Settings,
  configs: { uuid: string },
  dependencies: ModelDependencies
): ModelInterface | null {
  const ocrModelSetting = globalSettings.ocrModel
  if (!ocrModelSetting?.provider || !ocrModelSetting?.model) {
    return null
  }
  const modelSettings = getModelSettings(globalSettings, ocrModelSetting.provider, ocrModelSetting.model)
  return getModel(modelSettings, globalSettings, configs, dependencies)
}

export async function ocrImagesInMessages(messages: Message[], ocrModel: ModelInterface): Promise<void> {
  const imageParts: Array<{ storageKey: string; part: Message['contentParts'][number] & { type: 'image' } }> = []
  for (const msg of messages) {
    for (const part of msg.contentParts) {
      if (part.type === 'image' && !part.ocrResult) {
        imageParts.push({ storageKey: part.storageKey, part })
      }
    }
  }

  if (imageParts.length === 0) return

  const dependencies = await createModelDependencies()

  await pMap(
    imageParts,
    async ({ storageKey, part }) => {
      const imageData = await dependencies.storage.getImage(storageKey)
      if (!imageData) return

      const ocrMsg: ModelMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'OCR the following image into Markdown.',
              'Tables should be formatted as HTML.',
              'Do not surround your output with triple backticks.',
            ].join(' '),
          },
          { type: 'image', image: imageData },
        ],
      }
      const chatResult = await ocrModel.chat([ocrMsg], {})
      const text = chatResult.contentParts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('')

      part.ocrResult = text
    },
    { concurrency: 3 }
  )
}
