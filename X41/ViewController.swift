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

        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = true
        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }

        if action == "openSettings" {
            openSafariSettings()
        }
    }

    private func openSafariSettings() {
        // Show instructions
        let alert = UIAlertController(
            title: "Enable X41 Extension",
            message: "Tap Safari → Extensions → X41 and toggle it on.\n\nThen allow access to x.com",
            preferredStyle: .alert
        )

        alert.addAction(UIAlertAction(title: "Open Settings", style: .default) { _ in
            // Try to open Safari settings, fallback to general Settings
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
        })

        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))

        self.present(alert, animated: true)
    }

}
