import Foundation
import HealthKit
import Combine

// MARK: - Models

struct HealthMetricCardModel: Identifiable, Equatable {
    let id: String
    let title: String
    let systemImage: String
    let valueText: String
    let updateText: String
}

// MARK: - HealthKitManager

/// Central HealthKit access: authorization, async queries, optional background delivery.
/// Run on a **physical device**; Simulator and Previews show no samples.
@MainActor
final class HealthKitManager: ObservableObject {

    private let healthStore = HKHealthStore()

    /// Types we request read access for (nil if unavailable on OS).
    private(set) var typesToRead: [HKObjectType] = []

    @Published private(set) var authorizationStatus: HKAuthorizationStatus = .notDetermined
    /// After the user taps "Request Access" once, we show the grid (read auth is not reliably reflected by `authorizationStatus`).
    @Published private(set) var authFlowCompleted: Bool
    @Published private(set) var isLoading = false
    @Published private(set) var lastErrorMessage: String?

    private static let authFlowDefaultsKey = "HealthKitAuthFlowCompleted"

    @Published private(set) var heartRate: HealthMetricCardModel?
    @Published private(set) var bodyMass: HealthMetricCardModel?
    @Published private(set) var vo2Max: HealthMetricCardModel?
    @Published private(set) var activeEnergy: HealthMetricCardModel?
    @Published private(set) var sleepSummary: HealthMetricCardModel?

    private var heartRateType: HKQuantityType?
    private var bodyMassType: HKQuantityType?
    private var vo2MaxType: HKQuantityType?
    private var activeEnergyType: HKQuantityType?
    private var sleepType: HKCategoryType?
    private var mindfulSessionType: HKCategoryType?

    init() {
        authFlowCompleted = UserDefaults.standard.bool(forKey: Self.authFlowDefaultsKey)

        guard HKHealthStore.isHealthDataAvailable() else {
            lastErrorMessage = "Health data is not available on this device."
            return
        }

        heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate)
        bodyMassType = HKQuantityType.quantityType(forIdentifier: .bodyMass)
        vo2MaxType = HKQuantityType.quantityType(forIdentifier: .vo2Max)
        activeEnergyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)
        sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)
        mindfulSessionType = HKCategoryType.categoryType(forIdentifier: .mindfulSession)

        var set: [HKObjectType] = []
        if let t = heartRateType { set.append(t) }
        if let t = bodyMassType { set.append(t) }
        if let t = vo2MaxType { set.append(t) }
        if let t = activeEnergyType { set.append(t) }
        if let t = sleepType { set.append(t) }
        if let t = mindfulSessionType { set.append(t) }
        typesToRead = set

        refreshAuthorizationStatus()
    }

    func refreshAuthorizationStatus() {
        guard let hr = heartRateType else { return }
        authorizationStatus = healthStore.authorizationStatus(for: hr)
    }

    /// Show the permission CTA until the user has completed the system sheet once.
    var needsAuthorizationPrompt: Bool {
        guard HKHealthStore.isHealthDataAvailable(), heartRateType != nil else { return false }
        return !authFlowCompleted
    }

    /// Request read-only authorization for all configured types.
    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else {
            lastErrorMessage = "Health is not available on this device."
            return
        }
        let toRead = Set(typesToRead)
        guard !toRead.isEmpty else { return }

        do {
            try await healthStore.requestAuthorization(toShare: [], read: toRead)
            refreshAuthorizationStatus()
            UserDefaults.standard.set(true, forKey: Self.authFlowDefaultsKey)
            authFlowCompleted = true
            await enableBackgroundDeliveryForAllTypes()
            await refreshAllMetrics()
        } catch {
            lastErrorMessage = error.localizedDescription
            UserDefaults.standard.set(true, forKey: Self.authFlowDefaultsKey)
            authFlowCompleted = true
        }
    }

    /// Observe updates when the app is backgrounded (best-effort; user can disable in Settings).
    func enableBackgroundDeliveryForAllTypes() async {
        for type in typesToRead {
            do {
                try await healthStore.enableBackgroundDelivery(for: type, frequency: .immediate)
            } catch {
                // Some types or entitlements may refuse; continue with others.
                continue
            }
        }
    }

    func refreshAllMetrics() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        isLoading = true
        lastErrorMessage = nil
        defer { isLoading = false }

        async let hr = fetchLatestQuantitySample(for: heartRateType, title: "Heart Rate", symbol: "heart.fill", format: { qty in
            let v = qty.doubleValue(for: HKUnit.count().unitDivided(by: HKUnit.minute()))
            return String(format: "%.0f BPM", v)
        })

        async let wt = fetchLatestQuantitySample(for: bodyMassType, title: "Weight", symbol: "scalemass.fill", format: { qty in
            let pounds = qty.doubleValue(for: HKUnit.pound())
            return String(format: "%.1f lb", pounds)
        })

        async let vo2 = fetchLatestQuantitySample(for: vo2MaxType, title: "VO₂ Max", symbol: "lungs.fill", format: { qty in
            let unit = Self.vo2MaxUnit
            let v = qty.doubleValue(for: unit)
            return String(format: "%.1f ml/kg·min", v)
        })

        async let energy = fetchLatestQuantitySample(for: activeEnergyType, title: "Active Energy", symbol: "flame.fill", format: { qty in
            let kcal = qty.doubleValue(for: HKUnit.kilocalorie())
            return String(format: "%.0f kcal", kcal)
        })

        async let sleep = fetchSleepTimeLast24Hours()

        heartRate = await hr
        bodyMass = await wt
        vo2Max = await vo2
        activeEnergy = await energy
        sleepSummary = await sleep
    }

    // MARK: - Generic latest quantity sample

    /// Most recent `HKQuantitySample` for the given type, or `nil` if no data / access blocked.
    func fetchLatestSample(for quantityType: HKQuantityType?) async -> HKQuantitySample? {
        guard let quantityType else { return nil }
        if healthStore.authorizationStatus(for: quantityType) == .sharingDenied {
            return nil
        }

        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: quantityType,
                predicate: nil,
                limit: 1,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: samples?.first as? HKQuantitySample)
            }
            healthStore.execute(query)
        }
    }

    private func fetchLatestQuantitySample(
        for type: HKQuantityType?,
        title: String,
        symbol: String,
        format: @escaping (HKQuantity) -> String
    ) async -> HealthMetricCardModel? {
        guard let type else {
            return deniedPlaceholder(id: title, title: title, symbol: symbol, reason: "Unavailable")
        }
        let status = healthStore.authorizationStatus(for: type)
        if status == .sharingDenied {
            return deniedPlaceholder(id: title, title: title, symbol: symbol, reason: "Access denied in Settings")
        }

        guard let sample = await fetchLatestSample(for: type) else {
            return HealthMetricCardModel(
                id: title,
                title: title,
                systemImage: symbol,
                valueText: "—",
                updateText: "No data yet"
            )
        }

        let text = format(sample.quantity)
        let update = Self.formatRelativeUpdate(sample.endDate)
        return HealthMetricCardModel(
            id: title,
            title: title,
            systemImage: symbol,
            valueText: text,
            updateText: update
        )
    }

    private func deniedPlaceholder(id: String, title: String, symbol: String, reason: String) -> HealthMetricCardModel {
        HealthMetricCardModel(
            id: id,
            title: title,
            systemImage: symbol,
            valueText: "—",
            updateText: reason
        )
    }

    // MARK: - Sleep (last 24 hours)

    /// Sums asleep intervals from `sleepAnalysis` samples overlapping the last 24 hours.
    func fetchSleepTimeLast24Hours() async -> HealthMetricCardModel? {
        let title = "Sleep"
        let symbol = "moon.zzz.fill"
        guard let sleepType else {
            return deniedPlaceholder(id: title, title: title, symbol: symbol, reason: "Unavailable")
        }

        let status = healthStore.authorizationStatus(for: sleepType)
        if status == .sharingDenied {
            return deniedPlaceholder(id: title, title: title, symbol: symbol, reason: "Access denied in Settings")
        }

        let now = Date()
        let start = now.addingTimeInterval(-24 * 60 * 60)
        let predicate = HKQuery.predicateForSamples(withStart: start, end: now, options: [])

        let samples: [HKCategorySample] = await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: sleepType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, results, _ in
                continuation.resume(returning: (results as? [HKCategorySample]) ?? [])
            }
            healthStore.execute(query)
        }

        var asleepSeconds: TimeInterval = 0
        for sample in samples {
            guard Self.isAsleepValue(sample.value) else { continue }
            let overlapStart = max(sample.startDate, start)
            let overlapEnd = min(sample.endDate, now)
            if overlapEnd > overlapStart {
                asleepSeconds += overlapEnd.timeIntervalSince(overlapStart)
            }
        }

        if asleepSeconds <= 0 {
            return HealthMetricCardModel(
                id: title,
                title: title,
                systemImage: symbol,
                valueText: "—",
                updateText: "No sleep in last 24h"
            )
        }

        let hours = Int(asleepSeconds) / 3600
        let minutes = (Int(asleepSeconds) % 3600) / 60
        let valueText: String
        if hours > 0 {
            valueText = "\(hours)h \(minutes)m asleep"
        } else {
            valueText = "\(minutes)m asleep"
        }

        return HealthMetricCardModel(
            id: title,
            title: title,
            systemImage: symbol,
            valueText: valueText,
            updateText: "Last 24 hours"
        )
    }

    private static func isAsleepValue(_ value: Int) -> Bool {
        if #available(iOS 16.0, *) {
            return value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
                || value == HKCategoryValueSleepAnalysis.asleepCore.rawValue
                || value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue
                || value == HKCategoryValueSleepAnalysis.asleepREM.rawValue
        }
        return value == HKCategoryValueSleepAnalysis.asleep.rawValue
            || value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
    }

    /// Total minutes from `HKCategoryTypeIdentifier.mindfulSession` samples overlapping the given **local** calendar day.
    func fetchMindfulMinutes(for date: Date) async -> Double {
        guard HKHealthStore.isHealthDataAvailable(), let mindfulType = mindfulSessionType else {
            return 0
        }

        if healthStore.authorizationStatus(for: mindfulType) == .sharingDenied {
            return 0
        }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
            return 0
        }

        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: [])

        let samples: [HKCategorySample] = await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: mindfulType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, results, _ in
                continuation.resume(returning: (results as? [HKCategorySample]) ?? [])
            }
            healthStore.execute(query)
        }

        var seconds: TimeInterval = 0
        for sample in samples {
            let overlapStart = max(sample.startDate, startOfDay)
            let overlapEnd = min(sample.endDate, endOfDay)
            guard overlapEnd > overlapStart else { continue }
            seconds += overlapEnd.timeIntervalSince(overlapStart)
        }

        return seconds / 60.0
    }

    private static func formatRelativeUpdate(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return "Updated \(f.localizedString(for: date, relativeTo: Date()))"
    }

    /// ml · kg⁻¹ · min⁻¹ (VO₂ max)
    private static var vo2MaxUnit: HKUnit {
        HKUnit.literUnit(with: .milli)
            .unitDivided(by: HKUnit.gramUnit(with: .kilo).unitMultiplied(by: HKUnit.minute()))
    }
}
