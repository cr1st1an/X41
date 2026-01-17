//
//  X41App.swift
//  X41
//
//  SwiftUI App entry point for X41 Safari Extension container app.
//

import SwiftUI
import UIKit

// MARK: - Quick Actions

enum QuickAction: String {
    case compose
    case notifications

    var url: URL {
        switch self {
        case .compose:       return URL(string: "https://x.com/compose/post")!
        case .notifications: return URL(string: "https://x.com/notifications")!
        }
    }
}

// MARK: - Scene Delegate

final class SceneDelegate: NSObject, UIWindowSceneDelegate {

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        if let item = connectionOptions.shortcutItem {
            openURL(for: item)
        }
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        openURL(for: shortcutItem)
        completionHandler(true)
    }

    private func openURL(for item: UIApplicationShortcutItem) {
        guard let action = QuickAction(rawValue: item.type) else { return }
        // Brief delay ensures app is ready (especially for cold launch)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            UIApplication.shared.open(action.url)
        }
    }
}

// MARK: - App Delegate

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// MARK: - App

@main
struct X41App: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
