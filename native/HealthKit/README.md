# Health Dashboard (SwiftUI + HealthKit)

Native SwiftUI module for a **centralized Health dashboard** with read-only access to selected Apple Health types, **async/await** queries, optional **background delivery**, and graceful handling when the user denies individual data types.

This repo is primarily **Expo / React Native**. There is **no checked-in `ios/` Xcode project** by default. Use one of the flows below.

## Requirements

- **Physical iPhone** with the Health app populated. **Simulator and SwiftUI Previews do not show real HealthKit samples.**
- Xcode 15+ (Swift 5.9+), iOS deployment target **16+** recommended (sleep stage values use iOS 16 APIs where relevant).

## 1. Generate the iOS project (Expo)

From the app root:

```bash
npx expo prebuild -p ios
```

Open `ios/*.xcworkspace` in Xcode.

## 2. Add Swift files to the Xcode target

1. In Xcode: **File → Add Files to “…”**  
2. Select the `native/HealthKit` folder (or add `HealthKitManager.swift` and `HealthDashboardView.swift` only).  
3. Check **Copy items if needed** and your **app target**.

## 3. Enable HealthKit capability

1. Select the **app target** → **Signing & Capabilities**.  
2. **+ Capability** → **HealthKit**.  
3. For background updates, ensure **Background Delivery** is enabled (Xcode may add `com.apple.developer.healthkit.background-delivery` in entitlements).  
   See `Entitlements-HealthKit.plist.example`.

## 4. Info.plist usage strings

Add the keys from `Info.plist.keys.xml` to the target’s **Info** tab:

| Key | Purpose |
|-----|--------|
| `NSHealthShareUsageDescription` | Read health data |
| `NSHealthUpdateUsageDescription` | Required by Apple even for read-heavy apps; use if you later write samples |

Exact strings match the product spec in your task.

## 5. Show the dashboard from SwiftUI `App`

Example:

```swift
import SwiftUI

@main
struct YourApp: App {
    var body: some Scene {
        WindowGroup {
            HealthDashboardView()
        }
    }
}
```

If you use **UIKit** `SceneDelegate`, host SwiftUI:

```swift
let root = UIHostingController(rootView: HealthDashboardView())
window?.rootViewController = root
```

## 6. React Native / Expo bridge (optional)

To open this screen from RN, create a **native view manager** or use **expo-dev-client** + a thin SwiftUI hosting view controller and present it from JS. That wiring is app-specific; this folder only provides the Health UI + manager.

## Behavior summary

| Feature | Implementation |
|--------|----------------|
| **Authorization** | `requestAuthorization(toShare: [], read:)` for HR, weight, VO₂ Max, active energy, sleep. |
| **Latest sample** | `fetchLatestSample(for:)` uses `HKSampleQuery` limit 1, end date descending. |
| **Sleep** | `fetchSleepTimeLast24Hours()` sums asleep segments from `HKCategoryType.sleepAnalysis` in the last 24h. |
| **Denied / no data** | Cards show `—` and a short reason (“Access denied”, “No data yet”). |
| **Background delivery** | After successful auth, `enableBackgroundDelivery(for:frequency: .immediate)` is attempted for each read type (failures are ignored per type). |
| **Small Wins** | When bridging to RN, observe `HKObserverQuery` or refresh on `UIApplication` foreground; call your JS “small win” layer from a native module when new samples arrive. |

## Files

- `HealthKitManager.swift` — `ObservableObject`, async queries, background delivery hook.  
- `HealthDashboardView.swift` — `LazyVGrid` cards, **Request Access**, **Refresh** + spinner.  
- `Info.plist.keys.xml` — pasteable plist entries.  
- `Entitlements-HealthKit.plist.example` — reference for capabilities.

## Privacy

Only request types you need. This module is **read-only** for writes to HealthKit (`toShare` is empty). If you later sync workouts **into** Health, expand `toShare` and update copy in the usage descriptions.
