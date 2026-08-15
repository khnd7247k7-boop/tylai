#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HealthKitBridge, NSObject)

RCT_EXTERN_METHOD(isHealthDataAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(hasCompletedAuthFlow:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestAuthorization:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchQuantitySamples:(NSString *)metric
                  startMs:(nonnull NSNumber *)startMs
                  endMs:(nonnull NSNumber *)endMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchWorkouts:(nonnull NSNumber *)startMs
                  endMs:(nonnull NSNumber *)endMs
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
