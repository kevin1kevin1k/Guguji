import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.guguji.app',
  appName: '股股記 Guguji',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
