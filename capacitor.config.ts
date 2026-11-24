import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.fitday.app',
  appName: 'FitDay',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
}

export default config
