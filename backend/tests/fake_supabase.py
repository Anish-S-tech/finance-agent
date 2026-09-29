"""
In-memory stand-in for the subset of the supabase-py query builder the
app uses, so the HTTP layer can be tested without a Supabase project.
RLS isn't simulated — tests use a single user.
"""
import uuid
from datetime import datetime, timezone

DEFAULTS = {
    "action_items": {"status": "todo", "priority": 2},
    "financial_items": {"ai_allowed": True, "verified": False, "confidence": 1.0, "source": "user"},
    "financial_calendar": {"status": "upcoming", "is_recurring": False},
    "user_profile": {"onboarding_step": 0, "onboarding_completed": False},
}


class Result:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class Query:
    def __init__(self, db: "FakeSupabase", table: str):
        self.db, self.table = db, table
        self.op, self.payload, self.on_conflict = "select", None, None
        self.filters, self.order_by, self.limit_n, self.single_mode = [], None, None, None

    # --- builders ---
    def select(self, *_cols, **_kw):
        self.op = "select"
        return self

    def insert(self, rows):
        self.op, self.payload = "insert", rows
        return self

    def upsert(self, rows, on_conflict=None):
        self.op, self.payload, self.on_conflict = "upsert", rows, on_conflict
        return self

    def update(self, values):
        self.op, self.payload = "update", values
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, col, val):
        self.filters.append(lambda r: r.get(col) == val)
        return self

    def in_(self, col, vals):
        vals = list(vals)
        self.filters.append(lambda r: r.get(col) in vals)
        return self

    def gte(self, col, val):
        self.filters.append(lambda r: r.get(col) is not None and str(r.get(col)) >= str(val))
        return self

    def order(self, col, desc=False):
        self.order_by = (col, desc)
        return self

    def limit(self, n):
        self.limit_n = n
        return self

    def single(self):
        self.single_mode = "single"
        return self

    def maybe_single(self):
        self.single_mode = "maybe"
        return self

    # --- execution ---
    def _rows(self):
        return self.db.tables.setdefault(self.table, [])

    def _matching(self):
        return [r for r in self._rows() if all(f(r) for f in self.filters)]

    def _new_row(self, values):
        now = datetime.now(timezone.utc).isoformat()
        row = {"id": str(uuid.uuid4()), "created_at": now, "updated_at": now,
               "last_updated": now, "uploaded_at": now, **DEFAULTS.get(self.table, {})}
        row.update(values)
        self._rows().append(row)
        return row

    def execute(self):
        if self.op == "insert":
            rows = self.payload if isinstance(self.payload, list) else [self.payload]
            return Result([dict(self._new_row(r)) for r in rows])

        if self.op == "upsert":
            rows = self.payload if isinstance(self.payload, list) else [self.payload]
            keys = self.on_conflict.split(",") if self.on_conflict else ["id"]
            out = []
            for r in rows:
                existing = next((x for x in self._rows() if all(x.get(k) == r.get(k) for k in keys)), None)
                if existing:
                    existing.update(r)
                    out.append(dict(existing))
                else:
                    out.append(dict(self._new_row(r)))
            return Result(out)

        matched = self._matching()
        if self.op == "update":
            for r in matched:
                r.update(self.payload)
            return Result([dict(r) for r in matched])
        if self.op == "delete":
            self.db.tables[self.table] = [r for r in self._rows() if r not in matched]
            return Result([dict(r) for r in matched])

        if self.order_by:
            col, desc = self.order_by
            matched = sorted(matched, key=lambda r: str(r.get(col) or ""), reverse=desc)
        if self.limit_n is not None:
            matched = matched[: self.limit_n]
        data = [dict(r) for r in matched]
        if self.single_mode == "maybe":
            return Result(data[0]) if data else None
        if self.single_mode == "single":
            return Result(data[0] if data else None)
        return Result(data, count=len(data))


class FakeSupabase:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}

    def table(self, name: str) -> Query:
        return Query(self, name)
