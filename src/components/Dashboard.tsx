import React from "react";
import { ShieldAlert, Search, Filter } from "lucide-react";
import { Resident } from "../types";

interface DashboardProps {
  residents: Resident[];
  onResidentClick: (id: string) => void;
  onNewReport: () => void;
  canLogSirs: boolean;
}

export function Dashboard({
  residents,
  onResidentClick,
  onNewReport,
  canLogSirs,
}: DashboardProps) {
  const getInitials = (name: string) =>
    (name || "")
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .substring(0, 2);

  return (
    <div className="space-y-8 font-light">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-normal text-slate-800 tracking-tight">
            Live Dashboard
          </h1>
          <p className="text-slate-500 font-light mt-1 text-sm">
            Real-time resident wellness overview
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Find resident..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-light placeholder-slate-400 text-sm"
            />
          </div>
          <button className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <Filter className="w-5 h-5" />
          </button>
          {canLogSirs && (
            <button
              onClick={onNewReport}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-normal text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              <ShieldAlert className="w-4 h-4" />
              Log SIRS Incident
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {residents.map((resident) => (
          <button
            key={resident.id}
            onClick={() => onResidentClick(resident.id)}
            className="group block w-full text-left bg-white border border-slate-200 rounded-xl p-6 hover:border-teal-300 transition-all focus:outline-none focus:ring-1 focus:ring-teal-500"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-lg font-bold border border-teal-100">
                    {getInitials(resident.name)}
                  </div>
                  <div
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                      resident.statusColor === "red"
                        ? "bg-red-500"
                        : resident.statusColor === "yellow"
                          ? "bg-amber-400"
                          : "bg-teal-500"
                    }`}
                  ></div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                    {resident.name}
                  </h3>
                  <p className="text-sm font-light text-slate-500">
                    {resident.room}
                  </p>
                </div>
              </div>
            </div>

            {/* Status indicators */}
            <div className="grid grid-cols-3 gap-2 mt-2 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase font-light">
                  Bath
                </span>
                <StatusDot
                  status={
                    resident.bathStatus === "done"
                      ? "green"
                      : resident.bathStatus === "due"
                        ? "yellow"
                        : "red"
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase font-light">
                  Meal
                </span>
                <StatusDot
                  status={
                    resident.mealStatus === "eaten"
                      ? "green"
                      : resident.mealStatus === "assisted"
                        ? "yellow"
                        : "red"
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase font-light">
                  Toilet
                </span>
                <StatusDot
                  status={
                    resident.toiletStatus === "independent"
                      ? "green"
                      : resident.toiletStatus === "assisted"
                        ? "yellow"
                        : "red"
                  }
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-400 font-light">Care Minutes</span>
                <span className="font-bold text-slate-700">
                  {resident.careMinutesToday} / {resident.careMinutesTarget}m
                </span>
              </div>
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    resident.careMinutesToday / resident.careMinutesTarget >= 1
                      ? "bg-teal-400"
                      : "bg-teal-200"
                  }`}
                  style={{
                    width: `${Math.min((resident.careMinutesToday / resident.careMinutesTarget) * 100, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: "green" | "yellow" | "red" }) {
  return (
    <div
      className={`w-2 h-2 rounded-full ${
        status === "green"
          ? "bg-teal-400"
          : status === "yellow"
            ? "bg-amber-400"
            : "bg-red-400"
      }`}
    />
  );
}
