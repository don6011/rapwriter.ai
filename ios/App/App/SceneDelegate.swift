import UIKit
import Capacitor
import Network

final class RapWriterBridgeViewController: CAPBridgeViewController {
    private let networkMonitor = NWPathMonitor()
    private let networkQueue = DispatchQueue(label: "ai.rapwriter.network-monitor")
    private var connectionWasUnavailable = false
    private lazy var offlineView = makeOfflineView()

    override func viewDidLoad() {
        super.viewDidLoad()
        statusBarStyle = .lightContent
        installOfflineView()

        networkMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.applyNetworkStatus(connected: path.status == .satisfied)
            }
        }
        networkMonitor.start(queue: networkQueue)
    }

    deinit {
        networkMonitor.cancel()
    }

    private func installOfflineView() {
        offlineView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(offlineView)
        NSLayoutConstraint.activate([
            offlineView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offlineView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            offlineView.topAnchor.constraint(equalTo: view.topAnchor),
            offlineView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        offlineView.isHidden = true
    }

    private func applyNetworkStatus(connected: Bool) {
        if connected {
            offlineView.isHidden = true
            if connectionWasUnavailable {
                connectionWasUnavailable = false
                loadStudio()
            }
            return
        }

        connectionWasUnavailable = true
        offlineView.isHidden = false
        view.bringSubviewToFront(offlineView)
    }

    @objc private func retryStudio() {
        guard networkMonitor.currentPath.status == .satisfied else { return }
        connectionWasUnavailable = false
        offlineView.isHidden = true
        loadStudio()
    }

    private func loadStudio() {
        guard let studioURL = URL(string: "https://rapwriter.ai/studio") else { return }
        webView?.load(URLRequest(url: studioURL, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    private func makeOfflineView() -> UIView {
        let container = UIView()
        container.backgroundColor = UIColor(red: 7 / 255, green: 7 / 255, blue: 8 / 255, alpha: 1)
        container.accessibilityViewIsModal = true

        let mark = UIImageView()
        if let markURL = Bundle.main.url(forResource: "rapwriter-mark", withExtension: "png", subdirectory: "public") {
            mark.image = UIImage(contentsOfFile: markURL.path)
        }
        mark.contentMode = .scaleAspectFit
        mark.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            mark.widthAnchor.constraint(equalToConstant: 92),
            mark.heightAnchor.constraint(equalToConstant: 92),
        ])

        let title = UILabel()
        title.text = "Your studio is offline."
        title.textColor = .white
        title.font = .systemFont(ofSize: 28, weight: .bold)
        title.textAlignment = .center
        title.numberOfLines = 0

        let message = UILabel()
        message.text = "Reconnect to continue your session.\nWork already saved on this device remains protected."
        message.textColor = UIColor.white.withAlphaComponent(0.62)
        message.font = .systemFont(ofSize: 17, weight: .semibold)
        message.textAlignment = .center
        message.numberOfLines = 0

        let button = UIButton(type: .system)
        button.setTitle("Try again", for: .normal)
        button.setTitleColor(UIColor(red: 16 / 255, green: 14 / 255, blue: 8 / 255, alpha: 1), for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
        button.backgroundColor = UIColor(red: 246 / 255, green: 199 / 255, blue: 72 / 255, alpha: 1)
        button.layer.cornerRadius = 14
        button.heightAnchor.constraint(equalToConstant: 52).isActive = true
        button.addTarget(self, action: #selector(retryStudio), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [mark, title, message, button])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 20
        stack.setCustomSpacing(12, after: title)
        stack.setCustomSpacing(28, after: message)
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: container.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: container.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            stack.centerYAnchor.constraint(equalTo: container.safeAreaLayoutGuide.centerYAnchor),
        ])

        return container
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = RapWriterBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
