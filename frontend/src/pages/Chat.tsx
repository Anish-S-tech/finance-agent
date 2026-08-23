import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import type { ChatMessage } from "../types";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getChatHistory().then(setMessages);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage = input;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: userMessage, createdAt: new Date().toISOString() },
    ]);
    setSending(true);
    try {
      const { reply } = await api.sendChatMessage(userMessage);
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-r`, role: "assistant", content: reply, createdAt: new Date().toISOString() },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col">
      <PageHeader icon={MessageCircle} title="Ask Your Money Mentor" description="Grounded in your live financial data — explains options, never directs." />
      <div className="card flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Try asking: "Can I buy a laptop right now?" or "Why am I always running out of money?"
          </p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-linear-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {m.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {sending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <TypingDots />
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your finances..."
          className="input-field flex-1"
        />
        <motion.button whileTap={{ scale: 0.97 }} disabled={sending} className="btn-primary">
          Send <Send size={14} />
        </motion.button>
      </form>
    </div>
  );
}
