import SwiftUI
import HealthKit
import UIKit

/// Two-column dashboard of latest Apple Health metrics. Requires physical device for real data.
struct HealthDashboardView: View {

    @StateObject private var health = HealthKitManager()
    @State private var showPermissionAlert = false
    @State private var permissionAlertMessage = ""
    @State private var permissionAlertShowsSettings = false

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let msg = health.lastErrorMessage, !msg.isEmpty {
                        Text(msg)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal)
                    }

                    if !HKHealthStore.isHealthDataAvailable() {
                        unavailableBanner
                    } else if health.needsAuthorizationPrompt {
                        authorizationCard
                    } else {
                        refreshToolbar
                        metricsGrid
                    }

                    if HKHealthStore.isHealthDataAvailable() {
                        checkPermissionsSection
                        medicalDisclaimerFooter
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Apple Health")
            .background(Color(.systemGroupedBackground))
            .task {
                if HKHealthStore.isHealthDataAvailable(), health.authFlowCompleted {
                    await health.refreshAllMetrics()
                }
            }
            .alert("Apple Health permissions", isPresented: $showPermissionAlert) {
                if permissionAlertShowsSettings {
                    Button("Open Settings") {
                        openAppSettings()
                    }
                }
                Button("OK", role: .cancel) {}
            } message: {
                Text(permissionAlertMessage)
            }
        }
    }

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private var checkPermissionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                let snapshot = health.buildPermissionSnapshot()
                permissionAlertMessage = snapshot.guidance
                permissionAlertShowsSettings = snapshot.recommendsOpeningSettings
                showPermissionAlert = true
            } label: {
                Label("Check Apple Health permissions", systemImage: "checkmark.shield.fill")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.bordered)
            .tint(.pink)
            .padding(.horizontal)

            Text("If metrics stay empty, use this to see whether access is denied or not determined. Denied access never locks the rest of TYLAI.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
        }
    }

    private var medicalDisclaimerFooter: some View {
        Text("Not a medical device. Consult a doctor before starting or changing an exercise program. Workouts are at your own risk.")
            .font(.caption2)
            .foregroundStyle(.tertiary)
            .padding(.horizontal)
            .padding(.top, 8)
    }

    private var unavailableBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Apple Health not available", systemImage: "xmark.circle.fill")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Use a physical iPhone. Simulator and Previews cannot read data from Apple Health.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    private var authorizationCard: some View {
        VStack(spacing: 16) {
            Image(systemName: "heart.text.square.fill")
                .font(.system(size: 48))
                .foregroundStyle(.pink, .primary)
            Text("Connect Apple Health")
                .font(.title2.bold())
            Text("We read heart rate, weight, VO₂ max, sleep, and active energy from Apple Health to personalize coaching. We don’t write to Apple Health unless you enable it later.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Button {
                Task { await health.requestAuthorization() }
            } label: {
                Text("Request Access")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .tint(.pink)
        }
        .padding(24)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal)
    }

    private var refreshToolbar: some View {
        HStack {
            Spacer()
            if health.isLoading {
                ProgressView()
                    .padding(.trailing, 8)
            }
            Button {
                Task { await health.refreshAllMetrics() }
            } label: {
                Label("Refresh", systemImage: "arrow.clockwise")
            }
            .disabled(health.isLoading)
        }
        .padding(.horizontal)
    }

    private var metricsGrid: some View {
        LazyVGrid(columns: columns, spacing: 12) {
            ForEach(metricCards) { card in
                metricCard(card)
            }
        }
        .padding(.horizontal)
    }

    private var metricCards: [HealthMetricCardModel] {
        [
            health.heartRate,
            health.bodyMass,
            health.vo2Max,
            health.activeEnergy,
            health.sleepSummary,
        ].compactMap { $0 }
    }

    private func metricCard(_ model: HealthMetricCardModel) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: model.systemImage)
                    .font(.title2)
                    .foregroundStyle(.pink)
                Spacer()
            }
            Text(model.title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text(model.valueText)
                .font(.title2.weight(.semibold))
                .minimumScaleFactor(0.7)
                .lineLimit(2)
            Text(model.updateText)
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

#Preview {
    HealthDashboardView()
}
