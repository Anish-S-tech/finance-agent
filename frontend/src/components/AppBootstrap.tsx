import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api } from "../api/client";
import { getCurrentUserId, setCurrentUserId } from "../api/currentUser";

type Status = "checking" | "ready" | "needs-profile";

/**
 * Ensures a valid X-User-Id is picked before any page renders (every API route 400s
 * without one). On first-ever visit it defaults to the sample account; if the stored
 * id no longer exists (e.g. a different browser/profile), it re-resolves instead of
 * leaving every page stuck on a 400 error.
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getUsers()
      .then((users) => {
        const storedId = getCurrentUserId();
        if (storedId && users.some((u) => u.id === storedId)) {
          setStatus("ready");
          return;
        }
        const sample = users.find((u) => u.isSample) ?? users[0];
        if (sample) {
          setCurrentUserId(sample.id);
          setStatus("ready");
        } else {
          setStatus("needs-profile");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const user = await api.createUser(name.trim());
      setCurrentUserId(user.id);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (error) {
    return <div className="mx-auto max-w-md p-8 text-rose-600 dark:text-rose-400">{error}</div>;
  }

  if (status === "checking") {
    return <div className="mx-auto max-w-md p-8 text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  if (status === "needs-profile") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 bg-slate-50 p-8 dark:bg-slate-950">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-base font-semibold text-white">
          M
        </span>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Welcome to Money Mentor</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Create a profile to get started.</p>
        <form onSubmit={submit} className="flex gap-2">
          <input
            autoFocus
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Create
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
