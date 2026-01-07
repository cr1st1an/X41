//
//  SafariWebExtensionHandler.swift
//  X41 Extension
//
//  Handles native messaging between the Safari extension and the app.
//  Currently minimal - the extension is fully self-contained in content.js.
//

import SafariServices
import os

/// Safari Web Extension Handler for X41
///
/// Receives and responds to messages from the web extension.
/// Currently implements a minimal echo response as the extension
/// is self-contained in JavaScript.
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private let logger = Logger(subsystem: "co.moshi.X41.Extension", category: "Handler")

    /// Extension version - should match manifest.json
    private let extensionVersion = "1.0"

    func beginRequest(with context: NSExtensionContext) {
        guard let request = context.inputItems.first as? NSExtensionItem else {
            logger.error("No input items in extension request")
            context.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        // Extract profile UUID for logging
        let profile = request.userInfo?[SFExtensionProfileKey] as? UUID
        let message = request.userInfo?[SFExtensionMessageKey]

        logger.info("Received message: \(String(describing: message), privacy: .public) (profile: \(profile?.uuidString ?? "none", privacy: .public))")

        // Build echo response
        let response = NSExtensionItem()
        let responseData: [String: Any] = [
            "echo": message as Any,
            "version": extensionVersion
        ]
        response.userInfo = [SFExtensionMessageKey: responseData]

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
