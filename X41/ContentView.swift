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
    @Environment(\.colorScheme) private var colorScheme
    @State private var showingInstructions = false

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
                    .shadow(
                        color: colorScheme == .dark ? .white.opacity(0.08) : .black.opacity(0.15),
                        radius: colorScheme == .dark ? 16 : 12,
                        x: 0,
                        y: colorScheme == .dark ? 0 : 4
                    )
                    .padding(.bottom, 32)

                // Title
                Text("Kill the Feed.")
                    .font(.system(size: 32, weight: .bold, design: .default))
                    .multilineTextAlignment(.center)
                    .padding(.bottom, 12)
                
                // Subtitle
                Text("X41 is Focused. Minimal. Yours.")
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
                        showingInstructions = true
                    } label: {
                        Text("Enable Extension")
                            .font(.headline)
                            .foregroundStyle(Color(uiColor: .systemBackground))
                            .frame(maxWidth: .infinity)
                            .frame(height: 54)
                            .background(Color.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.horizontal, 24)

                    Text("Quick setup in Settings")
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
        .sheet(isPresented: $showingInstructions) {
            SetupInstructionsSheet()
        }
    }
}

// MARK: - Setup Instructions Sheet

private struct SetupInstructionsSheet: View {
    private let logger = Logger(subsystem: "co.moshi.X41", category: "UI")

    // HIG: Steps should be concise and scannable
    private let steps: [(title: String, detail: String)] = [
        ("Open Settings", "Tap the button below"),
        ("Safari", "Scroll down and tap Safari"),
        ("Extensions", "Tap Extensions"),
        ("Enable X41", "Turn on the X41 toggle"),
        ("Allow Access", "Set to \"All Websites\" or add x.com")
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Scrollable content
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Header - HIG: Large title 34pt bold
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Setup")
                            .font(.largeTitle.bold())

                        Text("Enable X41 in Safari")
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 32) // Space below drag indicator

                    // Steps list
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                            InstructionRow(
                                number: index + 1,
                                title: step.title,
                                detail: step.detail,
                                isLast: index == steps.count - 1
                            )
                        }
                    }
                }
                .padding(.horizontal, 20) // HIG: Standard margin
                .padding(.bottom, 16)
            }

            // Fixed bottom button - HIG: 44pt minimum touch target
            VStack(spacing: 0) {
                Divider()

                Button(action: openSettings) {
                    Label("Open Settings", systemImage: "gear")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color(uiColor: .systemBackground))
                        .frame(maxWidth: .infinity)
                        .frame(height: 50) // HIG: 44pt minimum, 50pt comfortable
                        .background(Color.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 8)
            }
            .background(Color(uiColor: .systemBackground))
            .safeAreaPadding(.bottom) // HIG: Respect home indicator
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(20)
    }

    private func openSettings() {
        // Try Safari settings first, then Settings root, then fallback
        let urls = ["App-prefs:SAFARI", "App-prefs:", UIApplication.openSettingsURLString]
        tryOpen(urls: urls, index: 0)
    }

    private func tryOpen(urls: [String], index: Int) {
        guard index < urls.count, let url = URL(string: urls[index]) else { return }
        UIApplication.shared.open(url) { success in
            if !success { self.tryOpen(urls: urls, index: index + 1) }
        }
    }
}

// MARK: - Instruction Row

private struct InstructionRow: View {
    let number: Int
    let title: String
    let detail: String
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            // Step number with connecting line
            VStack(spacing: 0) {
                // HIG: Minimum 44pt for interactive, but this is display-only
                Text("\(number)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color(uiColor: .systemBackground))
                    .frame(width: 28, height: 28)
                    .background(Color.primary)
                    .clipShape(Circle())

                // Connecting line
                if !isLast {
                    Rectangle()
                        .fill(Color(uiColor: .tertiaryLabel))
                        .frame(width: 1.5)
                        .frame(maxHeight: .infinity)
                }
            }

            // Content - HIG: 17pt body, 15pt secondary
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body.weight(.medium))

                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, isLast ? 0 : 20)

            Spacer(minLength: 0)
        }
        .frame(minHeight: 44) // HIG: Row minimum height
    }
}

// MARK: - Primary Button Style

private struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
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
