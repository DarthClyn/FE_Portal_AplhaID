import type { IncomingMessage, ServerResponse } from 'node:http';
export function verificationContext(env: Record<string, string | undefined>, body: unknown, requestId?: string): Promise<Record<string, unknown>>;
export function handlePilaContext(req: IncomingMessage, res: ServerResponse, env: Record<string, string | undefined>): Promise<void>;
