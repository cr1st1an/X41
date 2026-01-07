//
//  ContentView.swift
//  X41
//
//  Onboarding view for the X41 Safari Extension.
//  Designed for users who have never used a Safari extension before.
//

import SwiftUI
import os

struct ContentView: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var showingSetup = false

    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Main content - centered in available space
                VStack(spacing: 0) {
                    // App Icon
                    Image("LargeIcon")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 100, height: 100)
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                        .shadow(
                            color: colorScheme == .dark ? .white.opacity(0.06) : .black.opacity(0.12),
                            radius: colorScheme == .dark ? 12 : 10,
                            x: 0,
                            y: colorScheme == .dark ? 0 : 3
                        )
                        .padding(.bottom, 24)

                    // Headline
                    Text("Skip the Feed")
                        .font(.system(size: 28, weight: .bold))
                        .multilineTextAlignment(.center)
                        .padding(.bottom, 8)

                    // Subheadline
                    Text("Open X directly to your notifications,\nprofile, or analytics.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(2)
                        .padding(.horizontal, 32)
                        .padding(.bottom, 32)

                    // Visual preview
                    FeaturePreview()
                        .padding(.horizontal, 32)
                        .padding(.bottom, 24)

                    // Trust signal
                    Text("It changes the navigation only for x.com")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxHeight: .infinity)

                // CTA Section - fixed at bottom
                VStack(spacing: 12) {
                    Button {
                        showingSetup = true
                    } label: {
                        Text("Get Started")
                            .font(.headline)
                            .foregroundStyle(Color(uiColor: .systemBackground))
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(Color.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(ScaleButtonStyle())
                    .padding(.horizontal, 24)

                    Text("Takes about 30 seconds")
                        .font(.footnote)
                        .foregroundStyle(.tertiary)
                }
                .padding(.bottom, 12)

                // Footer
                Text("Safari Extension")
                    .font(.caption2)
                    .foregroundStyle(.quaternary)
                    .padding(.bottom, 8)
            }
        }
        .sheet(isPresented: $showingSetup) {
            SetupSheet()
        }
    }
}

// MARK: - Setup Sheet

private struct SetupSheet: View {
    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Setup")
                            .font(.largeTitle.bold())

                        Text("Follow these steps in Settings")
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 36)
                    .padding(.bottom, 36)

                    // Steps - clean and spaced
                    VStack(alignment: .leading, spacing: 0) {
                        StepRow(
                            number: 1,
                            title: "Open Safari Settings",
                            detail: "Settings → Apps → Safari",
                            isLast: false
                        )
                        
                        StepRow(
                            number: 2,
                            title: "Open Extensions",
                            detail: "In the \"General\" section",
                            isLast: false
                        )
                        
                        StepRow(
                            number: 3,
                            title: "Open X41",
                            detail: "Under \"Allow these extensions\"",
                            isLast: false
                        )

                        StepRow(
                            number: 4,
                            title: "Enable \"Allow Extension\"",
                            detail: "Tap to turn on the toggle",
                            isLast: false
                        )

                        StepRow(
                            number: 5,
                            title: "Tap x.com and select \"Allow\"",
                            detail: "Under \"Permissions\"",
                            isLast: true
                        )
                    }
                    .padding(.bottom, 40)
                }
                .padding(.horizontal, 24)
            }

            // Fixed bottom button
            VStack(spacing: 0) {
                Divider()

                Button(action: openSettings) {
                    Label("Open Settings", systemImage: "arrow.up.forward.app")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color(uiColor: .systemBackground))
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(ScaleButtonStyle())
                .padding(.horizontal, 24)
                .padding(.top, 16)
                .padding(.bottom, 8)
            }
            .background(Color(uiColor: .systemBackground))
            .safeAreaPadding(.bottom)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(20)
    }

    private func openSettings() {
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

// MARK: - Step Row

private struct StepRow: View {
    let number: Int
    let title: String
    let detail: String
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            // Number indicator with line
            VStack(spacing: 0) {
                Text("\(number)")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(Color(uiColor: .systemBackground))
                    .frame(width: 30, height: 30)
                    .background(Color.primary)
                    .clipShape(Circle())

                if !isLast {
                    Rectangle()
                        .fill(Color(uiColor: .separator))
                        .frame(width: 1)
                        .frame(maxHeight: .infinity)
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.body.weight(.semibold))

                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 4)
            .padding(.bottom, isLast ? 0 : 28)

            Spacer(minLength: 0)
        }
        .frame(minHeight: 56)
    }
}

// MARK: - Scale Button Style

private struct ScaleButtonStyle: ButtonStyle {
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
            PreviewTab(icon: "person.fill", label: "Profile", isActive: false)
            PreviewTab(icon: "bell.fill", label: "Notifications", isActive: true)
            PreviewTab(icon: "chart.bar.fill", label: "Analytics", isActive: false)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 6)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(uiColor: .secondarySystemBackground))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color(uiColor: .separator).opacity(0.4), lineWidth: 0.5)
        }
    }
}

private struct PreviewTab: View {
    let icon: String
    let label: String
    let isActive: Bool

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: isActive ? .semibold : .regular))
                .foregroundStyle(isActive ? Color.primary : Color.secondary)
                .frame(height: 24)

            Text(label)
                .font(.caption2)
                .fontWeight(isActive ? .medium : .regular)
                .foregroundStyle(isActive ? Color.primary : Color.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background {
            if isActive {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color(uiColor: .tertiarySystemBackground))
            }
        }
    }
}

// MARK: - Previews

#Preview {
    ContentView()
}

#Preview("Dark Mode") {
    ContentView()
        .preferredColorScheme(.dark)
}

#Preview("Setup Sheet") {
    Text("").sheet(isPresented: .constant(true)) {
        SetupSheet()
    }
}
