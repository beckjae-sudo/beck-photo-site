"use client";

import { useEffect, useState } from "react";
import {
  getOrCreateVisitorProfile,
  updateVisitorName,
  VisitorProfile,
} from "@/lib/visitorIdentity";
import { logAlbumPresence, getAlbumPresence } from "@/app/actions/presence";
import { User, Edit3, X, Users, Check } from "lucide-react";

interface ViewerPresenceBadgeProps {
  albumId: string;
}

export default function ViewerPresenceBadge({ albumId }: ViewerPresenceBadgeProps) {
  const [profile, setProfile] = useState<VisitorProfile | null>(null);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputName, setInputName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Initialize identity and register presence
  useEffect(() => {
    const current = getOrCreateVisitorProfile();
    setProfile(current);
    setInputName(current.name || "");

    const displayName = current.name || `Sideline ${current.avatarAnimal}`;

    // 1. Fetch current roster
    getAlbumPresence(albumId).then((res) => {
      if (res.visitors) setVisitors(res.visitors);
    });

    // 2. Log this visit
    logAlbumPresence(albumId, {
      id: current.id,
      name: displayName,
      emoji: current.avatarEmoji,
      color: current.avatarColor,
      isCustomName: current.isCustomName,
    }).then((res) => {
      if (res.visitors) setVisitors(res.visitors);
    });
  }, [albumId]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updated = updateVisitorName(inputName);
    setProfile(updated);

    const displayName = updated.name || `Sideline ${updated.avatarAnimal}`;

    const res = await logAlbumPresence(albumId, {
      id: updated.id,
      name: displayName,
      emoji: updated.avatarEmoji,
      color: updated.avatarColor,
      isCustomName: updated.isCustomName,
    });

    if (res.visitors) setVisitors(res.visitors);

    setIsSaving(false);
    setIsModalOpen(false);
  };

  if (!profile) return null;

  const currentDisplayName = profile.name || `Sideline ${profile.avatarAnimal}`;
  const otherVisitors = visitors.filter((v) => v.id !== profile.id);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {/* Visitor's Interactive Profile Pill */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition cursor-pointer shadow-sm text-xs"
          title="Click to personalize your name on the sideline roster"
        >
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neutral-800 text-[11px] border border-white/10">
            {profile.avatarEmoji}
          </span>
          <span className="font-medium text-neutral-200 group-hover:text-white">
            {currentDisplayName}{" "}
            <span className="text-[10px] text-neutral-500 font-mono">(You)</span>
          </span>
          <span className="text-[11px] text-blue-400 font-mono flex items-center gap-1 pl-1 border-l border-neutral-800 group-hover:underline">
            <Edit3 size={11} />
            {profile.isCustomName ? "Edit" : "Say Hi"}
          </span>
        </button>

        {/* Live / Recent Avatars Stack */}
        {visitors.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
            <div className="flex -space-x-1.5 overflow-hidden p-0.5">
              {visitors.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-800 border-2 border-neutral-950 text-[11px] shadow-sm"
                  title={v.name}
                >
                  {v.emoji || "👤"}
                </div>
              ))}
            </div>
            <span className="text-[11px] text-neutral-500">
              {visitors.length === 1 ? "1 viewer" : `${visitors.length} viewers`}
            </span>
          </div>
        )}
      </div>

      {/* ----------------- NAME EDIT MODAL ----------------- */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-2xl p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-lg">
                  {profile.avatarEmoji}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Join the Sideline Roster</h3>
                  <p className="text-xs text-neutral-400 font-mono">
                    Mascot: {profile.avatarAnimal}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300 block">
                  Your Name or Nickname
                </label>
                <input
                  type="text"
                  placeholder={`e.g. Coach Dave, Sarah M., Grandma`}
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 font-sans"
                  autoFocus
                />
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Saved directly to your browser so the team knows you checked out the shots.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-950/40 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  <span>{isSaving ? "Saving..." : "Save Name"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
