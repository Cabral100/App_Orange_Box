import { registerRootComponent } from 'expo';

// Expo Go always receives the presentation-safe demo. EAS profiles explicitly
// enable the bundled ONNX model when producing a signed native application.
const App = process.env.EXPO_PUBLIC_CYF_NATIVE_MODEL === '1'
  ? require('./App').default
  : require('./AppExpoGo').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
