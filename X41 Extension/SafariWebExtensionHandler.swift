//
//  SafariWebExtensionHandler.swift
//  X41 Extension
//
//  Created by Cristian Castillo on 01/01/26.
//

import SafariServices
import os.log

/**
 * Safari Web Extension Handler for X41
 *
 * Currently minimal - no settings or native messaging needed
 * Extension is fully self-contained in content.js
 */
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        // Get profile UUID (for logging only)
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

        os_log(.default, "[X41] Received message: %@ (profile: %@)",
               String(describing: message),
               profile?.uuidString ?? "none")

        // Echo response (minimal implementation)
        let response = NSExtensionItem()
        let responseData: [String: Any] = [
            "echo": message as Any,
            "version": "2.0.0"
        ]

        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: responseData]
        } else {
            response.userInfo = ["message": responseData]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
