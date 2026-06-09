const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Explicitly tell Expo Router where the app/ directory is.
// Required in monorepo EAS builds: without this, require.context() in
// expo-router/_ctx.android.js receives undefined and the bundle crashes.
if (!process.env.EXPO_ROUTER_APP_ROOT) {
  process.env.EXPO_ROUTER_APP_ROOT = path.resolve(projectRoot, 'app');
}

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (merged with Expo's defaults)
config.watchFolders = [...config.watchFolders, workspaceRoot];

// 2. Explicit module resolution order: project-local first, then workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Disable hierarchical lookup so Metro resolves packages strictly from
//    nodeModulesPaths above, never traversing up the filesystem to parent dirs.
//    On EAS Build servers this prevents Metro from accidentally picking up expo
//    packages from the server's own node_modules instead of apps/mobile's.
//    expo-doctor flags this as a warning, but it is intentional for this monorepo.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
