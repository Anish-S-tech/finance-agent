import { useEffect, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Wallet, Receipt, Landmark, PiggyBank, type LucideIcon } from "lucide-react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import type { ProfileResponse } from "../types";

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card"
    >
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
        <span className="icon-tile h-7 w-7">
          <Icon size={15} />
        </span>
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="input-field w-full"
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="input-field"
    />
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className="btn-primary col-span-full"
    >
      {children}
    </motion.button>
  );
}

function Row({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
    >
      <span className="text-slate-700 dark:text-slate-300">{children}</span>
      <button className="text-rose-500 hover:underline dark:text-rose-400" onClick={onRemove}>
        Remove
      </button>
    </motion.li>
  );
}

export function Onboarding() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);

  const refresh = () => api.getProfile().then(setProfile);
  useEffect(() => {
    refresh();
  }, []);

  const [incomeForm, setIncomeForm] = useState({ label: "Salary", amount: "", frequency: "monthly" });
  const [expenseForm, setExpenseForm] = useState({ label: "", category: "", amount: "", dueDay: "" });
  const [loanForm, setLoanForm] = useState({
    label: "",
    principal: "",
    emiAmount: "",
    interestRate: "",
    remainingMonths: "",
    dueDay: "",
  });
  const [savingsForm, setSavingsForm] = useState({ label: "Savings", balance: "", type: "general" });

  async function submitIncome(e: FormEvent) {
    e.preventDefault();
    await api.addIncome({
      label: incomeForm.label,
      amount: Number(incomeForm.amount),
      frequency: incomeForm.frequency,
    });
    toast.success(`Added income: ${incomeForm.label}`);
    setIncomeForm({ label: "Salary", amount: "", frequency: "monthly" });
    refresh();
  }

  async function submitExpense(e: FormEvent) {
    e.preventDefault();
    await api.addExpense({
      label: expenseForm.label,
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      isRecurring: true,
      dueDay: expenseForm.dueDay ? Number(expenseForm.dueDay) : undefined,
    });
    toast.success(`Added expense: ${expenseForm.label}`);
    setExpenseForm({ label: "", category: "", amount: "", dueDay: "" });
    refresh();
  }

  async function submitLoan(e: FormEvent) {
    e.preventDefault();
    await api.addLoan({
      label: loanForm.label,
      principal: Number(loanForm.principal),
      emiAmount: Number(loanForm.emiAmount),
      interestRate: Number(loanForm.interestRate),
      remainingMonths: Number(loanForm.remainingMonths),
      dueDay: loanForm.dueDay ? Number(loanForm.dueDay) : undefined,
    });
    toast.success(`Added loan: ${loanForm.label}`);
    setLoanForm({ label: "", principal: "", emiAmount: "", interestRate: "", remainingMonths: "", dueDay: "" });
    refresh();
  }

  async function submitSavings(e: FormEvent) {
    e.preventDefault();
    await api.addSavings({
      label: savingsForm.label,
      balance: Number(savingsForm.balance),
      type: savingsForm.type,
    });
    toast.success(`Added savings: ${savingsForm.label}`);
    setSavingsForm({ label: "Savings", balance: "", type: "general" });
    refresh();
  }

  async function removeIncome(id: string, label: string) {
    await api.deleteIncome(id);
    toast.message(`Removed ${label}`);
    refresh();
  }
  async function removeExpense(id: string, label: string) {
    await api.deleteExpense(id);
    toast.message(`Removed ${label}`);
    refresh();
  }
  async function removeLoan(id: string, label: string) {
    await api.deleteLoan(id);
    toast.message(`Removed ${label}`);
    refresh();
  }
  async function removeSavings(id: string, label: string) {
    await api.deleteSavings(id);
    toast.message(`Removed ${label}`);
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="My Financial Data"
        description="Enter your income, expenses, loans/EMIs, and savings manually. Nothing here connects to a bank account."
      />

      <Section title="Income" icon={Wallet}>
        <form onSubmit={submitIncome} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <TextInput
            placeholder="Label"
            value={incomeForm.label}
            onChange={(e) => setIncomeForm({ ...incomeForm, label: e.target.value })}
          />
          <TextInput
            placeholder="Amount"
            type="number"
            value={incomeForm.amount}
            onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
            required
          />
          <SelectInput
            value={incomeForm.frequency}
            onChange={(e) => setIncomeForm({ ...incomeForm, frequency: e.target.value })}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="one-time">One-time</option>
          </SelectInput>
          <SubmitButton>Add Income</SubmitButton>
        </form>
        <ul className="space-y-1 text-sm">
          <AnimatePresence>
            {profile?.income.map((i) => (
              <Row key={i.id} onRemove={() => removeIncome(i.id, i.label)}>
                {i.label} — ₹{i.amount} ({i.frequency})
              </Row>
            ))}
          </AnimatePresence>
        </ul>
      </Section>

      <Section title="Expenses" icon={Receipt}>
        <form onSubmit={submitExpense} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <TextInput
            placeholder="Label (e.g. Rent)"
            value={expenseForm.label}
            onChange={(e) => setExpenseForm({ ...expenseForm, label: e.target.value })}
            required
          />
          <TextInput
            placeholder="Category (e.g. subscription)"
            value={expenseForm.category}
            onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            required
          />
          <TextInput
            placeholder="Amount"
            type="number"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            required
          />
          <TextInput
            placeholder="Due day (1-31)"
            type="number"
            min={1}
            max={31}
            value={expenseForm.dueDay}
            onChange={(e) => setExpenseForm({ ...expenseForm, dueDay: e.target.value })}
          />
          <SubmitButton>Add Expense</SubmitButton>
        </form>
        <ul className="space-y-1 text-sm">
          <AnimatePresence>
            {profile?.expenses.map((e) => (
              <Row key={e.id} onRemove={() => removeExpense(e.id, e.label)}>
                {e.label} ({e.category}) — ₹{e.amount}
                {e.dueDay ? ` · due day ${e.dueDay}` : ""}
              </Row>
            ))}
          </AnimatePresence>
        </ul>
      </Section>

      <Section title="Loans / EMIs" icon={Landmark}>
        <form onSubmit={submitLoan} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <TextInput
            placeholder="Label"
            value={loanForm.label}
            onChange={(e) => setLoanForm({ ...loanForm, label: e.target.value })}
            required
          />
          <TextInput
            placeholder="Principal"
            type="number"
            value={loanForm.principal}
            onChange={(e) => setLoanForm({ ...loanForm, principal: e.target.value })}
            required
          />
          <TextInput
            placeholder="Monthly EMI"
            type="number"
            value={loanForm.emiAmount}
            onChange={(e) => setLoanForm({ ...loanForm, emiAmount: e.target.value })}
            required
          />
          <TextInput
            placeholder="Interest rate (% annual)"
            type="number"
            value={loanForm.interestRate}
            onChange={(e) => setLoanForm({ ...loanForm, interestRate: e.target.value })}
            required
          />
          <TextInput
            placeholder="Remaining months"
            type="number"
            value={loanForm.remainingMonths}
            onChange={(e) => setLoanForm({ ...loanForm, remainingMonths: e.target.value })}
            required
          />
          <TextInput
            placeholder="Due day (1-31)"
            type="number"
            min={1}
            max={31}
            value={loanForm.dueDay}
            onChange={(e) => setLoanForm({ ...loanForm, dueDay: e.target.value })}
          />
          <SubmitButton>Add Loan</SubmitButton>
        </form>
        <ul className="space-y-1 text-sm">
          <AnimatePresence>
            {profile?.loans.map((l) => (
              <Row key={l.id} onRemove={() => removeLoan(l.id, l.label)}>
                {l.label} — EMI ₹{l.emiAmount}/mo, {l.remainingMonths} mo left
              </Row>
            ))}
          </AnimatePresence>
        </ul>
      </Section>

      <Section title="Savings" icon={PiggyBank}>
        <form onSubmit={submitSavings} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <TextInput
            placeholder="Label"
            value={savingsForm.label}
            onChange={(e) => setSavingsForm({ ...savingsForm, label: e.target.value })}
          />
          <TextInput
            placeholder="Balance"
            type="number"
            value={savingsForm.balance}
            onChange={(e) => setSavingsForm({ ...savingsForm, balance: e.target.value })}
            required
          />
          <SelectInput
            value={savingsForm.type}
            onChange={(e) => setSavingsForm({ ...savingsForm, type: e.target.value })}
          >
            <option value="general">General</option>
            <option value="emergency">Emergency fund</option>
          </SelectInput>
          <SubmitButton>Add Savings</SubmitButton>
        </form>
        <ul className="space-y-1 text-sm">
          <AnimatePresence>
            {profile?.savings.map((s) => (
              <Row key={s.id} onRemove={() => removeSavings(s.id, s.label)}>
                {s.label} ({s.type}) — ₹{s.balance}
              </Row>
            ))}
          </AnimatePresence>
        </ul>
      </Section>
    </div>
  );
}
