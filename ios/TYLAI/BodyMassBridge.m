#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BodyMassBridge, NSObject)

RCT_EXTERN_METHOD(fetchBodyMassSamplesSinceDays:(nonnull NSNumber *)days
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
