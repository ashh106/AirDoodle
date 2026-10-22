import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  Square,
  PenTool,
  Download,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-background fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight">AirDoodle</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              Sign In
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button size="sm" className="rounded-full px-6">
              Start Doodling
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none -z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.1, scale: 1 }}
            transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            className="absolute top-20 right-[10%] w-[40rem] h-[40rem] bg-primary/20 rounded-full blur-[100px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.05, scale: 1 }}
            transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: 1 }}
            className="absolute bottom-10 left-[5%] w-[30rem] h-[30rem] bg-primary/30 rounded-full blur-[80px]"
          />
        </div>

        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border/50 text-xs font-medium text-muted-foreground mb-8">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              Mouse-first 2D workspace
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/60 leading-[1.1]">
              Draw freely. <br />
              Refine every shape.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
              Sketch with your mouse, turn strokes into editable shapes, and export your project as SVG.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/dashboard">
                <Button size="lg" className="h-14 px-8 rounded-full text-lg font-semibold group transition-all duration-300 hover:scale-105 shadow-lg shadow-primary/20">
                  Start Doodling Free
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Canvas Preview / Placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="mt-20 relative"
          >
            <div className="aspect-[16/9] max-w-5xl mx-auto glass-card rounded-2xl overflow-hidden p-2 group">
              <div className="w-full h-full bg-secondary/20 rounded-xl relative flex items-center justify-center">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                <svg viewBox="0 0 800 450" className="h-full w-full" aria-label="Example editable AirDoodle shapes">
                  <rect x="180" y="115" width="210" height="145" rx="4" fill="none" stroke="white" strokeWidth="3" />
                  <circle cx="520" cy="185" r="72" fill="none" stroke="#8b5cf6" strokeWidth="4" />
                  <path d="M300 325 L500 305" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
                  <path d="M570 315 L640 210 L710 315 Z" fill="none" stroke="#f59e0b" strokeWidth="3" />
                </svg>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 relative bg-secondary/10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for speed and clarity</h2>
            <p className="text-muted-foreground">Everything you need, nothing you don't.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard icon={<Square className="w-6 h-6" />} title="Editable shapes" description="Create rectangles, circles, lines, triangles, and freehand-to-shape strokes." delay={0.1} />
            <FeatureCard icon={<PenTool className="w-6 h-6" />} title="Mouse-first drawing" description="Draw with a mouse today, with a shared input pipeline ready for future gesture input." delay={0.2} />
            <FeatureCard icon={<Download className="w-6 h-6" />} title="SVG export" description="Download your current project as an SVG with a fixed 1000 × 700 viewBox." delay={0.3} />
            <FeatureCard icon={<Zap className="w-6 h-6" />} title="Local projects" description="Projects and shapes are saved in this browser using localStorage." delay={0.4} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/40 bg-background/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2 opacity-60">
            <div className="w-6 h-6 bg-foreground rounded flex items-center justify-center">
              <Zap className="w-4 h-4 text-background fill-current" />
            </div>
            <span className="font-bold tracking-tight">AirDoodle</span>
          </div>
          <p className="text-sm text-muted-foreground">Mouse-driven project workspace</p>
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} AirDoodle. Built for the future of visual thinking.
          </p>
        </div>
      </footer>
    </div>
  );
};

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="p-8 rounded-2xl border border-border/50 bg-background/50 hover:border-primary/50 hover:bg-primary/5 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-primary">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}

export default Index;
