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
        // Open Settings app to Safari Extensions page
        if let url = URL(string: "App-prefs:SAFARI") {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
    }

}
