import Foundation

enum APIConfig {
    /// Base URL for the OpenEyes FastAPI backend (no trailing slash).
    ///
    /// Override for device testing against a Mac:
    /// Xcode scheme → Run → Environment Variables → `OPENEYES_API_BASE_URL` = `http://192.168.x.x:8000`
    static var baseURL: URL {
        if let override = ProcessInfo.processInfo.environment["OPENEYES_API_BASE_URL"],
           !override.isEmpty,
           let url = URL(string: override) {
            return url
        }

        #if DEBUG
        return URL(string: "http://127.0.0.1:8000")!
        #else
        // Azure App Service (openeyes-dev). GitHub Actions deploys openeyes-prod on push to main.
        return URL(string: "https://app-api-w2xlpc7ldi7ve.azurewebsites.net")!
        #endif
    }
}
