import React, { useState } from 'react';
import { ShieldAlert, Activity, User, PlusCircle, Users, Bell } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { ResidentProfile } from './components/ResidentProfile';
import { SirsReporter } from './components/SirsReporter';
import { RosterComplianceGuard } from './components/RosterComplianceGuard';
import { RNReviewList } from './components/RNReviewList';
import { SIRSAlertData, PendingReview, AIObservationResult } from './types';
import { mockResidents } from './data';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'profile' | 'sirs' | 'roster' | 'rnReview'>('dashboard');
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [globalSirsAlert, setGlobalSirsAlert] = useState<SIRSAlertData | null>(null);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([
    {
      id: "mock-pending-1",
      residentId: mockResidents[0].id,
      residentName: mockResidents[0].name,
      room: mockResidents[0].room,
      // Some generic skin tear / bruising image found online or via unsplash placeholder
      photoUrl: "https://placehold.co/400x400/f8fafc/94a3b8?text=Wound+Observation",
      aiResult: {
        observationType: "wound",
        observation: "Small skin tear observed on the left forearm. Approximately 2cm in length. Edges are approximated, mild erythema surrounding the area.",
        estimatedSizeOrType: "2cm length",
        potentialRiskFlag: "Monitor for infection",
        bodyLocation: "Left Forearm"
      },
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 mins ago
    }
  ]);

  const handleResidentClick = (id: string) => {
    setSelectedResidentId(id);
    setCurrentScreen('profile');
  };

  const handleSirsReport = (data: SIRSAlertData) => {
    setGlobalSirsAlert(data);
    setCurrentScreen('dashboard'); // go back to dashboard to see the alert
  };

  const addPendingReview = (residentId: string, photoUrl: string, aiResult: AIObservationResult) => {
    const resident = mockResidents.find(r => r.id === residentId);
    if (!resident) return;
    
    setPendingReviews(prev => [
      {
        id: crypto.randomUUID(),
        residentId,
        residentName: resident.name,
        room: resident.room,
        photoUrl,
        aiResult,
        timestamp: new Date().toISOString()
      },
      ...prev
    ]);
  };

  const removePendingReview = (id: string) => {
    setPendingReviews(prev => prev.filter(review => review.id !== id));
  };

  const clearAlert = () => {
    setGlobalSirsAlert(null);
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 select-none sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0" onClick={() => setCurrentScreen('dashboard')}>
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-teal-600 shrink-0" />
            <span className="font-normal text-slate-800 text-sm sm:text-lg tracking-tight truncate">Sunrise<span className="hidden sm:inline"> Care Facility</span></span>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6">
            {/* RN Notification */}
            <button
              onClick={() => setCurrentScreen('rnReview')}
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

            {/* Global metrics */}
            <div className="hidden md:flex flex-col items-end cursor-pointer group" onClick={() => setCurrentScreen('roster')}>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-normal group-hover:text-teal-600 transition-colors">Overall Care Minutes</span>
              <div className="w-48 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-teal-400 group-hover:bg-teal-500 transition-colors" style={{ width: '65%' }}></div>
              </div>
            </div>
            
            <button 
              onClick={() => setCurrentScreen('roster')}
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 px-2 sm:px-3 py-1.5 rounded-md hover:bg-slate-100 hover:border-slate-300 transition-all font-sans shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
              <span className="text-xs font-normal text-slate-600">Roster<span className="hidden sm:inline"> Guard</span></span>
            </button>
          </div>
        </div>
      </nav>

      {/* Global SIRS Alert Banner */}
      {globalSirsAlert && (
        globalSirsAlert.priority === 1 ? (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-red-600 text-white p-8 animate-in zoom-in-95 duration-300">
            <ShieldAlert className="w-24 h-24 mb-6 text-white" />
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-center mb-4 uppercase">
              SIRS Priority 1 Alert
            </h2>
            <p className="text-xl md:text-2xl font-light text-center mb-8 max-w-2xl bg-red-700/50 p-4 rounded-xl border border-red-500 shadow-inner">
              Legally mandatory to report to ACQSC within 24 hours.
            </p>
            <div className="bg-white/10 p-6 rounded-xl border border-red-500/50 max-w-3xl mb-12">
              <p className="text-lg md:text-xl font-light text-center opacity-90 leading-relaxed text-balance">
                {globalSirsAlert.message}
              </p>
            </div>
            <button 
              onClick={clearAlert}
              className="px-8 py-4 bg-white text-red-700 font-bold text-lg rounded-xl shadow-2xl hover:bg-red-50 transition-colors transform hover:scale-105 active:scale-95"
            >
              Manager Approve & Dismiss
            </button>
          </div>
        ) : (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-4 sm:px-6 lg:px-8 relative z-40 animate-in slide-in-from-top flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-start gap-4">
              <ShieldAlert className="w-8 h-8 shrink-0 text-amber-500" />
              <div>
                <h2 className="text-lg font-normal tracking-tight">SIRS Priority 2 Alert</h2>
                <p className="text-amber-700 font-light text-sm mt-1">Report to ACQSC within 30 days.</p>
                <p className="text-sm mt-1 max-w-3xl font-light text-amber-800">{globalSirsAlert.message}</p>
              </div>
            </div>
            <button 
              onClick={clearAlert}
              className="whitespace-nowrap px-4 py-2 bg-white border border-amber-200 text-amber-700 font-normal rounded-lg hover:bg-neutral-50 transition-colors text-sm"
            >
              Manager Approve & Dismiss
            </button>
          </div>
        )
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        {currentScreen === 'dashboard' && (
          <Dashboard 
            residents={mockResidents} 
            onResidentClick={handleResidentClick} 
            onNewReport={() => setCurrentScreen('sirs')}
          />
        )}
        
        {currentScreen === 'profile' && selectedResidentId && (
          <ResidentProfile 
            resident={mockResidents.find(r => r.id === selectedResidentId)!} 
            onBack={() => setCurrentScreen('dashboard')}
            onSubmitObservation={(photoUrl, aiResult) => addPendingReview(selectedResidentId, photoUrl, aiResult)}
          />
        )}

        {currentScreen === 'sirs' && (
          <SirsReporter 
            onCancel={() => setCurrentScreen('dashboard')}
            onSubmit={handleSirsReport}
          />
        )}

        {currentScreen === 'roster' && (
          <RosterComplianceGuard onBack={() => setCurrentScreen('dashboard')} />
        )}

        {currentScreen === 'rnReview' && (
          <RNReviewList 
            onBack={() => setCurrentScreen('dashboard')}
            pendingReviews={pendingReviews}
            onConfirmReview={removePendingReview}
          />
        )}
      </main>
      
      {/* Mobile Floating Action Button for easy access to SIRS */}
      {currentScreen !== 'sirs' && (
        <button
          onClick={() => setCurrentScreen('sirs')}
          className="md:hidden fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-red-600/90 backdrop-blur text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-700 transition-colors z-30"
          aria-label="New Incident Report"
        >
          <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}
    </div>
  );
}
