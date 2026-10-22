import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, Eye, Edit3, Trash2, Plus, Share2, Loader2, ShieldCheck } from "lucide-react";
import { createShareLink, listShares, revokeShare, ShareLinkResponse } from "@/services/project.service";
import { toast } from "sonner";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectTitle,
}) => {
  const [shares, setShares] = useState<ShareLinkResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && projectId) {
      setLoading(true);
      listShares(projectId)
        .then(setShares)
        .catch(() => toast.error("Could not load sharing links"))
        .finally(() => setLoading(false));
    }
  }, [isOpen, projectId]);

  const handleCreateShare = async (permission: "view" | "edit") => {
    setCreating(true);
    try {
      const share = await createShareLink(projectId, permission);
      setShares((prev) => [share, ...prev]);
      toast.success(`${permission === "edit" ? "Edit" : "View-only"} link created!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create share link";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token: string) => {
    try {
      await revokeShare(projectId, token);
      setShares((prev) => prev.filter((s) => s.token !== token));
      toast.success("Share link revoked");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke link";
      toast.error(msg);
    }
  };

  const copyToClipboard = (token: string) => {
    const origin = window.location.origin;
    const url = `${origin}/project/${projectId}?shareToken=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-3xl p-6 glass border-border/40 shadow-2xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <DialogTitle className="text-xl font-bold">Share Project</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Share <span className="font-semibold text-foreground">"{projectTitle}"</span> with collaborators using secure unguessable tokens.
          </DialogDescription>
        </DialogHeader>

        {/* Create Links */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleCreateShare("view")}
              disabled={creating}
              variant="outline"
              size="sm"
              className="flex-1 gap-2 rounded-xl text-xs h-10 border-border/40 hover:bg-secondary/40"
            >
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>Create View Link</span>
            </Button>
            <Button
              onClick={() => handleCreateShare("edit")}
              disabled={creating}
              size="sm"
              className="flex-1 gap-2 rounded-xl text-xs h-10 bg-primary text-primary-foreground shadow-md"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Create Edit Link</span>
            </Button>
          </div>

          <div className="h-px bg-border/40" />

          {/* Active Links List */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Active Share Links
            </h4>

            {loading ? (
              <div className="py-6 flex items-center justify-center text-muted-foreground text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading shares...
              </div>
            ) : shares.length > 0 ? (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {shares.map((share) => (
                  <div
                    key={share.token}
                    className="p-3 rounded-2xl bg-secondary/30 border border-border/30 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            share.permission === "edit"
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {share.permission === "edit" ? "Can Edit" : "View Only"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono truncate">
                          ...{share.token.slice(-8)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(share.token)}
                        className="h-8 px-2.5 rounded-xl gap-1.5 text-xs hover:bg-secondary/60"
                      >
                        {copiedToken === share.token ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span>{copiedToken === share.token ? "Copied" : "Copy"}</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRevoke(share.token)}
                        className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Revoke link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">
                No active links. This project is currently private to you only.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
