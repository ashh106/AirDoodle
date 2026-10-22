import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Zap, 
  Lock, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { authService } from '@/services/auth.service';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Missing reset token in URL');
      return;
    }

    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(token, newPassword);
      setSuccess(true);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 2500);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-[20%] right-[10%] w-[30rem] h-[30rem] bg-primary/10 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Link to="/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-semibold">Back to sign in</span>
        </Link>

        <div className="glass-card rounded-[2.5rem] p-10 border-border/40 shadow-2xl relative overflow-hidden">
          <div className="text-center mb-8">
            <div className="inline-flex w-12 h-12 bg-foreground rounded-2xl items-center justify-center mb-6 shadow-xl shadow-foreground/10">
              <Zap className="w-7 h-7 text-background fill-current" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Create New Password</h1>
            <p className="text-muted-foreground text-sm">
              Please enter your new password below.
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleReset} className="space-y-6">
              {!token && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold">
                  No reset token provided. Please use the link sent to your email.
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">New Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    type="password" 
                    placeholder="•••••••• (min. 6 characters)" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-11 h-14 rounded-2xl bg-secondary/30 border-border/20 focus-visible:ring-primary/20 text-base" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground pl-1">Confirm Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-11 h-14 rounded-2xl bg-secondary/30 border-border/20 focus-visible:ring-primary/20 text-base" 
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading || !token}
                className="w-full h-14 rounded-2xl text-lg font-bold tracking-tight shadow-lg shadow-primary/20 group relative overflow-hidden"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Update Password
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold">Password Reset Complete</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been securely updated. Redirecting to sign in...
              </p>
              <Link to="/login">
                <Button className="w-full h-12 rounded-2xl mt-4">
                  Sign In Now
                </Button>
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
