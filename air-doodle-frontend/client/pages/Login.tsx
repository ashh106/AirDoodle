import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Mail, 
  Lock, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/context/useAuth';

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back to AirDoodle!');
      navigate('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid credentials. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-[20%] left-[10%] w-[30rem] h-[30rem] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[25rem] h-[25rem] bg-primary/10 rounded-full blur-[100px]" />
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
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Welcome Back</h1>
            <p className="text-muted-foreground text-sm">Enter your credentials to continue your work.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
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
              <div className="flex items-center justify-between pl-1">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  Forgot password?
                </Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  type="password" 
                  placeholder="••••••••" 
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
                  Sign In
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-border/20 text-center">
            <p className="text-sm text-muted-foreground font-medium">
              New to AirDoodle?{' '}
              <Link to="/register" className="text-primary font-bold hover:underline underline-offset-4">
                Create an account
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground/80 font-mono">Default Demo: demo@airdoodle.com / password123</p>
      </motion.div>
    </div>
  );
};

export default Login;
