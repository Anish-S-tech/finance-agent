import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import { Sidebar } from "./components/Sidebar";
import { AppBootstrap } from "./components/AppBootstrap";
import { PageTransition } from "./components/PageTransition";
import { Dashboard } from "./pages/Dashboard";
import { Onboarding } from "./pages/Onboarding";
import { Forecast } from "./pages/Forecast";
import { Afford } from "./pages/Afford";
import { WhatIf } from "./pages/WhatIf";
import { Chat } from "./pages/Chat";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/onboarding" element={<PageTransition><Onboarding /></PageTransition>} />
        <Route path="/forecast" element={<PageTransition><Forecast /></PageTransition>} />
        <Route path="/afford" element={<PageTransition><Afford /></PageTransition>} />
        <Route path="/whatif" element={<PageTransition><WhatIf /></PageTransition>} />
        <Route path="/chat" element={<PageTransition><Chat /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" theme="system" />
      <AppBootstrap>
        <div className="bg-mesh flex min-h-screen bg-slate-50 dark:bg-slate-950">
          <Sidebar />
          <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <AnimatedRoutes />
          </main>
        </div>
      </AppBootstrap>
    </BrowserRouter>
  );
}

export default App;
