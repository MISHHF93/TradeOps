export const SESSION_COOKIE_NAME = 'tradeops_session';

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
};

export function buildSessionCookieOptions(params: {
  isProduction: boolean;
  maxAgeSeconds: number;
}): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: params.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: params.maxAgeSeconds,
  };
}
