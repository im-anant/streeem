"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Smile } from "lucide-react";
import { useRoom } from "@/contexts/RoomContext";

/* ── helpers ───────────────────────────────────────── */

function getUserColor(userId: string): string {
    const colors = [
        "#6366f1", "#f43f5e", "#10b981", "#f59e0b",
        "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
        "#ef4444", "#22c55e", "#a855f7", "#06b6d4",
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
    return name.charAt(0).toUpperCase();
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ── constants ─────────────────────────────────────── */

const MAX_VISIBLE = 4;
const SYSTEM_HOLD = 4000;
const SLIDE_OUT_DUR = 300;

/* ── types ─────────────────────────────────────────── */

interface LivePill {
    id: string;
    userId: string;
    username: string;
    text: string;
    isOwn: boolean;
    isSystem: boolean;
    avatarColor: string;
    slidingOut: boolean;
    fading: boolean;
    timestamp: number;
}

interface HistoryMsg {
    userId: string;
    username: string;
    text: string;
    isOwn: boolean;
    isSystem: boolean;
    avatarColor: string;
    timestamp: number;
}

interface ChatOverlayProps {
    localUserId?: string;
    dockVisible: boolean;
    chatOpen: boolean;
    onToggleChat: () => void;
}

/* ── component ─────────────────────────────────────── */

export function ChatOverlay({ localUserId, dockVisible, chatOpen, onToggleChat }: ChatOverlayProps) {
    const { messages, sendMessage } = useRoom();
    const [inputText, setInputText] = useState("");
    const [livePills, setLivePills] = useState<LivePill[]>([]);
    const [history, setHistory] = useState<HistoryMsg[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const prevMsgLenRef = useRef(0);
    const systemTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Scroll history
    const [scrollMode, setScrollMode] = useState(false);
    const [scrollHint, setScrollHint] = useState(false);
    const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Emoji picker
    const [emojiOpen, setEmojiOpen] = useState(false);
    const emojiWrapRef = useRef<HTMLDivElement>(null);
    const emojiBtnRef = useRef<HTMLButtonElement>(null);

    // ── Dynamic PiP positioning ──
    const [inputBottom, setInputBottom] = useState(118);

    const updateStack = useCallback(() => {
        const pip = document.querySelector('.pip-tile') as HTMLElement | null;
        let bottom: number;
        if (pip && pip.offsetParent !== null) {
            const rect = pip.getBoundingClientRect();
            bottom = window.innerHeight - rect.top + 12;
        } else {
            bottom = dockVisible ? 92 : 24;
        }
        setInputBottom(bottom);
    }, [dockVisible]);

    useEffect(() => {
        updateStack();
        window.addEventListener('resize', updateStack);
        const id = setInterval(updateStack, 1000);
        const pip = document.querySelector('.pip-tile');
        pip?.addEventListener('transitionend', updateStack);
        return () => {
            window.removeEventListener('resize', updateStack);
            clearInterval(id);
            pip?.removeEventListener('transitionend', updateStack);
        };
    }, [updateStack]);

    const overlayBottom = inputBottom + 44 + 8;

    // ── Escape key ──
    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && chatOpen) onToggleChat();
        };
        document.addEventListener('keydown', fn);
        return () => document.removeEventListener('keydown', fn);
    }, [chatOpen, onToggleChat]);

    // Auto-focus on open
    useEffect(() => {
        if (chatOpen) setTimeout(() => inputRef.current?.focus(), 80);
    }, [chatOpen]);

    // ── Clear pills when chat closes ──
    useEffect(() => {
        if (!chatOpen) {
            // Fade out live pills when chat is closed
            setLivePills([]);
            setScrollMode(false);
        }
    }, [chatOpen]);

    // ── Process new messages ──
    useEffect(() => {
        if (messages.length <= prevMsgLenRef.current) {
            prevMsgLenRef.current = messages.length;
            return;
        }
        const newMsgs = messages.slice(prevMsgLenRef.current);
        prevMsgLenRef.current = messages.length;

        for (const msg of newMsgs) {
            const isOwn = !msg.isSystem && msg.userId === localUserId;
            const ts = Date.now();
            const pillId = msg.id + "_" + ts;
            const color = msg.isSystem ? "" : getUserColor(msg.userId);

            // Always store in history
            setHistory(prev => [...prev, {
                userId: msg.userId, username: msg.sender, text: msg.text,
                isOwn, isSystem: msg.isSystem, avatarColor: color, timestamp: ts,
            }]);

            // Only add live pills if chat is open (or always for remote messages to show activity)
            const pill: LivePill = {
                id: pillId, userId: msg.userId, username: msg.sender,
                text: msg.text, isOwn, isSystem: msg.isSystem,
                avatarColor: color, slidingOut: false, fading: false, timestamp: ts,
            };

            setLivePills(prev => {
                if (msg.isSystem) return [...prev, pill];
                const active = prev.filter(p => !p.isSystem && !p.slidingOut);
                if (active.length >= MAX_VISIBLE) {
                    const oldId = active[0].id;
                    return [...prev.map(p => p.id === oldId ? { ...p, slidingOut: true } : p), pill];
                }
                return [...prev, pill];
            });

            // System events auto-fade
            if (msg.isSystem) {
                const t = setTimeout(() => {
                    setLivePills(prev => prev.map(p => p.id === pillId ? { ...p, fading: true } : p));
                    setTimeout(() => {
                        setLivePills(prev => prev.filter(p => p.id !== pillId));
                        systemTimers.current.delete(pillId);
                    }, 600);
                }, SYSTEM_HOLD);
                systemTimers.current.set(pillId, t);
            }
        }
    }, [messages.length, localUserId, chatOpen]);

    // Remove sliding-out pills after animation
    useEffect(() => {
        if (livePills.some(p => p.slidingOut)) {
            const t = setTimeout(() => setLivePills(prev => prev.filter(p => !p.slidingOut)), SLIDE_OUT_DUR);
            return () => clearTimeout(t);
        }
    }, [livePills]);

    useEffect(() => () => {
        systemTimers.current.forEach(t => clearTimeout(t));
    }, []);

    // ── Scroll history ──
    const enterScroll = useCallback(() => {
        if (scrollMode) return;
        setScrollMode(true);
        setScrollHint(true);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setScrollHint(false), 2000);
    }, [scrollMode]);

    const exitScroll = useCallback(() => {
        setScrollMode(false);
        setScrollHint(false);
    }, []);

    // Only the non-live history messages for scroll mode
    const historySlice = scrollMode
        ? history.filter(m => !m.isSystem).slice(0, -MAX_VISIBLE)
        : [];

    // ── Emoji picker ──
    useEffect(() => {
        if (!emojiOpen) return;
        import('emoji-picker-element').catch(() => { });
    }, [emojiOpen]);

    useEffect(() => {
        if (!emojiOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (
                emojiWrapRef.current && !emojiWrapRef.current.contains(e.target as Node) &&
                emojiBtnRef.current && !emojiBtnRef.current.contains(e.target as Node)
            ) setEmojiOpen(false);
        };
        // Delay to prevent the toggle click from immediately closing
        const t = setTimeout(() => document.addEventListener('click', handleClick), 50);
        return () => { clearTimeout(t); document.removeEventListener('click', handleClick); };
    }, [emojiOpen]);

    const handleEmojiClick = useCallback((e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.unicode && inputRef.current) {
            const inp = inputRef.current;
            const s = inp.selectionStart ?? inp.value.length;
            const end = inp.selectionEnd ?? inp.value.length;
            const newVal = inp.value.substring(0, s) + detail.unicode + inp.value.substring(end);
            setInputText(newVal);
            setTimeout(() => {
                const pos = s + detail.unicode.length;
                inp.setSelectionRange(pos, pos);
                inp.focus();
            }, 0);
        }
    }, []);

    useEffect(() => {
        const picker = emojiWrapRef.current?.querySelector('emoji-picker');
        if (picker) {
            picker.addEventListener('emoji-click', handleEmojiClick);
            return () => picker.removeEventListener('emoji-click', handleEmojiClick);
        }
    }, [emojiOpen, handleEmojiClick]);

    // ── Send ──
    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        sendMessage(inputText);
        setInputText("");
        inputRef.current?.focus();
    };

    // Don't render overlay zone if no pills and not in scroll mode
    const hasContent = livePills.length > 0 || scrollMode;

    return (
        <>
            {/* ── Message Overlay Zone ── */}
            {hasContent && (
                <div
                    ref={overlayRef}
                    className={`chat-overlay-zone ${scrollMode ? "scrolling" : ""}`}
                    style={{ bottom: overlayBottom }}
                    onWheel={(e) => { if (e.deltaY < 0) enterScroll(); }}
                    onScroll={() => {
                        const el = overlayRef.current;
                        if (el && scrollMode && el.scrollHeight - el.scrollTop - el.clientHeight < 10) exitScroll();
                    }}
                >
                    {/* Scroll hint */}
                    {scrollMode && scrollHint && (
                        <div className="chat-scroll-hint visible">Scroll for history ↑</div>
                    )}

                    {/* History pills (scroll mode only) */}
                    {historySlice.map((h, i) => (
                        <div key={`h${i}`} className={`chat-msg history ${h.isOwn ? "chat-msg--own" : ""}`}>
                            {!h.isOwn && (
                                <div className="chat-msg-avatar" style={{ background: h.avatarColor }}>
                                    {getInitials(h.username)}
                                </div>
                            )}
                            {!h.isOwn && <span className="chat-msg-name">{h.username}</span>}
                            <span className="chat-msg-text">{h.text}</span>
                            <span className="chat-msg-time">{formatTime(h.timestamp)}</span>
                        </div>
                    ))}

                    {/* Separator between history and live */}
                    {scrollMode && historySlice.length > 0 && (
                        <div className="chat-history-sep" />
                    )}

                    {/* Live pills */}
                    {livePills.map((p) => {
                        if (p.isSystem) {
                            return (
                                <div key={p.id} className={`chat-system-pill ${p.fading ? "fading" : ""}`}>
                                    {p.text}
                                </div>
                            );
                        }
                        return (
                            <div
                                key={p.id}
                                className={`chat-msg ${p.isOwn ? "chat-msg--own" : ""} ${p.slidingOut ? "sliding-out" : ""}`}
                            >
                                {!p.isOwn && (
                                    <div className="chat-msg-avatar" style={{ background: p.avatarColor }}>
                                        {getInitials(p.username)}
                                    </div>
                                )}
                                {!p.isOwn && <span className="chat-msg-name">{p.username}</span>}
                                <span className="chat-msg-text" style={p.isOwn ? { textAlign: "right", width: "100%" } : undefined}>
                                    {p.text}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Input Pill ── */}
            <form
                className={`chat-input-pill ${chatOpen ? "visible" : ""}`}
                style={{ bottom: inputBottom }}
                onSubmit={handleSend}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="chat-input-pill__input"
                />
                <button
                    ref={emojiBtnRef}
                    type="button"
                    className="chat-input-pill__emoji"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEmojiOpen(v => !v); }}
                    aria-label="Emoji"
                >
                    <Smile style={{ width: 20, height: 20 }} />
                </button>
                <button
                    type="submit"
                    className="chat-input-pill__send-btn"
                    disabled={!inputText.trim()}
                    aria-label="Send"
                >
                    <Send style={{ width: 16, height: 16 }} />
                </button>
            </form>

            {/* ── Emoji Picker ── */}
            {emojiOpen && (
                <div
                    ref={emojiWrapRef}
                    className="chat-emoji-picker-wrapper"
                    style={{ position: 'fixed', right: 16, bottom: inputBottom + 52, zIndex: 300 }}
                >
                    {/* @ts-ignore */}
                    <emoji-picker class="chat-emoji-picker"></emoji-picker>
                </div>
            )}
        </>
    );
}
