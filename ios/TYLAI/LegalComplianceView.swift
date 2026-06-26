import SwiftUI

/// In-app legal / privacy disclosures for native SwiftUI flows (e.g. future embedding in Health).
/// Primary RN disclosures live in Settings → Legal.
struct LegalComplianceView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Group {
                        Text("Medical disclaimer")
                            .font(.headline)
                        Text(
                            "TYLAI is not a medical device and does not provide medical advice, diagnosis, or treatment. "
                                + "Consult a qualified healthcare professional before starting or changing any exercise program, "
                                + "especially if you have a medical condition."
                        )
                        .font(.body)
                        .foregroundStyle(.primary)
                    }

                    Divider()

                    Group {
                        Text("Privacy & Apple Health")
                            .font(.headline)
                        Text(
                            "Data read from Apple Health is used only to power your personal experience in this app. "
                                + "We do not sell Apple Health or HealthKit data. We do not use it for advertising or ad profiling. "
                                + "You can manage access in Settings → Apple Health → Data Access & Devices."
                        )
                        .font(.body)
                    }

                    Divider()

                    Group {
                        Text("Workouts & liability")
                            .font(.headline)
                        Text(
                            "Physical activity involves risk. You are responsible for how you use workouts in the app. "
                                + "Stop and seek medical attention if you experience pain, dizziness, or discomfort."
                        )
                        .font(.body)
                    }
                }
                .padding()
            }
            .navigationTitle("Legal & privacy")
            .background(Color(.systemGroupedBackground))
        }
    }
}

#Preview {
    LegalComplianceView()
}
