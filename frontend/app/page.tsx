"use client";

import { useEffect, useState } from "react";
import { getAuthenticatedUser, getStoredUserEmail } from '@/utils/aws-cognito';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Sparkles,
  ShieldCheck,
  Bell,
  Stethoscope,
  Languages,
  CheckCircle2,
  Cpu,
} from "lucide-react";
import { Logo, PillBadge, Card, PrimaryButton, GhostButton } from "./components/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const features = [
  {
    icon: FileText,
    title: "Plain-language results",
    desc: "Every biomarker explained in everyday terms — no Latin pathology jargon, no guesswork.",
  },
  {
    icon: ShieldCheck,
    title: "Severity triage",
    desc: "A clear four-tier system flags what's normal, what needs attention, and what's urgent.",
  },
  {
    icon: Bell,
    title: "Appointment & medication reminders",
    desc: "Save a doctor's appointment or a medicine schedule and get SMS reminders sent automatically, right on time.",
  },
  {
    icon: Stethoscope,
    title: "Specialist matching",
    desc: "Get routed to the right kind of doctor, with a ready list of questions to ask them.",
  },
  {
    icon: Languages,
    title: "Hindi localization",
    desc: "Switch every insight into accessible, everyday Hindi with one click.",
  },
  {
    icon: Sparkles,
    title: "Built-in safety checks",
    desc: "Conservative AI guardrails prevent speculative claims when data is ambiguous.",
  },
];

const steps = [
  {
    n: "01",
    title: "Upload your report",
    desc: "Drop in a PDF or photo of your lab report — handwritten or printed.",
  },
  {
    n: "02",
    title: "We read and translate it",
    desc: "Every value is extracted, normalized, and explained in plain language.",
  },
  {
    n: "03",
    title: "Get a clear action plan",
    desc: "See what's normal, what needs follow-up, and which specialist to see.",
  },
];

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

export default function LandingPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check client-side authentication status on mount using AWS Amplify
// Check client-side authentication status on mount using AWS Amplify Core
  useEffect(() => {
    async function checkUserSession() {
      try {
        const auth = await getAuthenticatedUser();
        if (auth.success && auth.email) {
          setIsAuthenticated(true);
          setUserEmail(auth.email);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkUserSession();
  }, []);

  // Dynamic Routing Handler evaluating actual backend record history
  const handleNavigationFlow = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (checkingAuth) return;

    const storedEmail = getStoredUserEmail();
    const activeEmail = (userEmail || storedEmail || "").trim();

    if (!isAuthenticated && !activeEmail) {
      router.push("/auth/sign-in");
      return;
    }

    try {
      // Ask FastAPI if this authenticated account has uploaded files before
      const res = await fetch(`${API_BASE_URL}/api/patient/has-records?email=${encodeURIComponent(activeEmail)}`);
      
      if (!res.ok) throw new Error("Backend unreachable");
      
      const data = await res.json();

      if (data.hasRecords === true) {
        // Returning user with reports -> Straight to history timeline view!
        router.push("/dashboard/results");
      } else {
        // Authenticated user with zero reports -> Straight to the upload drop area!
        router.push("/dashboard");
      }
    } catch (err) {
      // Network/API fallback: Since we know you ARE logged in, safely go to the upload page
      router.push("/dashboard");
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-canvas to-canvas-deep selection:bg-teal-100">
      {/* Premium Ambient Background Accents */}
      <div className="absolute left-1/4 top-[-10%] -z-10 h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-teal-300/10 to-mint-cyan/5 blur-[120px]" />
      <div className="absolute right-1/4 top-[40%] -z-10 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-teal-400/5 to-transparent blur-[100px]" />

      {/* NAV */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-7 sm:px-10"
      >
        <Logo />
        <nav className="hidden items-center gap-8 text-[14px] font-medium text-muted md:flex">
          <a href="#features" className="transition-colors duration-300 hover:text-ink">Features</a>
          <a href="#how-it-works" className="transition-colors duration-300 hover:text-ink">How it works</a>
          <a href="#about" className="transition-colors duration-300 hover:text-ink">About</a>
        </nav>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <button
            onClick={handleNavigationFlow}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border text-[13.5px] font-bold tracking-tightish transition-all border-teal-500/20 hover:border-teal-500/40 text-teal-600 bg-white/40 group"
          >
            Try it now
            <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </motion.div>
      </motion.header>

      {/* HERO */}
      <section className="mx-auto max-w-[1280px] px-6 pb-28 pt-16 text-center sm:px-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-6 w-fit"
        >
          <PillBadge tone="teal">
            <Sparkles size={13} className="mr-1.5 -mt-px inline-block animate-pulse text-teal-500" />
            AI-powered medical diagnostics framework
          </PillBadge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="mx-auto max-w-4xl font-display text-[2.85rem] font-extrabold leading-[1.15] tracking-tightish text-ink sm:text-[4rem]"
        >
          Your clinical health metrics,
          <br />
          decoded <span className="bg-gradient-to-r from-teal-500 to-cyan-600 bg-clip-text text-transparent">in plain language</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-muted"
        >
          LabLens securely processes intricate diagnostic data, translating confusing jargon into logical insights. Know exactly what your biological markers mean, how critical they are, and your precise next clinical steps.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          {/* MAIN CALL TO ACTION */}
          <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}>
            {/* We use a div container to catch the click without nesting buttons */}
            <div onClick={handleNavigationFlow} className="cursor-pointer w-full">
              <PrimaryButton className="group px-8 py-4 text-[15px] pointer-events-none">
                {checkingAuth ? "Checking System..." : (isAuthenticated || getStoredUserEmail()) ? "View Workspace" : "Analyze your report"}
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </PrimaryButton>
            </div>
          </motion.div>

          {/* SECONDARY INFO LINK */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <GhostButton href="#how-it-works" className="px-7 py-4 text-[15px] bg-white/60 backdrop-blur-sm">
              See how it works
            </GhostButton>
          </motion.div>
        </motion.div>

        {/* Premium Trust Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mx-auto mt-20 flex max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-4 rounded-2xl border border-line bg-white/40 p-4 backdrop-blur-md text-[13.5px] text-muted shadow-sm"
        >
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} className="text-teal-500" /> Automated PII Masking
          </span>
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} className="text-teal-500" /> End-to-End TLS 1.3
          </span>
          <span className="flex items-center gap-2 font-medium">
            <Cpu size={16} className="text-teal-500" /> HIPAA-Aligned Processing
          </span>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-[1280px] px-6 py-24 sm:px-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="mx-auto mb-16 max-w-xl text-center"
        >
          <span className="text-[12.5px] font-bold uppercase tracking-widest text-teal-500 bg-teal-50 px-3 py-1 rounded-full">
            Analytical Capabilities
          </span>
          <h2 className="mt-4 font-display text-[2.25rem] font-extrabold tracking-tightish text-ink">
            Engineered for clinical clarity
          </h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((f) => (
            <motion.div key={f.title} variants={fadeInUp}>
              <Card className="group h-full p-7 transition-all duration-300 hover:-translate-y-1 hover:border-teal-300/50 hover:bg-white hover:shadow-card-hover">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-colors duration-300 group-hover:bg-teal-500 group-hover:text-white">
                  <f.icon size={22} strokeWidth={2} />
                </div>
                <h3 className="font-display text-[17px] font-bold text-ink">
                  {f.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
                  {f.desc}
                </p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="mx-auto max-w-[1280px] px-6 py-24 sm:px-10 bg-white/30 backdrop-blur-sm rounded-3xl border border-line/50 my-12">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="mx-auto mb-16 max-w-xl text-center"
        >
          <span className="text-[12.5px] font-bold uppercase tracking-widest text-teal-500 bg-teal-50 px-3 py-1 rounded-full">
            Operational Architecture
          </span>
          <h2 className="mt-4 font-display text-[2.25rem] font-extrabold tracking-tightish text-ink">
            Three steps to insight
          </h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid grid-cols-1 gap-10 sm:grid-cols-3"
        >
          {steps.map((s, index) => (
            <motion.div key={s.n} variants={fadeInUp} className="relative text-center sm:text-left">
              <div className="font-display text-[48px] font-black leading-none bg-gradient-to-b from-teal-200/60 to-transparent bg-clip-text text-transparent sm:-mt-6">
                {s.n}
              </div>
              <h3 className="mt-2 font-display text-[18px] font-bold text-ink">
                {s.title}
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
                {s.desc}
              </p>
              {index < 2 && (
                <div className="hidden lg:block absolute top-6 right-[-15%] w-1/4 h-[1px] bg-gradient-to-r from-line to-transparent" />
              )}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ABOUT */}
      <section id="about" className="mx-auto max-w-[1280px] px-6 py-20 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Card className="overflow-hidden p-10 sm:p-16 bg-gradient-to-br from-white to-canvas/40 relative">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-teal-100/20 blur-2xl" />
            <div className="grid grid-cols-1 items-center gap-12 sm:grid-cols-2">
              <div>
                <span className="text-[12.5px] font-bold uppercase tracking-wider text-teal-500">
                  Mission Statement
                </span>
                <h2 className="mt-3 font-display text-[2rem] font-extrabold tracking-tightish text-ink">
                  Empowering clinical transparency
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-muted">
                  Traditional lab metrics cater entirely to medical practitioners, leaving patients completely disconnected from their metrics. LabLens bridges this division. We safely transform diagnostic values into clear data summaries while constantly framing information with cautious medical boundaries.
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-white/80 p-8 shadow-sm backdrop-blur-sm">
                <p className="text-[14px] leading-relaxed text-muted">
                  <span className="font-bold text-ink text-[14.5px] block mb-2">Institutional Advisory Disclaimer</span>
                  LabLens provides informational syntheses and educational summaries based on parsed metadata. It does not provide clinical diagnostic conclusions, therapeutic assertions, or emergency health triaging. Always consult licensed clinicians for care choices.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line bg-white/20">
        <div className="mx-auto max-w-[1280px] px-6 py-12 sm:px-10">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            <Logo size={32} />
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13.5px] text-muted">
              <a href="#features" className="transition-colors hover:text-ink">Features</a>
              <a href="#how-it-works" className="transition-colors hover:text-ink">How it works</a>
              <a href="#about" className="transition-colors hover:text-ink">About</a>
              <button onClick={handleNavigationFlow} className="transition-colors hover:text-ink text-left">Get started</button>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 text-[12.5px] text-faint sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} LabLens Core. Architecture Secured.</span>
            <span>Made by Amna Sehgal and Priyesi Taneja</span>
          </div>
        </div>
      </footer>
    </div>
  );
}