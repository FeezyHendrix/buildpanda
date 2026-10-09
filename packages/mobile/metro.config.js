// Expo 57 resolves pnpm workspaces and native dependencies automatically.
// Disabling hierarchical lookup breaks transitive packages on a clean install.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("sql");
// expo-sqlite's web build is wa-sqlite, which ships as a .wasm asset; without
// this the web target cannot bundle at all.
config.resolver.assetExts.push("wasm");

module.exports = withNativeWind(config, { input: "./src/global.css" });
