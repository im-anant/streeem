
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
    const turnSecret = process.env.TURN_SECRET;

    // In production, this should probably error or return empty if TURN is strictly required.
    // For now, we'll return empty which means client falls back to STUN or hardcoded if any (bad practice).

    // 1. Try formatted JSON credentials from env (Provider Agnostic)
    // This allows using any provider (Open Relay, ExpressTURN, Metered, etc.) by just pasting their JSON output here.
    const jsonCreds = process.env.TURN_CREDENTIALS_JSON;
    if (jsonCreds) {
        try {
            const parsed = JSON.parse(jsonCreds);
            // Handle array format (common in ICE server config)
            if (Array.isArray(parsed)) {
                if (parsed.length > 0) {
                    // If it contains the standard RTCIceServer keys
                    const first = parsed[0];
                    if (first.urls && first.username && first.credential) {
                        return NextResponse.json({
                            username: first.username,
                            credential: first.credential,
                            urls: first.urls
                        });
                    }
                }
            }
            // Handle single object format
            else if (parsed.urls && parsed.username && parsed.credential) {
                return NextResponse.json(parsed);
            }
        } catch (e) {
            console.error("Failed to parse TURN_CREDENTIALS_JSON", e);
        }
    }

    // 2. Fallback: Static TURN credentials from env (e.g. Open Relay or manual Metered)
    if (process.env.TURN_URL && process.env.TURN_USER && process.env.TURN_CREDENTIAL) {
        return NextResponse.json({
            username: process.env.TURN_USER,
            credential: process.env.TURN_CREDENTIAL,
            urls: [process.env.TURN_URL] // URLs should typically be an array
        });
    }

    // 3. Fallback: Generate HMAC for self-hosted (if configured)
    if (!turnSecret) {
        console.warn("TURN_SECRET is not set in environment variables, and no other TURN config found.");
        return NextResponse.json({
            iceServers: []
        });
    }

    const ttl = 24 * 3600; // 24 hours
    const unixTimeStamp = Math.floor(Date.now() / 1000) + ttl;
    const username = `${unixTimeStamp}:streeem-user`; // Using original suffix

    const hmac = crypto.createHmac('sha1', turnSecret);
    hmac.setEncoding('base64');
    hmac.write(username);
    hmac.end();
    const credential = hmac.read().toString();

    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;

    if (!turnUrl) {
        console.warn("NEXT_PUBLIC_TURN_URL is not set for HMAC-based TURN server. Returning empty.");
        return NextResponse.json({
            iceServers: []
        });
    }

    return NextResponse.json({
        username,
        credential,
        urls: turnUrl,
    });
}
