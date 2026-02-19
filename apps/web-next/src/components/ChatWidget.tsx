"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Send, MessageSquare } from "lucide-react";
import { useRoom } from "@/contexts/RoomContext";

interface ChatWidgetProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChatWidget({ isOpen, onClose }: ChatWidgetProps) {
    const { messages, sendMessage } = useRoom();
    const [inputText, setInputText] = useState("");
    const chatRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current && isOpen) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    // Click outside to close
    const stableOnClose = useCallback(() => onClose(), [onClose]);

    useEffect(() => {
        if (!isOpen) return;

        function handleClickOutside(e: MouseEvent) {
            if (chatRef.current && !chatRef.current.contains(e.target as Node)) {
                stableOnClose();
            }
        }

        // Delay to prevent the opening click from immediately closing
        const timer = setTimeout(() => {
            document.addEventListener("mousedown", handleClickOutside);
        }, 50);

        return () => {
            clearTimeout(timer);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, stableOnClose]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        sendMessage(inputText);
        setInputText("");
    };

    // Don't render anything when closed
    if (!isOpen) return null;

    return (
        <div
            ref={chatRef}
            style={{
                position: "absolute",
                right: 20,
                bottom: 90,
                width: 340,
                height: 420,
                zIndex: 100,
                borderRadius: 16,
                background: "rgba(17,17,17,0.97)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                animation: "chatFadeIn 0.2s ease",
                border: "1px solid rgba(255,255,255,0.08)",
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.03)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <MessageSquare style={{ width: 16, height: 16, color: "#818cf8" }} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#fff" }}>
                        In-Call Messages
                    </span>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: "none",
                        border: "none",
                        padding: 6,
                        borderRadius: "50%",
                        cursor: "pointer",
                        color: "#9ca3af",
                        display: "flex",
                        alignItems: "center",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                    <X style={{ width: 16, height: 16 }} />
                </button>
            </div>

            {/* Messages area */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                }}
            >
                {messages.length === 0 && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            color: "#71717a",
                            fontSize: 12,
                            fontStyle: "italic",
                            gap: 8,
                        }}
                    >
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                background: "rgba(255,255,255,0.05)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <MessageSquare style={{ width: 20, height: 20, opacity: 0.5 }} />
                        </div>
                        <span>No messages yet</span>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: msg.isSystem ? "center" : "flex-start",
                        }}
                    >
                        {msg.isSystem ? (
                            <span
                                style={{
                                    fontSize: 10,
                                    color: "#71717a",
                                    background: "#18181b",
                                    border: "1px solid rgba(255,255,255,0.05)",
                                    padding: "2px 8px",
                                    borderRadius: 9999,
                                }}
                            >
                                {msg.text}
                            </span>
                        ) : (
                            <div
                                style={{
                                    background: "rgba(39,39,42,0.8)",
                                    borderRadius: "16px 16px 16px 4px",
                                    padding: 12,
                                    maxWidth: "90%",
                                    border: "1px solid rgba(255,255,255,0.05)",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>
                                        {msg.sender}
                                    </span>
                                    <span style={{ fontSize: 10, color: "#52525b" }}>{msg.timestamp}</span>
                                </div>
                                <p
                                    style={{
                                        fontSize: 14,
                                        color: "#e4e4e7",
                                        lineHeight: 1.4,
                                        margin: 0,
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {msg.text}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div
                style={{
                    padding: 12,
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(9,9,11,0.5)",
                }}
            >
                <form
                    onSubmit={handleSend}
                    style={{ position: "relative", display: "flex", alignItems: "center" }}
                >
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Send a message..."
                        autoFocus
                        style={{
                            width: "100%",
                            background: "#18181b",
                            border: "1px solid #27272a",
                            borderRadius: 9999,
                            paddingLeft: 16,
                            paddingRight: 40,
                            paddingTop: 10,
                            paddingBottom: 10,
                            fontSize: 14,
                            color: "#fff",
                            outline: "none",
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        style={{
                            position: "absolute",
                            right: 4,
                            top: 4,
                            padding: 6,
                            borderRadius: "50%",
                            background: inputText.trim() ? "#6366f1" : "transparent",
                            color: "#fff",
                            border: "none",
                            cursor: inputText.trim() ? "pointer" : "default",
                            opacity: inputText.trim() ? 1 : 0,
                            transition: "opacity 0.15s, background 0.15s",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Send style={{ width: 14, height: 14 }} />
                    </button>
                </form>
            </div>

            {/* Animation keyframes */}
            <style jsx>{`
        @keyframes chatFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
        </div>
    );
}
