import Foundation
import React

/// Registered with JS via `HealthKitBridge.m` (`RCT_EXTERN_MODULE`).
@objc(HealthKitBridge)
class HealthKitBridge: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { true }

  @objc(isHealthDataAvailable:rejecter:)
  func isHealthDataAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      let manager = HealthKitManager()
      resolve(manager.isHealthDataAvailable)
    }
  }

  @objc(hasCompletedAuthFlow:rejecter:)
  func hasCompletedAuthFlow(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      let manager = HealthKitManager()
      resolve(manager.authFlowCompleted)
    }
  }

  /// Shows the system Health permission sheet (first time) and registers TYLAI under
  /// Settings → Health → Data Access & Devices.
  @objc(requestAuthorization:rejecter:)
  func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      let manager = HealthKitManager()
      let ok = await manager.requestAuthorization()
      resolve([
        "ok": ok,
        "available": manager.isHealthDataAvailable,
        "completed": manager.authFlowCompleted,
      ])
    }
  }

  @objc(fetchQuantitySamples:startMs:endMs:resolver:rejecter:)
  func fetchQuantitySamples(
    _ metric: NSString,
    startMs: NSNumber,
    endMs: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let key = metric as String
    let start = startMs.doubleValue
    let end = endMs.doubleValue
    guard start > 0, end > start else {
      resolve([])
      return
    }
    Task { @MainActor in
      let manager = HealthKitManager()
      let samples = await manager.fetchQuantitySamples(metric: key, startMs: start, endMs: end)
      resolve(samples)
    }
  }
}
