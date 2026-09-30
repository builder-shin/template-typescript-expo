import type { ConfigContext, ExpoConfig } from 'expo/config'

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  return {
    ...config,
    name: 'Template Expo',
    slug: 'template-typescript-expo',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'templateexpo',
    userInterfaceStyle: 'automatic',
    ios: { supportsTablet: true, bundleIdentifier: 'com.example.templateexpo' },
    android: {
      package: 'com.example.templateexpo',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        { backgroundColor: '#E6F4FE', image: './assets/splash-icon.png', imageWidth: 76 },
      ],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
  }
}
