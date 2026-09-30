const { getDefaultConfig } = require('expo/metro-config')
const { withUniwindConfig } = require('uniwind/metro')

const config = getDefaultConfig(__dirname)

// Uniwind 가 global.css 를 Tailwind v4 로 컴파일하고, 그 테마의 타입을
// uniwind-types.d.ts 로 만든다(React Native Reusables 의 minimal-uniwind 템플릿과 같은 모양).
module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
})
