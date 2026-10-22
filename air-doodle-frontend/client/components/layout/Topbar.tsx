import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Download,
  Save,
  Zap,
  Radio,
  Share2,
  Edit2,
  FileCode,
  Image as ImageIcon,
  Check,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";

export type ExportType = "svg" | "png" | "jpeg" | "json";

interface TopbarProps {
  title: string;
  onRenameTitle?: (newTitle: string) => void;
  onSave: () => void;
  onExport: (format: ExportType) => void;
  onOpenShare?: () => void;
  saveStatus?: "saved" | "saving" | "unsaved";
  isLiveConnected?: boolean;
  visionConnected?: boolean;
  permission?: "owner" | "view" | "edit";
}

const Topbar: React.FC<TopbarProps> = ({
  title,
  onRenameTitle,
  onSave,
  onExport,
  onOpenShare,
  saveStatus = "saved",
  isLiveConnected,
  visionConnected,
  permission = "owner",
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title);

  const handleTitleSubmit = () => {
    setIsEditing(false);
    if (currentTitle.trim() && currentTitle !== title) {
      onRenameTitle?.(currentTitle.trim());
    } else {
      setCurrentTitle(title);
    }
  };

  const isReadOnly = permission === "view";

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-4 left-4 right-4 z-50 h-16 glass rounded-2xl flex items-center justify-between px-3 sm:px-6 border-border/40"
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon" aria-label="Back to projects" className="rounded-xl hover:bg-secondary/50 h-9 w-9">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="h-6 w-px bg-border/50 hidden sm:block" />
        <div className="w-8 h-8 shrink-0 bg-foreground rounded-lg flex items-center justify-center">
          <Zap className="w-5 h-5 text-background fill-current" />
        </div>

        {/* Project Title / Rename input */}
        {isEditing && !isReadOnly ? (
          <input
            autoFocus
            type="text"
            value={currentTitle}
            onChange={(e) => setCurrentTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSubmit();
              if (e.key === "Escape") {
                setCurrentTitle(title);
                setIsEditing(false);
              }
            }}
            className="bg-secondary/50 border border-primary/50 text-foreground font-bold px-2 py-0.5 rounded-lg text-sm sm:text-base outline-none max-w-[200px]"
          />
        ) : (
          <div
            onClick={() => !isReadOnly && setIsEditing(true)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors group ${
              !isReadOnly ? "hover:bg-secondary/40 cursor-pointer" : ""
            }`}
          >
            <h1 className="text-sm sm:text-base font-bold tracking-tight truncate max-w-[140px] sm:max-w-xs">{title}</h1>
            {!isReadOnly && <Edit2 className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
            {isReadOnly && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full ml-1">
                <Lock className="w-3 h-3" /> View Only
              </span>
            )}
          </div>
        )}

        {/* Save Status */}
        {!isReadOnly && (
          <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-primary" /> Saving...
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="w-3 h-3 text-emerald-400" /> Saved
              </>
            )}
            {saveStatus === "unsaved" && <span className="text-amber-400">● Unsaved changes</span>}
          </span>
        )}

        {/* Real-time Status Badges */}
        <div className="hidden md:flex items-center gap-2 ml-2">
          {isLiveConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Radio className="w-3 h-3 animate-pulse" /> Live Sync
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground border border-border/30">
              Local Safe
            </span>
          )}

          {visionConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
              Vision Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground border border-border/30">
              Mouse Active
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        {onOpenShare && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenShare}
            className="gap-1.5 text-muted-foreground hover:text-foreground h-9 px-3 rounded-xl"
          >
            <Share2 className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        )}

        {!isReadOnly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            className="gap-1.5 text-muted-foreground hover:text-foreground h-9 px-3 rounded-xl"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save</span>
          </Button>
        )}

        {/* Multi-Format Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5 h-9 px-3 rounded-xl bg-primary text-primary-foreground shadow-md">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 shadow-2xl">
            <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Export Artwork
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onExport("svg")} className="gap-2.5 text-xs font-semibold cursor-pointer rounded-xl">
              <FileCode className="w-4 h-4 text-violet-400" />
              SVG Vector (.svg)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("png")} className="gap-2.5 text-xs font-semibold cursor-pointer rounded-xl">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              PNG Image (.png)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("jpeg")} className="gap-2.5 text-xs font-semibold cursor-pointer rounded-xl">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              JPEG Image (.jpg)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onExport("json")} className="gap-2.5 text-xs font-semibold cursor-pointer rounded-xl">
              <FileCode className="w-4 h-4 text-blue-400" />
              AirDoodle Native (.json)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
};

export default Topbar;
