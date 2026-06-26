#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MindfulMinutesBridge, NSObject)

RCT_EXTERN_METHOD(fetchMindfulMinutesForDate:(nonnull NSNumber *)dateMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
