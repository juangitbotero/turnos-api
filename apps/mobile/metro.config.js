const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (merged with Expo's defaults)
config.watchFolders = [...config.watchFolders, workspaceRoot];

// 2. Explicit module resolution order: project-local first, then workspace root.
//    Ensures apps/mobile's packages always take precedence over the workspace
//    root — critical on EAS Build servers where Expo pre-installs its own
//    packages at the workspace root level.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Disable hierarchical lookup — intentional for this monorepo.
//    Without it, Metro traverses up the EAS server filesystem past the workspace
//    root and picks up packages from the server's global node_modules.
//    expo-doctor flags this as a warning; it is the correct setting here.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
