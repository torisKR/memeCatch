export const GOOGLE_TOKEN_ENDPOINT: string;
export class OAuthProtocolError extends Error { readonly code: string }
type ProtocolOptions = { clientId: string; clientSecret: string; fetchImpl?: typeof fetch; timeoutMs?: number };
export type OAuthTokenResult = { access_token: string; expires_in: number; scope?: string; refresh_token?: string; token_type?: string };
export function exchangeAuthorizationCode(options: ProtocolOptions & { code: string; codeVerifier: string; redirectUri: string }): Promise<OAuthTokenResult>;
export function refreshAccessToken(options: ProtocolOptions & { refreshToken: string }): Promise<OAuthTokenResult>;
