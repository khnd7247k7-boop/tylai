import Foundation
import React

/// Registered with JS via `BodyMassBridge.m` (`RCT_EXTERN_MODULE`).
@objc(BodyMassBridge)
class BodyMassBridge: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc(fetchBodyMassSamplesSinceDays:resolver:rejecter:)
  func fetchBodyMassSamplesSinceDays(
    _ days: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let dayCount = max(1, min(days.intValue, 365))
    Task { @MainActor in
      let manager = HealthKitManager()
      await manager.requestAuthorization()
      let samples = await manager.fetchBodyMassSamples(sinceDays: dayCount)
      resolve(samples)
    }
  }
}
