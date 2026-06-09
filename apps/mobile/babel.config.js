module.exports = function (api) {
  api.cache(true);
  return {
    // Use require() so Node.js resolves from apps/mobile, not from @babel/core's
    // worker-process location. As a transitive dep nested inside expo, a bare
    // string 'babel-preset-expo' is not reachable by @babel/core on EAS servers.
    presets: [require('babel-preset-expo')],
  };
};
