export interface KoiosAdmission {
    minIntervalMs?: number;
    beforeStart?: () => void;
}

// The account is shared across Koios endpoints/callers. Response receipt, not a
// caller's decision to retry, creates the provider hold. Pacing is separate.
let providerNotBefore = 0;
let nextStart = 0;

const seconds = (value: unknown): number | undefined => {
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    if (`${value}`.trim() === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n * 1000 : undefined;
};

const retryAfter = (value: string | null, now: number): number | undefined => {
    if (value === null || value.trim() === '') return undefined;
    const numeric = seconds(value);
    if (numeric !== undefined) return numeric;
    const at = Date.parse(value);
    return Number.isFinite(at) ? Math.max(0, at - now) : undefined;
};

const resetDelay = (value: string | null, now: number, relative: boolean): number | undefined => {
    if (value === null || value.trim() === '') return undefined;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
        if (relative && numeric < 1_000_000_000) return numeric * 1000;
        const at = numeric >= 1_000_000_000_000 ? numeric : numeric * 1000;
        return Math.max(0, at - now);
    }
    return retryAfter(value, now);
};

const remember = (delays: (number | undefined)[], now: number): number | undefined => {
    const stated = delays.filter((delay): delay is number => delay !== undefined && Number.isFinite(delay) && delay >= 0);
    if (!stated.length) return undefined;
    const wait = Math.max(...stated);
    providerNotBefore = Math.max(providerNotBefore, now + wait);
    return wait;
};

export const observeKoiosHeaders = (headers: Headers, now = Date.now()): number | undefined => remember([
    retryAfter(headers.get('retry-after'), now),
    seconds(headers.get('x-ratelimit-reset-after')),
    seconds(headers.get('ratelimit-reset-after')),
    resetDelay(headers.get('ratelimit-reset'), now, true),
    headers.get('x-ratelimit-remaining')?.trim() === '0'
        ? resetDelay(headers.get('x-ratelimit-reset'), now, false) : undefined
], now);

const retryInfoDelay = (value: unknown): number | undefined => {
    if (typeof value === 'string' && /^\d+(?:\.\d+)?s$/.test(value)) return Number(value.slice(0, -1)) * 1000;
    if (!value || typeof value !== 'object') return undefined;
    const duration = value as { seconds?: unknown; nanos?: unknown };
    const s = Number(duration.seconds ?? 0);
    const n = Number(duration.nanos ?? 0);
    return Number.isFinite(s) && s >= 0 && Number.isFinite(n) && n >= 0 ? s * 1000 + n / 1_000_000 : undefined;
};

export const observeKoiosBody = (body: unknown, now = Date.now()): number | undefined => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
    const object = body as { retry_after?: unknown; error?: { details?: unknown } };
    const details = object.error?.details;
    const retries = Array.isArray(details) ? details.filter((detail) =>
        detail && typeof detail === 'object' && detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
    ).map((detail) => retryInfoDelay(detail.retryDelay)) : [];
    return remember([seconds(object.retry_after), ...retries], now);
};

export const requestKoios = async <T>(dispatch: () => Promise<T>, admission: KoiosAdmission = {}): Promise<T> => {
    while (true) {
        admission.beforeStart?.();
        const now = Date.now();
        const wait = Math.max(providerNotBefore, nextStart) - now;
        if (wait > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, wait));
            // A concurrent response can extend the hold while this caller sleeps.
            continue;
        }
        nextStart = now + (admission.minIntervalMs ?? 0);
        // No await separates the last deadline/hold check, pacing claim and actual fetch start.
        return dispatch();
    }
};
