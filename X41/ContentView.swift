//
//  ContentView.swift
//  X41
//
//  Onboarding view for the X41 Safari Extension.
//

import SwiftUI
import os

struct ContentView: View {
    private let logger = Logger(subsystem: "co.moshi.X41", category: "UI")
    @State private var showingAlert = false

    var body: some View {
        ZStack {
            // Background
            Color(uiColor: .systemBackground)
                .ignoresSafeArea()

            // Content
            VStack(spacing: 0) {
                Spacer()
                    .frame(minHeight: 40, maxHeight: 80)

                // App Icon
                Image("LargeIcon")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 120, height: 120)
                    .clipShape(RoundedRectangle(cornerRadius: 26.6, style: .continuous))
                    .shadow(color: .black.opacity(0.15), radius: 12, x: 0, y: 4)
                    .padding(.bottom, 32)

                // Title
                Text("X, Your Way")
                    .font(.system(size: 32, weight: .bold, design: .default))
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 12)

                // Subtitle
                Text("Skip the feed. Jump straight to what matters to you.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                    .padding(.bottom, 40)

                // Feature Preview
                FeaturePreview()
                    .padding(.horizontal, 24)
                    .padding(.bottom, 40)

                Spacer()

                // CTA Section
                VStack(spacing: 16) {
                    Button {
                        showingAlert = true
                    } label: {
                        Text("Enable Extension")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .frame(height: 54)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .padding(.horizontal, 24)

                    Text("You'll be guided to Safari settings")
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                }
                .padding(.bottom, 16)

                // Footer
                HStack(spacing: 4) {
                    Image(systemName: "safari")
                        .font(.caption2)
                    Text("Safari Extension for X.com")
                        .font(.caption2)
                }
                .foregroundStyle(.quaternary)
                .padding(.bottom, 8)
            }
        }
        .alert("Enable X41", isPresented: $showingAlert) {
            Button("Open Settings", role: .none) {
                openSafariSettings()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Go to Safari → Extensions → X41 and turn it on. Then grant access to x.com.")
        }
    }

    private func openSafariSettings() {
        logger.info("Opening Safari settings")

        if let url = URL(string: "App-prefs:SAFARI&path=WEB_EXTENSIONS") {
            UIApplication.shared.open(url, options: [:]) { success in
                if !success {
                    // Try alternative URL
                    if let safariUrl = URL(string: "App-prefs:SAFARI") {
                        UIApplication.shared.open(safariUrl, options: [:]) { success2 in
                            if !success2 {
                                // Final fallback to main Settings
                                if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
                                    UIApplication.shared.open(settingsUrl)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Feature Preview

private struct FeaturePreview: View {
    var body: some View {
        HStack(spacing: 0) {
            FeatureTab(icon: "person.fill", label: "Profile", isActive: false)
            FeatureTab(icon: "bell.fill", label: "Notifications", isActive: true)
            FeatureTab(icon: "chart.bar.fill", label: "Analytics", isActive: false)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 8)
        .background {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(uiColor: .secondarySystemBackground))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color(uiColor: .separator).opacity(0.5), lineWidth: 0.5)
        }
    }
}

private struct FeatureTab: View {
    let icon: String
    let label: String
    let isActive: Bool

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 22, weight: isActive ? .semibold : .regular))
                .foregroundStyle(isActive ? Color.primary : Color.secondary)
                .frame(height: 28)

            Text(label)
                .font(.caption2)
                .fontWeight(isActive ? .medium : .regular)
                .foregroundStyle(isActive ? Color.primary : Color.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background {
            if isActive {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color(uiColor: .tertiarySystemBackground))
            }
        }
    }
}

// MARK: - Preview

#Preview {
    ContentView()
}

#Preview("Dark Mode") {
    ContentView()
        .preferredColorScheme(.dark)
}
