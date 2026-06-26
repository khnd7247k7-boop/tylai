/**
 * Safe stub for react-native's deprecated PushNotificationIOS.
 * This app uses expo-notifications; the legacy RN module crashes on iOS when
 * PushNotificationManager is not registered (NativeEventEmitter invariant).
 */

const noop = () => {};
const noopPromise = () => Promise.resolve(undefined);

class PushNotificationIOS {
  static FetchResult = {
    NewData: 'UIBackgroundFetchResultNewData',
    NoData: 'UIBackgroundFetchResultNoData',
    ResultFailed: 'UIBackgroundFetchResultFailed',
  };

  static presentLocalNotification = noop;
  static scheduleLocalNotification = noop;
  static cancelLocalNotifications = noop;
  static cancelAllLocalNotifications = noop;
  static setApplicationIconBadgeNumber = noop;
  static getApplicationIconBadgeNumber = noop;
  static checkPermissions = noop;
  static requestPermissions = noopPromise;
  static abandonPermissions = noop;
  static addEventListener = () => ({ remove: noop });
  static removeEventListener = noop;
  static removeAllDeliveredNotifications = noop;
  static getDeliveredNotifications = noop;
  static removeDeliveredNotifications = noop;
  static getScheduledLocalNotifications = noop;
  static getInitialNotification = noopPromise;
  static getAuthorizationStatus = noop;

  finish = noop;
  getMessage = () => null;
  getSound = () => null;
  getCategory = () => null;
  getAlert = () => null;
  getContentAvailable = () => null;
  getBadgeCount = () => null;
  getData = () => null;
  getThreadID = () => null;
}

export default PushNotificationIOS;
