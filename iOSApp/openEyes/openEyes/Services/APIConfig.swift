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

        // Azure App Service (openeyes-dev). GitHub Actions deploys openeyes-prod on push to main.
        //
        // For local backend testing, set OPENEYES_API_BASE_URL in the Xcode scheme
        // (for example: http://192.168.x.x:8000).
        return URL(string: "https://app-api-w2xlpc7ldi7ve.azurewebsites.net")!
<<<<<<< HEAD
=======
    }

    /// Optional override for a pre-ingested external clusters API (e.g. Pulse/Mosaiq).
    /// If not set, defaults to `baseURL`.
    static var pulseBaseURL: URL {
        if let override = ProcessInfo.processInfo.environment["PULSE_API_BASE_URL"],
           !override.isEmpty,
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://pulsewebappdev-f3abcqbsa8avgaba.switzerlandnorth-01.azurewebsites.net")!
    }

    /// Optional bearer token for external clusters API.
    static var pulseBearerToken: String? {
        guard let token = ProcessInfo.processInfo.environment["PULSE_API_BEARER_TOKEN"],
              !token.isEmpty else {
            return nil
        }
        return token
>>>>>>> refs/remotes/origin/main
    }

    /// Optional override for a pre-ingested external clusters API (e.g. Pulse/Mosaiq).
    /// If not set, defaults to `baseURL`.
    static var pulseBaseURL: URL {
        if let override = ProcessInfo.processInfo.environment["PULSE_API_BASE_URL"],
           !override.isEmpty,
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://pulsewebappdev-f3abcqbsa8avgaba.switzerlandnorth-01.azurewebsites.net")!
    }

    /// Optional bearer token for external clusters API.
    static var pulseBearerToken: String? {
        guard let token = ProcessInfo.processInfo.environment["PULSE_API_BEARER_TOKEN"],
              !token.isEmpty else {
            return nil
        }
        return token
    }
}
