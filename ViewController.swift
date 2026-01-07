//
//  ViewController.swift
//  X41
//
//  Created by Cristian Castillo on 01/01/26.
//

import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // Configure WebView
        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = true
        self.webView.scrollView.bounces = false
        self.webView.configuration.userContentController.add(self, name: "controller")

        // Load landing page
        guard let url = Bundle.main.url(forResource: "Main", withExtension: "html"),
              let resourceURL = Bundle.main.resourceURL else {
            showError("Failed to load app resources")
            return
        }

        self.webView.loadFileURL(url, allowingReadAccessTo: resourceURL)
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }

        switch action {
        case "openSettings":
            openSafariSettings()
        case "log":
            if let text = body["text"] as? String {
                print("[X41 Web] \(text)")
            }
        default:
            print("[X41] Unknown action: \(action)")
        }
    }

    // MARK: - Settings Navigation

    private func openSafariSettings() {
        let alert = UIAlertController(
            title: "Enable X41 Extension",
            message: """
            To use X41, follow these steps:

            1. Tap "Open Settings" below
            2. Navigate to Safari → Extensions
            3. Enable X41
            4. Allow access to x.com

            Then open Safari and visit x.com!
            """,
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "Open Settings", style: .default) { [weak self] _ in
            self?.attemptOpenSettings()
        })

        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))

        self.present(alert, animated: true)
    }

    private func attemptOpenSettings() {
        // Try to open Safari settings first
        if let url = URL(string: "App-prefs:root=SAFARI") {
            UIApplication.shared.open(url, options: [:]) { success in
                if !success {
                    // Fallback to main Settings app
                    if let settingsUrl = URL(string: "App-prefs:") {
                        UIApplication.shared.open(settingsUrl)
                    }
                }
            }
        }
    }

    // MARK: - Error Handling

    private func showError(_ message: String) {
        let alert = UIAlertController(
            title: "Error",
            message: message,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        self.present(alert, animated: true)
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Optional: Could inject status info here
        print("[X41] Landing page loaded")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("[X41] Navigation failed: \(error.localizedDescription)")
        showError("Failed to load page: \(error.localizedDescription)")
    }
}
