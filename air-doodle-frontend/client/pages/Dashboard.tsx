import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { 
  Clock, 
  Grid, 
  Home, 
  LogOut, 
  Plus, 
  Search, 
  Zap, 
  Trash2, 
  Edit2, 
  MoreVertical, 
  Shapes,
  FolderOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/useAuth";
import { createProject, deleteProject, listProjects, renameProject, getProjectPreview } from "@/services/project.service";
import { Project } from "@/types/project";
import { Shape } from "@/types/shape";
import { toast } from "sonner";

const Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [previews, setPreviews] = useState<Record<string, Shape[]>>({});
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      const data = await listProjects();
      setProjects(data);
      // Fetch previews for top 12 projects
      data.slice(0, 12).forEach((p) => {
        getProjectPreview(p.id)
          .then((res) => {
            if (res.shapes) {
              setPreviews((prev) => ({ ...prev, [p.id]: res.shapes }));
            }
          })
          .catch(() => {});
      });
    } catch {
      toast.error("Could not load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const visibleProjects = useMemo(
    () => projects.filter((project) => project.title.toLowerCase().includes(search.toLowerCase())),
    [projects, search]
  );

  const handleCreateProject = async () => {
    try {
      const project = await createProject("Untitled Project");
      setProjects((previous) => [project, ...previous]);
      toast.success("Project created");
      navigate(`/project/${project.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not create project";
      toast.error(msg);
    }
  };

  const handleRename = async (projectId: string, currentTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newTitle = window.prompt("Rename Project:", currentTitle);
    if (!newTitle || newTitle.trim() === "" || newTitle === currentTitle) return;

    try {
      await renameProject(projectId, newTitle.trim());
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, title: newTitle.trim(), updatedAt: new Date().toISOString() } : p))
      );
      toast.success("Project renamed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not rename project";
      toast.error(msg);
    }
  };

  const handleDelete = async (projectId: string, title: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      toast.success("Project deleted");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not delete project";
      toast.error(msg);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-border/40 bg-background/50 backdrop-blur-xl hidden lg:flex flex-col p-6">
        <Link to="/dashboard" className="flex items-center gap-2 mb-10 px-2">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-background fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight">AirDoodle</span>
        </Link>
        <div className="flex items-center gap-3 rounded-2xl bg-primary text-primary-foreground px-4 py-3 font-bold">
          <Grid className="w-5 h-5" />
          <span className="text-sm">Projects</span>
        </div>
        <div className="mt-auto pt-6 border-t border-border/40 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <Avatar className="h-9 w-9 border border-border/40">
              <AvatarFallback>{user?.name.slice(0, 2).toUpperCase() ?? "AD"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 rounded-2xl text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/30 overflow-y-auto">
        <header className="h-20 px-6 sm:px-8 border-b border-border/20 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-40 gap-4">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-background fill-current" />
            </div>
            <span className="font-bold tracking-tight text-lg">AirDoodle</span>
          </div>

          <div className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your projects..."
              className="pl-10 h-11 bg-secondary/30 border-border/20 rounded-2xl text-sm"
            />
          </div>

          {/* User Account Menu with responsive logout */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                <Avatar className="h-10 w-10 border border-border/40 cursor-pointer">
                  <AvatarFallback>{user?.name.slice(0, 2).toUpperCase() ?? "AD"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-border/40">
              <div className="p-2">
                <p className="text-sm font-bold truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive rounded-xl gap-2">
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <div className="p-6 sm:p-8 lg:p-12 max-w-7xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-2">My Projects</h1>
              <p className="text-muted-foreground">
                {projects.length} {projects.length === 1 ? "project" : "projects"} in your private workspace.
              </p>
            </div>
            <Button
              onClick={handleCreateProject}
              size="lg"
              className="rounded-full px-8 h-12 gap-2 shadow-lg shadow-primary/20 group shrink-0"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" /> Create Project
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((index) => (
                <div key={index} className="aspect-[4/3] rounded-3xl bg-secondary/20 animate-pulse border border-border/20" />
              ))}
            </div>
          ) : visibleProjects.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  shapes={previews[project.id]}
                  onRename={(e) => handleRename(project.id, project.title, e)}
                  onDelete={(e) => handleDelete(project.id, project.title, e)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/40 p-16 text-center">
              <div className="w-16 h-16 rounded-full bg-secondary/40 flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-1">No projects found</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                {search ? "No projects match your search query." : "You don't have any projects yet. Create your first project to start doodling!"}
              </p>
              {!search && (
                <Button onClick={handleCreateProject} className="rounded-full px-6">
                  <Plus className="w-4 h-4 mr-2" /> Create First Project
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

function ProjectCard({
  project,
  shapes,
  onRename,
  onDelete,
}: {
  project: Project;
  shapes?: Shape[];
  onRename: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <Link to={`/project/${project.id}`} className="block group">
      <motion.div
        whileHover={{ y: -6 }}
        className="glass-card rounded-3xl overflow-hidden border-border/40 hover:border-primary/50 transition-all shadow-xl relative"
      >
        <div className="aspect-[16/10] bg-secondary/30 relative overflow-hidden flex items-center justify-center border-b border-border/20">
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "20px 20px" }}
          />

          {shapes && shapes.length > 0 ? (
            <svg
              viewBox="0 0 1000 700"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full p-4 pointer-events-none"
            >
              {shapes.map((s) => {
                const style = {
                  stroke: s.style?.stroke || "#ffffff",
                  fill: s.style?.fill || "none",
                  strokeWidth: s.style?.strokeWidth || 2,
                };
                if (s.type === "rectangle") {
                  return <rect key={s.id} {...style} x={s.geometry.x} y={s.geometry.y} width={s.geometry.width} height={s.geometry.height} />;
                }
                if (s.type === "circle") {
                  return <circle key={s.id} {...style} cx={s.geometry.cx} cy={s.geometry.cy} r={s.geometry.r} />;
                }
                if (s.type === "line") {
                  return <line key={s.id} {...style} x1={s.geometry.x1} y1={s.geometry.y1} x2={s.geometry.x2} y2={s.geometry.y2} />;
                }
                if (s.type === "triangle" || s.type === "freehand") {
                  return <polyline key={s.id} {...style} fill="none" points={s.geometry.points.map(([x, y]) => `${x},${y}`).join(" ")} />;
                }
                return null;
              })}
            </svg>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground/30 gap-2">
              <Home className="w-10 h-10" />
              <span className="text-xs font-mono">Empty Canvas</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button variant="secondary" size="icon" className="h-8 w-8 rounded-xl shadow-md glass">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={onRename} className="gap-2 text-xs">
                  <Edit2 className="w-3.5 h-3.5" /> Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="gap-2 text-xs text-destructive focus:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg group-hover:text-primary transition-colors truncate">{project.title}</h2>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {new Date(project.updatedAt).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1 bg-secondary/50 px-2 py-0.5 rounded-full font-mono text-[10px]">
              <Shapes className="w-3 h-3" />
              {shapes ? `${shapes.length} shapes` : "Private"}
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default Dashboard;
