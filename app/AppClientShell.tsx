"use client"

import { useState } from "react";
import { performanceMonitor } from "@/lib/performance-monitor";
import LoginForm from "@/components/auth/login-form";
import { useAuth } from "@/components/auth/auth-provider";
import Navigation from "@/components/navigation";
import DigestsView from "@/components/views/digests-view";
import ConceptMapView from "@/components/views/concept-map-view";
import SourceManagementView from "@/components/views/source-management-view";
import SettingsView from "@/components/views/settings-view";
import ErrorBoundary from "@/components/error-boundary";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";

// Define interfaces for the initial data passed from Server Component
interface InitialDigestArticle {
  // Define based on what ContentProcessor.getStoredContent items look like
  // Example: id, title, analysis { summary { sentence } }, createdAt, url etc.
  // This needs to match the structure of items returned by getStoredContent
  id: string;
  title: string;
  url?: string;
  createdAt: string;
  analysis?: {
    summary?: { sentence: string };
    tags?: string[];
    priority?: string;
  };
  // Add other relevant fields based on DigestContentItem needs
}

interface InitialAIDigest {
  // Define based on what ContentProcessor.generateDigest returns
  timeframe: string;
  generatedAt: string;
  summary: string;
  trendingConcepts: Array<{ name: string; reason: string; importance: string; trendType: string }>;
  items: Array<any>; // Define proper type for digest items
  stats: {
    totalArticles: number;
    deepDiveCount: number;
    readCount: number;
    skimCount: number;
  };
}

interface AppClientShellProps {
  initialDigestArticles?: InitialDigestArticle[];
  initialAIDigest?: InitialAIDigest | null;
  // Add other initial data props as needed for other default views if any
}

export default function AppClientShell({
  initialDigestArticles,
  initialAIDigest
}: AppClientShellProps) {
  const auth = useAuth();
  const [activeView, setActiveView] = useState<"digests" | "concept-map" | "source-management" | "settings">("digests");

  const handleLogin = (supabaseUser: any) => {
    const timer = performanceMonitor.startTimer("login-callback");
    console.log("Login callback in AppClientShell, user:", supabaseUser?.email);
    timer();
    setActiveView("digests");
  };

  const handleLogout = async () => {
    const timer = performanceMonitor.startTimer("logout");
    try {
      await auth.signOut();
      setActiveView("digests");
    } catch (error) {
      console.error("Error during logout:", error);
    }
    timer();
  };

  const renderActiveView = () => {
    const timer = performanceMonitor.startTimer("render-active-view");
    let component;
    switch (activeView) {
      case "digests":
        component = <DigestsView
                        initialPreviewArticles={initialDigestArticles}
                        initialAiDigest={initialAIDigest}
                        // Keying by activeView ensures DigestsView re-evaluates initial props if we decide
                        // app/page.tsx should fetch data for other views when activeView changes server-side (more advanced).
                        // For now, initial data is only for the default "digests" view.
                        key="digests"
                    />;
        break;
      case "concept-map": component = <ConceptMapView />; break;
      case "source-management": component = <SourceManagementView />; break;
      case "settings": component = <SettingsView />; break;
      default: component = <DigestsView initialPreviewArticles={initialDigestArticles} initialAiDigest={initialAIDigest} key="digests-default" />;
    }
    timer();
    return component;
  };

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <LoadingSkeleton height={40} className="mb-6" />
          <LoadingSkeleton height={20} width="80%" className="mb-4" />
          <LoadingSkeleton count={3} className="mb-2" />
          <LoadingSkeleton height={100} className="mt-4" />
        </div>
        <p className="text-gray-600 mt-4">Loading Pensive...</p>
      </div>
    );
  }

  if (!auth.user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Navigation activeView={activeView} onViewChange={setActiveView} user={auth.user} onLogout={handleLogout} />
        <main>{renderActiveView()}</main>
      </div>
    </ErrorBoundary>
  );
}
