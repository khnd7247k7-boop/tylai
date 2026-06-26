import Foundation
import React

@objc(TestFlightBridge)
class TestFlightBridge: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(isTestFlightInstall:rejecter:)
  func isTestFlightInstall(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let receiptURL = Bundle.main.appStoreReceiptURL else {
      resolve(false)
      return
    }
    resolve(receiptURL.lastPathComponent == "sandboxReceipt")
  }
}
