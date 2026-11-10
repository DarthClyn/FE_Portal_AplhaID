import type { IncomingMessage, ServerResponse } from 'node:http';

export interface AuthConfig { username: string; password: string; name: string; secret: string; configured: boolean }
export const COOKIE: string;
export function authConfig(env: Record<string, string | undefined>): AuthConfig;
export function createSession(cfg: AuthConfig, remember?: boolean): string;
export function readSession(cfg: AuthConfig, cookieHeader?: string): { username: string; name: string } | null;
export function handleAuth(req: IncomingMessage, res: ServerResponse, action: string, env: Record<string, string | undefined>): Promise<void>;
