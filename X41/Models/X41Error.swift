//
//  X41Error.swift
//  X41
//
//  Custom error types for the X41 app.
//

import Foundation

/// Errors that can occur in the X41 app
enum X41Error: LocalizedError {
    case resourceNotFound(String)
    case settingsNavigationFailed
    case extensionNotEnabled
    case invalidConfiguration(String)

    var errorDescription: String? {
        switch self {
        case .resourceNotFound(let resource):
            return "Could not find resource: \(resource)"
        case .settingsNavigationFailed:
            return "Unable to open Settings app"
        case .extensionNotEnabled:
            return "X41 extension is not enabled in Safari settings"
        case .invalidConfiguration(let detail):
            return "Invalid configuration: \(detail)"
        }
    }

    var recoverySuggestion: String? {
        switch self {
        case .resourceNotFound:
            return "Try reinstalling the app"
        case .settingsNavigationFailed:
            return "Open Settings manually and navigate to Safari → Extensions"
        case .extensionNotEnabled:
            return "Go to Settings → Safari → Extensions → X41 and enable it"
        case .invalidConfiguration:
            return "Check your configuration and try again"
        }
    }
}
