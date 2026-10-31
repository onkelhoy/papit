import type http from "node:http";

import type { PushConfig, PushOptions } from "../types";
import { MAX_PUSH_BYTES } from "./encrypt";
import { RateLimiter, clientAddress } from "./limit";
import { sendPush } from "./send";
import { openSubscription, sealSubscription } from "./token";
import { isPublicEndpoint, parseSubscription } from "./validate";

const MAX_BODY_BYTES = 32 * 1024;
// the longest a push service has to keep a push
const MAX_TTL = 28 * 24 * 60 * 60;
const URGENCIES = ["very-low", "low", "normal", "high"];
const DEFAULT_RATE = 60;

type Answer = [status: number, body: unknown];
type Route = (request: http.IncomingMessage) => Promise<Answer>;

class BodyError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

async function readJSON(request: http.IncomingMessage): Promise<Record<string, unknown>> {
    if (Number(request.headers["content-length"]) > MAX_BODY_BYTES) throw new BodyError(413, "body too large");

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request)
    {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) throw new BodyError(413, "body too large");
        chunks.push(chunk);
    }

    try
    {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        if (typeof body === "object" && body !== null) return body;
    }
    catch { /* answered below */ }
    throw new BodyError(400, "body must be a JSON object");
}

function validOptions({ ttl, urgency }: Record<string, unknown>) {
    if (ttl !== undefined && !(Number.isInteger(ttl) && (ttl as number) >= 0 && (ttl as number) <= MAX_TTL)) return false;
    if (urgency !== undefined && !URGENCIES.includes(urgency as string)) return false;
    return true;
}

/**
 * The push routes. `handle` answers a request and returns true when it is a push route, and returns
 * false without touching `response` when it isn't. `close` releases the rate limiter.
 * Tokens, endpoints and payloads never reach a log or an error message.
 */
export function createPushRoutes(config: PushConfig) {
    const { keys, subject, persistent, lookup, allowPrivate, trustProxy } = config;
    const limiter = new RateLimiter(config.rate ?? DEFAULT_RATE);
    const callable = async (endpoint: string) => allowPrivate || isPublicEndpoint(endpoint, lookup);

    const routes: Record<string, Route> = {
        "GET /push/key": async () => [200, { key: keys.publicKey, persistent }],

        "POST /push/subscribe": async (request) => {
            const subscription = parseSubscription((await readJSON(request)).subscription, allowPrivate);
            if (!subscription) return [400, { error: "invalid subscription" }];
            if (!await callable(subscription.endpoint)) return [400, { error: "endpoint is not public" }];
            return [200, { token: sealSubscription(subscription, keys) }];
        },

        "POST /push/send": async (request) => {
            const body = await readJSON(request);
            const subscription = typeof body.token === "string" ? openSubscription(body.token, keys) : null;
            if (!subscription) return [400, { error: "invalid token" }];
            if (body.payload === undefined) return [400, { error: "payload is required" }];
            if (!validOptions(body)) return [400, { error: "invalid ttl or urgency" }];

            const payload = JSON.stringify(body.payload);
            if (Buffer.byteLength(payload) > MAX_PUSH_BYTES) return [413, { error: `payload is over ${MAX_PUSH_BYTES} bytes` }];

            if (!await callable(subscription.endpoint)) return [200, { status: "failed" }];
            const options = { ttl: body.ttl, urgency: body.urgency } as PushOptions;
            return [200, { status: await sendPush(subscription, payload, keys, subject, options) }];
        },
    };

    const limited: Route = async (request) => {
        request.resume();
        return [429, { error: "rate limit exceeded" }];
    };

    return {
        handle(request: http.IncomingMessage, response: http.ServerResponse, pathname: string, headers: http.OutgoingHttpHeaders) {
            const route = routes[`${request.method} ${pathname}`];
            if (!route) return false;

            const allowed = request.method !== "POST" || limiter.allow(clientAddress(request, trustProxy));
            void answer(allowed ? route : limited, request, response, headers);
            return true;
        },
        close() {
            limiter.close();
        },
    };
}

async function answer(route: Route, request: http.IncomingMessage, response: http.ServerResponse, headers: http.OutgoingHttpHeaders) {
    let result: Answer;
    try
    {
        result = await route(request);
    }
    catch (error)
    {
        result = error instanceof BodyError ? [error.status, { error: error.message }] : [500, { error: "push failed" }];
    }

    if (response.destroyed) return;
    response.writeHead(result[0], headers);
    response.end(JSON.stringify(result[1]));
}
