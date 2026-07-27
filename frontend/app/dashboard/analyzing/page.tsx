"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FileSearch, Microscope, Brain, Sparkles, Check } from "lucide-react";
import { Logo } from "../../components/ui";
import { getAuthenticatedUser } from "@/utils/aws-cognito";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const steps = [
  { icon: FileSearch, label: "Reading report structural metadata" },
  { icon: Microscope, label: "Isolating clinical biological markers" },
  { icon: Brain, label: "Cross-referencing normal thresholds" },
  { icon: Sparkles, label: "Generating contextual plain insights" },
];

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = meta.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "application/pdf";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mime });
}

export default function AnalyzingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const fileData = sessionStorage.getItem("lablens_pending_file_data");
    const fileName = sessionStorage.getItem("lablens_pending_file_name");

    if (!fileData || !fileName) {
      router.replace("/dashboard");
      return;
    }

    let stepTimer: ReturnType<typeof setInterval> | null = null;

    async function processAnalysis() {
      const auth = await getAuthenticatedUser();

      if (!auth.success || !auth.email) {
        router.replace("/auth/sign-in");
        return;
      }

      const userEmail = auth.email;

      let currentStep = 0;
      stepTimer = setInterval(() => {
        currentStep = Math.min(currentStep + 1, steps.length - 1);
        setActiveStep(currentStep);
      }, 1200);

      try {
  const file = dataUrlToFile(fileData as string, fileName as string);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("email", userEmail);

  const city = localStorage.getItem("lablens_city") || "Delhi";
  formData.append("city", city);

  const res = await fetch(`${API_BASE_URL}/analyze-report`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(300000),
  });

  console.log("HTTP Status:", res.status);

  const responseText = await res.text();
  console.log("Raw Response:", responseText);

  if (!res.ok) {
    throw new Error(`Backend Error (${res.status}): ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Backend returned invalid JSON:\n${responseText}`);
  }

  console.log("Parsed Response:", data);

  if (!data.health_score) {
    const total = data.total_tests || 1;
    const normal = data.normal_count || 0;
    data.health_score = Math.round((normal / total) * 100);
  }

  if (data.patient_name) {
    sessionStorage.setItem(
      "lablens_active_patient_name",
      data.patient_name
    );
  }

  sessionStorage.setItem(
    "lablens_latest_result",
    JSON.stringify(data)
  );

  sessionStorage.removeItem("lablens_pending_file_data");
  sessionStorage.removeItem("lablens_pending_file_name");

  if (stepTimer) clearInterval(stepTimer);

  setActiveStep(steps.length);

  setTimeout(() => router.push("/dashboard/results"), 600);

} catch (err: any) {
  if (stepTimer) clearInterval(stepTimer);

  console.error("========= ANALYSIS ERROR =========");
  console.error(err);
  console.error("==================================");

  if (err instanceof Error) {
    setError(err.message);
  } else {
    setError(String(err));
  }
}
    }
    processAnalysis();

    return () => {
      if (stepTimer) clearInterval(stepTimer);
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-canvas to-canvas-deep px-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-14 relative z-10">
        <Logo />
      </motion.div>

      <div className="w-full max-w-sm relative z-10">
        {error ? (
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="text-center">
            <p className="text-[14.5px] font-medium text-status-danger bg-status-danger-bg/50 p-4 rounded-xl border border-status-danger/20">
              {error}
            </p>
            <button
              onClick={() => router.replace("/dashboard")}
              className="mt-6 rounded-full border border-line bg-card px-6 py-2.5 text-[13.5px] font-bold text-ink shadow-sm transition hover:bg-canvas"
            >
              Return to Upload
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3.5">
            {steps.map((step, i) => {
              const isDone = i < activeStep;
              const isActive = i === activeStep;
              const Icon = step.icon;

              return (
                <motion.div
                  key={step.label}
                  animate={{
                    scale: isActive ? 1.01 : 1,
                    opacity: isDone ? 0.6 : isActive ? 1 : 0.3,
                  }}
                  transition={{ duration: 0.4 }}
                  className={`flex items-center gap-4 rounded-xl border px-4 py-4 transition-all ${
                    isActive
                      ? "border-teal-400 bg-white shadow-card ring-1 ring-teal-400/20"
                      : "border-line bg-card"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                      isDone
                        ? "bg-teal-500 text-white"
                        : isActive
                        ? "bg-teal-50 text-teal-600"
                        : "bg-canvas-deep text-faint"
                    }`}
                  >
                    {isDone ? <Check size={14} strokeWidth={3} /> : <Icon size={15} strokeWidth={2.5} className={isActive ? "animate-pulse" : ""} />}
                  </div>

                  <span className={`text-[13.5px] font-semibold tracking-tightish ${isActive ? "text-ink" : "text-muted"}`}>
                    {step.label}
                  </span>
                </motion.div>
              );
            })}

            <div className="pt-4">
              <div className="h-[2px] w-full bg-line overflow-hidden rounded-full">
                <motion.div
                  className="h-full bg-gradient-to-r from-teal-400 to-cyan-500"
                  animate={{ width: `${(activeStep / steps.length) * 100}%` }}
                  transition={{ ease: "easeInOut" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}