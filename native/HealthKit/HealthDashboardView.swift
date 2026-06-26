import SwiftUI
import HealthKit

/// Two-column dashboard of latest Health metrics. Requires physical device for real data.
struct HealthDashboardView: View {

    @StateObject private var health = HealthKitManager()

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    var body: some View {
        NavigationStack {
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
                }
                .padding(.vertical)
            }
            .navigationTitle("Health")
            .background(Color(.systemGroupedBackground))
            .task {
                if HKHealthStore.isHealthDataAvailable(), health.authFlowCompleted {
                    await health.refreshAllMetrics()
                }
            }
        }
    }

    private var unavailableBanner: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("HealthKit not available", systemImage: "xmark.circle.fill")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Use a physical iPhone. Simulator and Previews cannot read Apple Health data.")
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
            Text("We read heart rate, weight, VO₂ Max, sleep, and active energy to personalize coaching. We don’t write to Health unless you enable it later.")
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
