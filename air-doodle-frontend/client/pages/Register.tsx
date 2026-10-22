import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Mail, 
  Lock, 
  User as UserIcon, 
  Loader2,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/context/useAuth';

const Register = () => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      toast.success('Welcome to AirDoodle!');
      navigate('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-[10%] right-[10%] w-[35rem] h-[35rem] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] left-[10%] w-[30rem] h-[30rem] bg-indigo-500/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-semibold">Back to home</span>
        </Link>

        <div className="glass-card rounded-[2.5rem] p-10 border-border/40 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary/20" />
          
          <div className="text-center mb-10">
            <div className="inline-flex w-12 h-12 bg-foreground rounded-2xl items-center justify-center mb-6 shadow-xl shadow-foreground/10">
              <Zap className="w-7 h-7 text-background fill-current" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Create Account</h1>
            <p className="text-muted-foreground text-sm">Join creators using AirDoodle today.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">Full Name</Label>
              <div className="relative group">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  type="text" 
                  placeholder="Your Name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-11 h-14 rounded-2xl bg-secondary/30 border-border/20 focus-visible:ring-primary/20 text-base" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">Email Address</Label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  type="email" 
                  placeholder="name@company.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-14 rounded-2xl bg-secondary/30 border-border/20 focus-visible:ring-primary/20 text-base" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">Password</Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  type="password" 
                  placeholder="•••••••• (min. 6 characters)" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-14 rounded-2xl bg-secondary/30 border-border/20 focus-visible:ring-primary/20 text-base" 
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full h-14 rounded-2xl text-lg font-bold tracking-tight shadow-lg shadow-primary/20 group relative overflow-hidden"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Get Started Free
                  <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-border/20 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-bold hover:underline underline-offset-4">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
