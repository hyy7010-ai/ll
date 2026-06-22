import React from 'react';
import { ArrowLeft, AlertTriangle, Lock, ShieldCheck, Clock, Users, XOctagon } from 'lucide-react';

interface Shift {
  id: string;
  day: string;
  shiftType: 'Day' | 'Evening' | 'Night';
  time: string;
  rnCount: number;
  pwCount: number;
}

const mockRoster: Shift[] = [
  { id: '1', day: 'Monday', shiftType: 'Day', time: '07:00 - 15:00', rnCount: 3, pwCount: 15 },
  { id: '2', day: 'Monday', shiftType: 'Evening', time: '15:00 - 23:00', rnCount: 2, pwCount: 12 },
  { id: '3', day: 'Monday', shiftType: 'Night', time: '23:00 - 07:00', rnCount: 1, pwCount: 6 },
  
  { id: '4', day: 'Tuesday', shiftType: 'Day', time: '07:00 - 15:00', rnCount: 3, pwCount: 14 },
  { id: '5', day: 'Tuesday', shiftType: 'Evening', time: '15:00 - 23:00', rnCount: 2, pwCount: 12 },
  { id: '6', day: 'Tuesday', shiftType: 'Night', time: '23:00 - 07:00', rnCount: 1, pwCount: 6 },
  
  { id: '7', day: 'Wednesday', shiftType: 'Day', time: '07:00 - 15:00', rnCount: 3, pwCount: 15 },
  { id: '8', day: 'Wednesday', shiftType: 'Evening', time: '15:00 - 23:00', rnCount: 2, pwCount: 12 },
  { id: '9', day: 'Wednesday', shiftType: 'Night', time: '23:00 - 07:00', rnCount: 0, pwCount: 6 }, // DELIBERATE BREACH

  { id: '10', day: 'Thursday', shiftType: 'Day', time: '07:00 - 15:00', rnCount: 3, pwCount: 15 },
  { id: '11', day: 'Thursday', shiftType: 'Evening', time: '15:00 - 23:00', rnCount: 2, pwCount: 12 },
  { id: '12', day: 'Thursday', shiftType: 'Night', time: '23:00 - 07:00', rnCount: 1, pwCount: 6 },
  
  { id: '13', day: 'Friday', shiftType: 'Day', time: '07:00 - 15:00', rnCount: 3, pwCount: 15 },
  { id: '14', day: 'Friday', shiftType: 'Evening', time: '15:00 - 23:00', rnCount: 2, pwCount: 12 },
  { id: '15', day: 'Friday', shiftType: 'Night', time: '23:00 - 07:00', rnCount: 1, pwCount: 6 },
  
  { id: '16', day: 'Saturday', shiftType: 'Day', time: '07:00 - 15:00', rnCount: 2, pwCount: 12 },
  { id: '17', day: 'Saturday', shiftType: 'Evening', time: '15:00 - 23:00', rnCount: 1, pwCount: 10 },
  { id: '18', day: 'Saturday', shiftType: 'Night', time: '23:00 - 07:00', rnCount: 1, pwCount: 6 },
  
  { id: '19', day: 'Sunday', shiftType: 'Day', time: '07:00 - 15:00', rnCount: 2, pwCount: 12 },
  { id: '20', day: 'Sunday', shiftType: 'Evening', time: '15:00 - 23:00', rnCount: 1, pwCount: 10 },
  { id: '21', day: 'Sunday', shiftType: 'Night', time: '23:00 - 07:00', rnCount: 1, pwCount: 6 }
];

interface RosterComplianceGuardProps {
  onBack: () => void;
}

export function RosterComplianceGuard({ onBack }: RosterComplianceGuardProps) {
  const averageCareMinutes = 205; 
  const targetCareMinutes = 215;
  const isCareMinutesCompliant = averageCareMinutes >= targetCareMinutes;

  const averageRnMinutes = 40;
  const targetRnMinutes = 44;
  const isRnMinutesCompliant = averageRnMinutes >= targetRnMinutes;

  const breaches = mockRoster.filter(shift => shift.rnCount === 0);
  const hasRnBreach = breaches.length > 0;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const shiftTypes = ['Day', 'Evening', 'Night'];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-2xl font-medium tracking-tight text-slate-800">Roster Compliance Guard</h1>
        </div>
        <div className="flex gap-3">
          <button 
            disabled={hasRnBreach || !isCareMinutesCompliant}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-colors ${
              hasRnBreach || !isCareMinutesCompliant
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
            }`}
          >
            {hasRnBreach || !isCareMinutesCompliant ? (
              <><Lock className="w-4 h-4" /> Save Roster</>
            ) : (
              <><ShieldCheck className="w-4 h-4" /> Save Roster</>
            )}
          </button>
        </div>
      </div>

      {/* Blocking Banners */}
      {hasRnBreach && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-4">
          <XOctagon className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-800 font-bold tracking-tight">⚠️ Aged Care Act breach: No Registered Nurse coverage</h3>
            <div className="text-red-700 text-sm mt-1 space-y-1">
              {breaches.map(b => (
                <p key={b.id}>Missing RN for <strong>{b.day} {b.shiftType}</strong> shift ({b.time}).</p>
              ))}
              <p className="mt-2 font-medium">This facility is at risk of regulatory sanction. The roster cannot be saved until coverage is secured.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Care Minutes Widget */}
        <div className="lg:col-span-1 border border-slate-200 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-base font-medium tracking-tight text-slate-800 mb-6 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" /> Care Minutes Target
          </h2>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500">Average Total Care Minutes</span>
                <span className={isCareMinutesCompliant ? "text-slate-800 font-medium" : "text-red-600 font-bold"}>
                  {averageCareMinutes} / {targetCareMinutes} mins
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${isCareMinutesCompliant ? 'bg-teal-500' : 'bg-red-500'}`} 
                  style={{ width: `${Math.min(100, (averageCareMinutes / targetCareMinutes) * 100)}%` }}
                />
              </div>
              {!isCareMinutesCompliant && (
                <p className="text-xs text-red-600 font-medium mt-2">Below mandated {targetCareMinutes} care minutes — non-compliant</p>
              )}
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500">Of which RN Minutes</span>
                <span className={isRnMinutesCompliant ? "text-slate-800 font-medium" : "text-red-600 font-bold"}>
                  {averageRnMinutes} / {targetRnMinutes} mins
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${isRnMinutesCompliant ? 'bg-teal-500' : 'bg-red-500'}`} 
                  style={{ width: `${Math.min(100, (averageRnMinutes / targetRnMinutes) * 100)}%` }}
                />
              </div>
              {!isRnMinutesCompliant && (
                <p className="text-xs text-red-600 font-medium mt-2">Below mandated {targetRnMinutes} RN minutes — non-compliant</p>
              )}
            </div>
          </div>
        </div>

        {/* 24/7 RN Summary */}
        <div className="lg:col-span-2 border border-slate-200 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-base font-medium tracking-tight text-slate-800 mb-6 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" /> 24/7 RN Coverage Status
          </h2>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="text-3xl font-light text-slate-800 tracking-tight">
                {mockRoster.length - breaches.length} <span className="text-base text-slate-500 font-normal">/ {mockRoster.length} shifts covered</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                The Aged Care Act requires at least one Registered Nurse on-site and on duty at all times.
              </p>
            </div>
            {hasRnBreach ? (
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-8 h-8 text-teal-600" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Roster Grid */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-base font-medium tracking-tight text-slate-800">Weekly Roster View</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Day</th>
                {shiftTypes.map(type => (
                  <th key={type} className="px-6 py-4 font-medium">{type} Shift</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {days.map(day => (
                <tr key={day} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-medium text-slate-800 border-r border-slate-100">
                    {day}
                  </td>
                  {shiftTypes.map(type => {
                    const shift = mockRoster.find(s => s.day === day && s.shiftType === type);
                    if (!shift) return <td key={type} className="px-6 py-4"></td>;
                    
                    const isBreach = shift.rnCount === 0;
                    
                    return (
                      <td key={type} className={`px-6 py-4 border-r last:border-r-0 border-slate-100 ${isBreach ? 'bg-red-50' : ''}`}>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs text-slate-400 font-mono">{shift.time}</span>
                          <div className={`flex items-center gap-1.5 font-medium ${isBreach ? 'text-red-700' : 'text-teal-700'}`}>
                            {isBreach ? <AlertTriangle className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                            {shift.rnCount} RNs {isBreach && <span className="text-xs text-red-600 ml-1 uppercase tracking-wider">(Breach)</span>}
                          </div>
                          <div className="text-slate-500 text-xs">
                            {shift.pwCount} Care Workers
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
