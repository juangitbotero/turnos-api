module.exports = function (api) {
  api.cache(true);

  // babel-preset-expo is hoisted by npm to the workspace root
  // (node_modules/babel-preset-expo), not apps/mobile/node_modules/.
  // From that location hasModule('expo-router') cannot see
  // apps/mobile/node_modules/expo-router, so the preset's automatic
  // expoRouterBabelPlugin registration is skipped.
  //
  // Fix: require the plugin directly from babel-preset-expo and add it
  // explicitly. This replaces process.env.EXPO_ROUTER_APP_ROOT with the
  // correct relative path before Metro's collectDependencies processes
  // the require.context() call in expo-router/_ctx.android.js.
  const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin');

  return {
    presets: [require('babel-preset-expo')],
    plugins: [expoRouterBabelPlugin],
  };
};
