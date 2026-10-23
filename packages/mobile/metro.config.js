// Expo 57 resolves pnpm workspaces and native dependencies automatically.
// Disabling hierarchical lookup breaks transitive packages on a clean install.
// getSentryExpoConfig is a drop-in for expo's getDefaultConfig that also emits
// the debug IDs Sentry needs to match a stack trace to its source map.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");
const config = getSentryExpoConfig(__dirname);

config.resolver.sourceExts.push("sql");
// expo-sqlite's web build is wa-sqlite, which ships as a .wasm asset; without
// this the web target cannot bundle at all.
config.resolver.assetExts.push("wasm");

module.exports = withNativeWind(config, { input: "./src/global.css" });
