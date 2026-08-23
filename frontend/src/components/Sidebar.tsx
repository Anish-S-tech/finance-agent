import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  ShoppingBag,
  FlaskConical,
  MessageCircle,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { UserSwitcher } from "./UserSwitcher";
import { useTheme } from "../hooks/useTheme";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/onboarding", label: "My Data", icon: Wallet },
  { to: "/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/afford", label: "Can I Afford This?", icon: ShoppingBag },
  { to: "/whatif", label: "What-If", icon: FlaskConical },
  { to: "/chat", label: "Ask Mentor", icon: MessageCircle },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {links.map((link) => {
        const isActive = link.to === "/" ? location.pathname === "/" : location.pathname === link.to;
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            onClick={onNavigate}
            className="relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
          >
            {isActive && (
              <motion.span
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-lg bg-linear-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-600/30"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <Icon size={17} className={`relative shrink-0 ${isActive ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
            <span
              className={`relative ${
                isActive ? "text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {link.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-md lg:hidden dark:border-slate-800/70 dark:bg-slate-950/80">
        <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 text-sm text-white shadow-md shadow-emerald-600/30">
            M
          </span>
          Money Mentor
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-lg border border-slate-300 p-1.5 text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white/80 py-5 backdrop-blur-md lg:flex dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mb-6 flex items-center gap-2 px-4 font-semibold text-slate-900 dark:text-slate-50">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 text-sm text-white shadow-md shadow-emerald-600/30">
            M
          </span>
          Money Mentor
        </div>
        <NavLinks />
        <div className="mt-6 space-y-3 border-t border-slate-100 px-4 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-secondary w-full"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <UserSwitcher />
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-white/95 py-5 shadow-xl backdrop-blur-md lg:hidden dark:bg-slate-950/95"
            >
              <div className="mb-6 flex items-center justify-between px-4">
                <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 text-sm text-white shadow-md shadow-emerald-600/30">
                    M
                  </span>
                  Money Mentor
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
              <div className="mt-6 space-y-3 border-t border-slate-100 px-4 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="btn-secondary w-full"
                >
                  {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
                <UserSwitcher />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
