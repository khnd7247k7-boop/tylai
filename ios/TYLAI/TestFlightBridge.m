#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TestFlightBridge, NSObject)

RCT_EXTERN_METHOD(isTestFlightInstall:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
