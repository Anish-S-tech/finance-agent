import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { api } from "../api/client";
import { getCurrentUserId, setCurrentUserId } from "../api/currentUser";
import type { UserProfile } from "../types";

export function UserSwitcher() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(getCurrentUserId());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {});
  }, []);

  function switchTo(id: string, name?: string) {
    setCurrentUserId(id);
    if (name) toast.success(`Switched to ${name}`);
    window.location.reload();
  }

  async function submitNewProfile(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const user = await api.createUser(newName.trim());
      toast.success(`Profile "${user.name}" created`);
      switchTo(user.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(message);
    }
  }

  if (creating) {
    return (
      <form onSubmit={submitNewProfile} className="flex items-center gap-1">
        <input
          autoFocus
          placeholder="Your name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="input-field w-32 px-2 py-1"
        />
        <button type="submit" className="btn-primary px-2 py-1 text-xs">
          Create
        </button>
        <button
          type="button"
          onClick={() => {
            setCreating(false);
            setError(null);
          }}
          className="text-xs text-slate-500 hover:underline dark:text-slate-400"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={currentId ?? ""}
        onChange={(e) => {
          const user = users.find((u) => u.id === e.target.value);
          setCurrentId(e.target.value);
          switchTo(e.target.value, user?.name);
        }}
        className="input-field px-2 py-1"
      >
        {users.length === 0 && <option value="">No profiles yet</option>}
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.isSample ? "🧪 " : "👤 "}
            {u.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="btn-secondary px-2 py-1 text-xs"
      >
        + New Profile
      </button>
    </div>
  );
}
