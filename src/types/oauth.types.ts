export interface OAuth2Token {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: number; // Timestamp when token expires
}

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}
