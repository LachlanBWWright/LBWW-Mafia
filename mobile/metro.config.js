const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { withStorybook } = require("@storybook/react-native/withStorybook");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

const nativeWindConfig = withNativeWind(config, { input: "./global.css" });

module.exports = withStorybook(nativeWindConfig, {
  configPath: path.resolve(projectRoot, ".rnstorybook"),
  enabled: process.env.STORYBOOK_ENABLED === "true",
});
