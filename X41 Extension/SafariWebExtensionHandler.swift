//
//  SafariWebExtensionHandler.swift
//  X41 Extension
//
//  Created by Cristian Castillo on 01/01/26.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private let settingsKeys = ["hideHome", "hideSearch", "hideGrok", "hideNotifications", "hideMessages", "hidePremium"]

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        // Handle settings request
        var responseData: [String: Any] = ["echo": message as Any]

        if let messageDict = message as? [String: Any],
           let action = messageDict["action"] as? String,
           action == "getSettings" {
            // Load settings from App Groups
            responseData = loadSettings()
            os_log(.default, "[X41] Sending settings to extension: %@", String(describing: responseData))
        }

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: responseData ]
        } else {
            response.userInfo = [ "message": responseData ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

    private func loadSettings() -> [String: Any] {
        var settings: [String: Any] = [:]

        // Load from App Group UserDefaults (shared with Settings.bundle)
        guard let groupDefaults = UserDefaults(suiteName: "group.co.moshi.X41") else {
            os_log(.default, "[X41] ERROR: Could not access App Group UserDefaults")
            return settings
        }

        for key in settingsKeys {
            let value = groupDefaults.bool(forKey: key)
            settings[key] = value
        }

        os_log(.default, "[X41] Loaded settings from App Group: %@", String(describing: settings))

        return settings
    }

}
