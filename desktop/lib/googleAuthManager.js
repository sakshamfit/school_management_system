/**
 * Google Auth Manager
 * Handles OAuth 2.0 flow for Google Drive
 * 
 * Security:
 * - Never asks for Google password
 * - Uses official Google OAuth consent flow
 * - Tokens stored via OS secure storage (safeStorage)
 * - Minimal scopes
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const { URL, URLSearchParams } = require('url');
const { getGoogleClientConfig, getAppDataPaths } = require('./constants');
const secureStorage = require('./secureStorage');

class GoogleAuthManager {
  constructor(options = {}) {
    this.config = options.config || getGoogleClientConfig();
    this.paths = options.paths || getAppDataPaths();
    this.authServer = null;
    this.authServerPort = null;
  }

  /**
   * Generate PKCE challenge for enhanced security (OAuth 2.0 best practice for desktop apps)
   */
  generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
  }

  /**
   * Build authorization URL
   */
  buildAuthUrl(state, pkceChallenge, port) {
    const redirectUri = `http://127.0.0.1:${port}/callback`;
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent', // Force to get refresh_token
      state: state,
      code_challenge: pkceChallenge,
      code_challenge_method: 'S256',
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  /**
   * Start local server to receive OAuth callback
   */
  startCallbackServer() {
    return new Promise((resolve, reject) => {
      const server = http.createServer();
      let resolved = false;

      server.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = address.port;
        this.authServer = server;
        this.authServerPort = port;
        resolve({ server, port });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { server.close(); } catch (e) {}
          reject(new Error('OAuth callback server timeout'));
        }
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Wait for OAuth callback
   */
  waitForCallback(server, expectedState) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OAuth callback timeout - user did not complete authentication'));
      }, 5 * 60 * 1000);

      server.on('request', (req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${this.authServerPort}`);
        
        if (url.pathname !== '/callback') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>Not Found</h1>');
          return;
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          clearTimeout(timeout);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html><body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h2>Authentication Failed</h2>
              <p>Error: ${error}</p>
              <p>You can close this window and try again.</p>
            </body></html>
          `);
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (state !== expectedState) {
          clearTimeout(timeout);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Invalid state</h1>');
          reject(new Error('Invalid OAuth state, possible CSRF attack'));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Missing authorization code</h1>');
          return;
        }

        clearTimeout(timeout);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>Authentication Successful</title></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center; padding: 50px; background: #f5f5f7;">
              <div style="background: white; border-radius: 18px; padding: 40px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <div style="width: 60px; height: 60px; background: #30d158; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: white; font-size: 30px;">✓</div>
                <h2 style="color: #1d1d1f; margin: 0 0 10px;">Google Drive Connected</h2>
                <p style="color: #86868b; font-size: 14px; line-height: 1.5;">Your school backup is now connected to Google Drive. You can close this window and return to the application.</p>
              </div>
            </body>
          </html>
        `);

        resolve(code);
      });
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code, codeVerifier, port) {
    const redirectUri = `http://127.0.0.1:${port}/callback`;
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      code: code,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });

    // Only include client_secret if provided (for web apps), but for installed apps it's optional
    if (process.env.GOOGLE_CLIENT_SECRET) {
      params.append('client_secret', process.env.GOOGLE_CLIENT_SECRET);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    const tokens = await response.json();
    
    // Validate tokens
    if (!tokens.access_token) {
      throw new Error('No access token in response');
    }

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_in: tokens.expires_in || 3600,
      token_type: tokens.token_type || 'Bearer',
      scope: tokens.scope || this.config.scopes.join(' '),
      obtained_at: Date.now(),
    };
  }

  /**
   * Refresh access token using refresh_token
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new Error('No refresh token available');

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    if (process.env.GOOGLE_CLIENT_SECRET) {
      params.append('client_secret', process.env.GOOGLE_CLIENT_SECRET);
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If refresh fails due to revoked access, we need to re-auth
      if (response.status === 400 || response.status === 401) {
        throw new Error(`REFRESH_TOKEN_INVALID: ${errorText}`);
      }
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const tokens = await response.json();

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken, // Keep old if new not provided
      expires_in: tokens.expires_in || 3600,
      token_type: tokens.token_type || 'Bearer',
      scope: tokens.scope || this.config.scopes.join(' '),
      obtained_at: Date.now(),
    };
  }

  /**
   * Get user info (email) using access token
   */
  async getUserInfo(accessToken) {
    const response = await fetch(this.config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    const info = await response.json();
    return {
      email: info.email || '',
      name: info.name || '',
      id: info.id || '',
    };
  }

  /**
   * Store tokens securely
   */
  storeTokens(tokens) {
    if (!tokens || !tokens.access_token) {
      throw new Error('Invalid tokens to store');
    }
    // Ensure secure dir exists
    const paths = secureStorage.getAppDataPaths();
    secureStorage.setSecureValue(paths.tokensFile, tokens);
  }

  /**
   * Load tokens securely
   */
  loadTokens() {
    const paths = secureStorage.getAppDataPaths();
    return secureStorage.getSecureValue(paths.tokensFile);
  }

  /**
   * Clear tokens (disconnect)
   */
  clearTokens() {
    const paths = secureStorage.getAppDataPaths();
    secureStorage.deleteSecureValue(paths.tokensFile);
    if (this.authServer) {
      try { this.authServer.close(); } catch (e) {}
      this.authServer = null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(tokens, bufferSeconds = 300) {
    if (!tokens || !tokens.obtained_at || !tokens.expires_in) return true;
    const expiryTime = tokens.obtained_at + (tokens.expires_in * 1000);
    return Date.now() > (expiryTime - bufferSeconds * 1000);
  }

  /**
   * Get valid access token, refreshing if needed
   */
  async getValidAccessToken() {
    let tokens = this.loadTokens();
    if (!tokens) throw new Error('Not authenticated with Google Drive');

    if (this.isTokenExpired(tokens)) {
      if (!tokens.refresh_token) {
        throw new Error('Access token expired and no refresh token available');
      }
      try {
        const newTokens = await this.refreshAccessToken(tokens.refresh_token);
        // Preserve refresh token if new one not provided
        if (!newTokens.refresh_token) {
          newTokens.refresh_token = tokens.refresh_token;
        }
        this.storeTokens(newTokens);
        tokens = newTokens;
      } catch (e) {
        if (e.message.includes('REFRESH_TOKEN_INVALID')) {
          this.clearTokens();
          throw new Error('Google authorization revoked or expired, please reconnect');
        }
        throw e;
      }
    }

    return tokens.access_token;
  }

  /**
   * Full authentication flow
   * Opens browser and waits for callback
   */
  async authenticate(shellOpenExternal) {
    if (!this.config.clientId) {
      throw new Error('Google Client ID not configured. Please set GOOGLE_CLIENT_ID environment variable or configure in app settings.');
    }

    const state = crypto.randomBytes(16).toString('hex');
    const { verifier, challenge } = this.generatePKCE();

    const { server, port } = await this.startCallbackServer();

    try {
      const authUrl = this.buildAuthUrl(state, challenge, port);

      // Open external browser
      if (shellOpenExternal) {
        await shellOpenExternal(authUrl);
      } else {
        // Fallback: try to open with electron shell
        try {
          const { shell } = require('electron');
          await shell.openExternal(authUrl);
        } catch (e) {
          console.log(`[GoogleAuth] Please open this URL in your browser: ${authUrl}`);
        }
      }

      const code = await this.waitForCallback(server, state);
      const tokens = await this.exchangeCodeForTokens(code, verifier, port);
      
      // Get user info
      let userInfo = { email: '', name: '' };
      try {
        userInfo = await this.getUserInfo(tokens.access_token);
      } catch (e) {
        console.warn('[GoogleAuth] Failed to get user info:', e.message);
      }

      const fullData = {
        ...tokens,
        userInfo,
      };

      this.storeTokens(fullData);
      return fullData;
    } finally {
      try { server.close(); } catch (e) {}
      this.authServer = null;
      this.authServerPort = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    const tokens = this.loadTokens();
    return !!tokens && !!tokens.access_token;
  }

  /**
   * Get connected account email (without exposing tokens)
   */
  getConnectedAccount() {
    const tokens = this.loadTokens();
    if (!tokens) return null;
    return {
      email: tokens.userInfo?.email || 'Unknown',
      name: tokens.userInfo?.name || '',
      connectedAt: tokens.obtained_at ? new Date(tokens.obtained_at).toISOString() : null,
    };
  }
}

module.exports = GoogleAuthManager;
