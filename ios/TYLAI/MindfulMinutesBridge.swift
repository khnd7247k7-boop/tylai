import Foundation
import React

/// Registered with JS via `MindfulMinutesBridge.m` (`RCT_EXTERN_MODULE`).
@objc(MindfulMinutesBridge)
class MindfulMinutesBridge: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc(fetchMindfulMinutesForDate:resolver:rejecter:)
  func fetchMindfulMinutesForDate(
    _ dateMs: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let ms = dateMs.doubleValue
    guard ms > 0 else {
      reject("INVALID_DATE", "Invalid timestamp for mindful minutes query.", nil)
      return
    }
    let date = Date(timeIntervalSince1970: ms / 1000.0)
    Task { @MainActor in
      let manager = HealthKitManager()
      await manager.requestAuthorization()
      let minutes = await manager.fetchMindfulMinutes(for: date)
      resolve(minutes)
    }
  }
}
