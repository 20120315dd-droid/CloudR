// jpeg-js 在编码时依赖 Node 的 Buffer，而 React Native 运行时默认没有全局 Buffer，
// 这里在应用最早期注入 buffer polyfill，保证去云引擎能正常编码图片。
import { Buffer as NodeBuffer } from 'buffer';

const globalAny = globalThis as unknown as { Buffer?: unknown };
if (!globalAny.Buffer) {
  globalAny.Buffer = NodeBuffer;
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
