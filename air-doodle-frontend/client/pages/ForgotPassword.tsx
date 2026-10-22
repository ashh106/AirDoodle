import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Zap, 
  Mail, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { authService, ForgotPasswordResponse } from '@/services/auth.service';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const data = await authService.forgotPassword(email);
      setResult(data);
      setSubmitted(true);
      toast.success('Reset link requested');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not process request';
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
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Reset Password</h1>
            <p className="text-muted-foreground text-sm">
              Enter your email address to receive a secure reset link.
            </p>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-6">
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

              <Button 
                type="submit" 
                disabled={loading}
                className="w-full h-14 rounded-2xl text-lg font-bold tracking-tight shadow-lg shadow-primary/20 group relative overflow-hidden"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Send Reset Link
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
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result?.message}
              </p>

              {result?._dev_reset_url && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>Local Development Test Link</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    SMTP is not configured. Click the button below to complete the reset workflow:
                  </p>
                  <Link to={result._dev_reset_url}>
                    <Button variant="secondary" size="sm" className="w-full mt-2 rounded-xl text-xs font-semibold">
                      Open Reset Password Page
                    </Button>
                  </Link>
                </div>
              )}

              <Link to="/login">
                <Button variant="outline" className="w-full h-12 rounded-2xl mt-4">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
