import React, { useState, useEffect } from "react";
import { ShieldAlert, Activity, Users, Bell, LogOut, Loader2, FileText, X, Globe, WifiOff } from "lucide-react";
import { Dashboard } from "./Dashboard";
import { ResidentProfile } from "./ResidentProfile";
import { SirsReporter } from "./SirsReporter";
import { RosterComplianceGuard } from "./RosterComplianceGuard";
import { RNReviewList } from "./RNReviewList";
import { StaffManager } from "./StaffManager";
import { useLanguage } from "../contexts/LanguageContext";
import {
  SIRSAlertData,
  PendingReview,
  AIObservationResult,
  Resident,
} from "../types";
import { db } from "../lib/firebase";
import { subscribeResidents, seedResidentsIfEmpty, FirestoreResident } from "../lib/residents";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { seedDatabaseIfNeeded } from "../lib/seed";
import { useAuth } from "../contexts/AuthContext";

export const DashboardContainer: React.FC = () => {
  const { userProfile, logout } = useAuth();
  const { lang, setLang, t, isOnline } = useLanguage();
  const [currentScreen, setCurrentScreen] = useState<
    "dashboard" | "profile" | "sirs" | "roster" | "rnReview" | "staff"
  >("dashboard");
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(
    null,
  );
  const [globalSirsAlert, setGlobalSirsAlert] = useState<SIRSAlertData | null>(
    null,
  );
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isGeneratingHandover, setIsGeneratingHandover] = useState(false);
  const [handoverText, setHandoverText] = useState<string | null>(null);

  useEffect(() => {
    let unsubResidents: () => void = () => {};
    let unsubReviews: () => void = () => {};

    try {
      if (!db) {
        console.error("Firestore database is not initialized.");
        setIsLoading(false);
        return;
      }

      seedDatabaseIfNeeded();
      seedResidentsIfEmpty().catch(console.error);

      unsubResidents = subscribeResidents((data: FirestoreResident[]) => {
        const mapped: Resident[] = data.map(d => {
          // Mock data for allergies and medical history
          let allergies: string[] = d.allergies || [];
          let medicalHistory: string[] = [];
          
          if (d.name === "Joyce") {
            allergies = ["Penicillin", "Latex"];
            medicalHistory = ["Osteoporosis", "Type 2 Diabetes", "Previous fall with right hip fracture (2023)"];
          } else if (d.name === "Mark") {
            allergies = ["Sulfa drugs"];
            medicalHistory = ["Hypertension", "Dementia (moderate)"];
          } else if (d.name === "Eleanor") {
            allergies = ["No known allergies"];
            medicalHistory = ["Skin tears (frequent)", "Arthritis"];
          } else {
             allergies = ["No known allergies"];
             medicalHistory = ["Hypertension"];
          }

          return {
            id: d.id || "",
            name: d.name,
            room: d.room,
            careMinutesToday: d.careMinutes,
            careMinutesTarget: 200, 
            statusColor: (d.status as any) || "green",
            bathStatus: d.basicCareTasks?.bath ? "done" : "due",
            mealStatus: d.basicCareTasks?.meal ? "eaten" : "missed",
            toiletStatus: d.basicCareTasks?.toilet ? "independent" : "assisted",
            avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=random`,
            allergies,
            medicalHistory
          };
        });
        setResidents(mapped);
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching residents: ", error);
        setIsLoading(false);
      });

      unsubReviews = onSnapshot(
        collection(db, "rnReviewQueue"),
        (snapshot) => {
          const data: PendingReview[] = [];
          snapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() } as PendingReview);
          });
          data.sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );
          setPendingReviews(data);
        },
        (error) => {
          console.error("Error fetching reviews: ", error);
        },
      );
    } catch (e) {
      console.error("Dashboard effect error", e);
      setIsLoading(false);
    }

    return () => {
      unsubResidents();
      unsubReviews();
    };
  }, []);

  const handleResidentClick = (id: string) => {
    setSelectedResidentId(id);
    setCurrentScreen("profile");
  };

  const handleSirsReport = async (data: SIRSAlertData) => {
    try {
      await addDoc(collection(db, "sirsEvents"), {
        ...data,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to save SIRS event", err);
    }
    setGlobalSirsAlert(data);
    setCurrentScreen("dashboard"); // go back to dashboard to see the alert
  };

  const addPendingReview = async (
    residentId: string,
    photoUrl: string,
    aiResult: AIObservationResult,
  ) => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident) return;

    try {
      await addDoc(collection(db, "rnReviewQueue"), {
        residentId,
        residentName: resident.name,
        room: resident.room,
        photoUrl,
        aiResult,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to add pending review", e);
    }
  };

  const removePendingReview = async (id: string) => {
    const review = pendingReviews.find((r) => r.id === id);
    if (review) {
      try {
        await addDoc(collection(db, "observations"), {
          residentId: review.residentId,
          type: review.aiResult.observationType || "general",
          photoUrl: review.photoUrl || "",
          aiAnalysis: review.aiResult.observation,
          location: review.aiResult.bodyLocation || "",
          sizeEstimate: review.aiResult.estimatedSizeOrType || "",
          riskFlag: review.aiResult.potentialRiskFlag || "",
          timestamp: serverTimestamp(),
          status: "confirmed",
          confirmedBy: userProfile?.displayName || "Registered Nurse",
        });
      } catch (e) {
        console.error("Failed to move review to observations", e);
      }
    }
    try {
      await deleteDoc(doc(db, "rnReviewQueue", id));
    } catch (e) {
      console.error("Failed to delete review", e);
    }
  };

  const clearAlert = () => {
    setGlobalSirsAlert(null);
  };

  const handleGenerateHandover = async () => {
    setIsGeneratingHandover(true);
    setHandoverText(null);
    try {
      // Fetch SIRS events for today (simulated with global alert text if exists)
      const sirsEvents = globalSirsAlert ? [globalSirsAlert] : [];
      
      const response = await fetch('/api/shift-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          residents,
          sirsEvents,
          rnReviews: pendingReviews
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setHandoverText(data.result);
    } catch (err) {
      console.error(err);
      setHandoverText("Failed to generate handover. Please try again.");
    } finally {
      setIsGeneratingHandover(false);
    }
  };

  const simulateFallAlert = () => {
    setGlobalSirsAlert({
      id: "sim-" + Date.now(),
      message: "Sensor Alert: Fall Detected in Room 204 (Joyce).",
      priority: 1,
      createdAt: new Date().toISOString()
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-12 h-12 text-teal-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading Dashboard Data...</p>
      </div>
    );
  }

  // Permissions derived from Role
  const isCaregiver = userProfile?.role === "caregiver";
  const isRN = userProfile?.role === "rn";
  const isManager = userProfile?.role === "manager";
  const isAdmin = userProfile?.role === "admin";

  const canReviewRNQueue = isRN || isAdmin;
  const canAccessRoster = isManager || isAdmin;
  const canLogSirs = isManager || isRN || isAdmin;
  const canDismissSirs = isManager || isAdmin;

  // Filter residents for caregivers (e.g. they only see a subset they are assigned to)
  const visibleResidents = isCaregiver
    ? residents.filter((r) => ["1", "2", "3"].includes(r.id))
    : residents;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {!isOnline && (
        <div className="bg-amber-100 text-amber-800 px-4 py-2 text-sm flex items-center justify-center font-medium shadow-inner">
          <WifiOff className="w-4 h-4 mr-2" />
          {t('offline')}
        </div>
      )}
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 select-none sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0"
            onClick={() => setCurrentScreen("dashboard")}
          >
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 shrink-0" />
            <span className="font-normal text-slate-800 text-sm sm:text-lg tracking-tight truncate">
              Sunrise<span className="hidden sm:inline"> Care Facility</span>
            </span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:block text-xs text-right">
              <span className="block font-medium text-slate-700">
                {userProfile?.displayName}
              </span>
              <span className="block text-slate-500 capitalize">
                {userProfile?.role}
              </span>
            </div>

            {/* Language Toggle */}
            <div className="relative group">
              <button className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors">
                <Globe className="w-5 h-5" />
                <span className="ml-1 text-xs uppercase font-medium">{lang}</span>
              </button>
              <div className="absolute right-0 mt-1 w-24 bg-white rounded-lg shadow-lg border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <button onClick={() => setLang('en')} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 \${lang === 'en' ? 'text-indigo-600 font-medium' : 'text-slate-600'}`}>English</button>
                <button onClick={() => setLang('zh')} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 \${lang === 'zh' ? 'text-indigo-600 font-medium' : 'text-slate-600'}`}>中文</button>
                <button onClick={() => setLang('tl')} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 \${lang === 'tl' ? 'text-indigo-600 font-medium' : 'text-slate-600'}`}>Tagalog</button>
              </div>
            </div>

            {/* RN Notification */}
            {canReviewRNQueue && (
              <button
                onClick={() => setCurrentScreen("rnReview")}
                className="relative p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-full transition-colors flex items-center justify-center shrink-0"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {pendingReviews.length > 0 && (
                  <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] font-bold text-white items-center justify-center">
                      {pendingReviews.length}
                    </span>
                  </span>
                )}
              </button>
            )}

            {canAccessRoster && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateHandover}
                  className="flex items-center gap-1.5 sm:gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 sm:px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-all font-sans shrink-0"
                >
                  <FileText className="w-3.5 h-3.5 hidden sm:block" />
                  <span className="text-xs font-medium">{t('handover')}</span>
                </button>
                <button
                  onClick={() => setCurrentScreen("staff")}
                  className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 px-2 sm:px-3 py-1.5 rounded-md hover:bg-slate-100 hover:border-slate-300 transition-all font-sans shrink-0"
                >
                  <Users className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
                  <span className="text-xs font-normal text-slate-600">
                    {t('staff')}
                  </span>
                </button>
                <button
                  onClick={() => setCurrentScreen("roster")}
                  className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 px-2 sm:px-3 py-1.5 rounded-md hover:bg-slate-100 hover:border-slate-300 transition-all font-sans shrink-0"
                >
                  <Users className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
                  <span className="text-xs font-normal text-slate-600">
                    {t('roster')}
                  </span>
                </button>
              </div>
            )}

            <button
              onClick={() => logout()}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Global SIRS Alert Banner */}
      {globalSirsAlert && (
        <div
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 animate-in zoom-in-95 duration-300 ${globalSirsAlert.priority === 1 ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"}`}
        >
          <ShieldAlert
            className={`w-24 h-24 mb-6 ${globalSirsAlert.priority === 1 ? "text-white" : "text-amber-600"}`}
          />
          <h2
            className={`text-4xl md:text-5xl font-bold tracking-tight text-center mb-4 uppercase ${globalSirsAlert.priority === 1 ? "text-white" : "text-amber-900"}`}
          >
            SIRS Priority {globalSirsAlert.priority} Alert
          </h2>
          <p
            className={`text-xl md:text-2xl font-light text-center mb-8 max-w-2xl p-4 rounded-xl border shadow-inner ${globalSirsAlert.priority === 1 ? "bg-red-700/50 border-red-500 text-white" : "bg-amber-200/50 border-amber-300 text-amber-800"}`}
          >
            {globalSirsAlert.priority === 1
              ? "Legally mandatory to report to ACQSC within 24 hours."
              : "Report to ACQSC within 30 days."}
          </p>
          <div
            className={`p-6 rounded-xl border max-w-3xl mb-12 ${globalSirsAlert.priority === 1 ? "bg-white/10 border-red-500/50" : "bg-white/50 border-amber-300"}`}
          >
            <p className="text-lg md:text-xl font-light text-center opacity-90 leading-relaxed text-balance">
              {globalSirsAlert.message}
            </p>
          </div>
          {canDismissSirs ? (
            <button
              onClick={clearAlert}
              className={`px-8 py-4 font-bold text-lg rounded-xl shadow-2xl transition-colors transform hover:scale-105 active:scale-95 ${globalSirsAlert.priority === 1 ? "bg-white text-red-700 hover:bg-red-50" : "bg-amber-600 text-white hover:bg-amber-700"}`}
            >
              Manager Approve & Dismiss
            </button>
          ) : (
            <p className="mt-4 text-sm opacity-80">
              (Only a Manager or Admin can dismiss this alert)
            </p>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        {currentScreen === "dashboard" && (
          <Dashboard
            residents={visibleResidents}
            onResidentClick={handleResidentClick}
            onNewReport={() => setCurrentScreen("sirs")}
            canLogSirs={canLogSirs}
          />
        )}

        {currentScreen === "profile" &&
          selectedResidentId &&
          residents.find((r) => r.id === selectedResidentId) && (
            <ResidentProfile
              resident={residents.find((r) => r.id === selectedResidentId)!}
              onBack={() => setCurrentScreen("dashboard")}
              onSubmitObservation={(photoUrl, aiResult) =>
                addPendingReview(selectedResidentId, photoUrl, aiResult)
              }
              isCaregiver={isCaregiver}
            />
          )}

        {currentScreen === "sirs" && canLogSirs && (
          <SirsReporter
            onCancel={() => setCurrentScreen("dashboard")}
            onSubmit={handleSirsReport}
          />
        )}

        {currentScreen === "roster" && canAccessRoster && (
          <RosterComplianceGuard onBack={() => setCurrentScreen("dashboard")} />
        )}

        {currentScreen === "rnReview" && canReviewRNQueue && (
          <RNReviewList
            onBack={() => setCurrentScreen("dashboard")}
            pendingReviews={pendingReviews}
            onConfirmReview={removePendingReview}
          />
        )}

        {currentScreen === "staff" && canAccessRoster && (
          <StaffManager onBack={() => setCurrentScreen("dashboard")} />
        )}
      </main>

      {/* Mobile Floating Action Button for easy access to SIRS */}
      {currentScreen !== "sirs" && canLogSirs && (
        <button
          onClick={() => setCurrentScreen("sirs")}
          className="md:hidden fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-red-600/90 backdrop-blur text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-700 transition-colors z-30"
          aria-label="New Incident Report"
        >
          <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Handover Modal */}
      {(isGeneratingHandover || handoverText) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-medium text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Shift Handover Report
              </h2>
              <button
                onClick={() => { setIsGeneratingHandover(false); setHandoverText(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="p-6 overflow-y-auto min-h-[200px]">
              {isGeneratingHandover ? (
                <div className="flex flex-col items-center justify-center text-slate-500 h-40 space-y-4">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-sm">Synthesizing clinical handover data...</p>
                </div>
              ) : (
                <div className="whitespace-pre-line text-sm text-slate-700 leading-relaxed font-sans">
                  {handoverText}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Simulator Tools (For Demo/Dev only) */}
      <div className="fixed bottom-4 left-4 z-40 opacity-30 hover:opacity-100 transition-opacity">
        <button
          onClick={simulateFallAlert}
          className="text-[10px] bg-slate-800 text-white px-2 py-1 rounded shadow"
        >
          Dev: Trigger IoT Fall Alert
        </button>
      </div>

    </div>
  );
};
