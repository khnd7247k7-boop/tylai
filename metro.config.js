const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { resolve: resolveMetro } = require('metro-resolver');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('db')) {
  config.resolver.assetExts.push('db');
}

const pushNotificationStub = path.resolve(__dirname, 'shims/PushNotificationIOS.js');
const legacyPushNotificationPattern = /PushNotificationIOS\/PushNotificationIOS/;

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web' && legacyPushNotificationPattern.test(moduleName)) {
    return { type: 'sourceFile', filePath: pushNotificationStub };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return resolveMetro(context, moduleName, platform);
};

module.exports = config;
