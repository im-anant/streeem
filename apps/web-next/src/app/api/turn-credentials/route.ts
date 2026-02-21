
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Free TURN fallback — Open Relay Project (metered.ca)
const OPEN_RELAY_FALLBACK = {
    username: "e8dd65b92a0cfa69a58e82ff",
    credential: "RHJnClurMC/FqFnl",
    urls: [
        "turn:a.relay.metered.ca:80",
        "turn:a.relay.metered.ca:80?transport=tcp",
        "turn:a.relay.metered.ca:443",
        "turn:a.relay.metered.ca:443?transport=tcp",
        "turns:a.relay.metered.ca:443",
    ],
};

export async function GET() {
    // 1. Try formatted JSON credentials from env (Provider Agnostic)
    const jsonCreds = process.env.TURN_CREDENTIALS_JSON;
    if (jsonCreds) {
        try {
            const parsed = JSON.parse(jsonCreds);
            if (Array.isArray(parsed)) {
                if (parsed.length > 0) {
                    const first = parsed[0];
                    if (first.urls && first.username && first.credential) {
                        return NextResponse.json({
                            username: first.username,
                            credential: first.credential,
                            urls: first.urls
                        });
                    }
                }
            } else if (parsed.urls && parsed.username && parsed.credential) {
                return NextResponse.json(parsed);
            }
        } catch (e) {
            console.error("Failed to parse TURN_CREDENTIALS_JSON", e);
        }
    }

    // 2. Static TURN credentials from env
    if (process.env.TURN_URL && process.env.TURN_USER && process.env.TURN_CREDENTIAL) {
        return NextResponse.json({
            username: process.env.TURN_USER,
            credential: process.env.TURN_CREDENTIAL,
            urls: [process.env.TURN_URL]
        });
    }

    // 3. HMAC-based self-hosted TURN
    const turnSecret = process.env.TURN_SECRET;
    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
    if (turnSecret && turnUrl) {
        const ttl = 24 * 3600;
        const unixTimeStamp = Math.floor(Date.now() / 1000) + ttl;
        const username = `${unixTimeStamp}:streeem-user`;

        const hmac = crypto.createHmac('sha1', turnSecret);
        hmac.setEncoding('base64');
        hmac.write(username);
        hmac.end();
        const credential = hmac.read().toString();

        return NextResponse.json({ username, credential, urls: turnUrl });
    }

    // 4. No TURN configured — return Open Relay fallback so TURN always works
    console.log("[TURN API] No TURN env configured, returning Open Relay fallback");
    return NextResponse.json(OPEN_RELAY_FALLBACK);
}

