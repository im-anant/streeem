export const WS_PROTOCOL_VERSION = 1;
export function isClientEvent(msg) {
    if (typeof msg !== "object" || msg === null)
        return false;
    const m = msg;
    return m["v"] === WS_PROTOCOL_VERSION && typeof m["type"] === "string" && "payload" in m;
}
