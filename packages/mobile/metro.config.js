// Expo inside a pnpm workspace: Metro has to watch the repo root and resolve
// from both node_modules trees, otherwise hoisted deps fail to bundle.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// pnpm's nested layout makes Metro's default upward search resolve duplicate
// React copies; pin it to the paths above instead.
config.resolver.disableHierarchicalLookup = true;

config.resolver.sourceExts.push("sql");

module.exports = withNativeWind(config, { input: "./src/global.css" });
