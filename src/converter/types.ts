export type PlatformId = 'whatsapp' | 'telegram' | 'discord' | 'plaintext'

export type CompatibilityLevel = 'native' | 'transformed' | 'degraded' | 'unsupported'

export interface ConversionWarning {
  feature: string
  message: string
  level: CompatibilityLevel
}

export interface ConversionResult {
  output: string
  warnings: ConversionWarning[]
}
