import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, ArrowLeft, Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <div className="text-center max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex w-20 h-20 bg-secondary rounded-3xl items-center justify-center mb-8 shadow-xl">
            <Ghost className="w-10 h-10 text-primary animate-bounce" />
          </div>
          <h1 className="text-6xl font-black tracking-tighter mb-4 italic">404</h1>
          <h2 className="text-2xl font-bold mb-4 tracking-tight">You've reached the edge of the doodle.</h2>
          <p className="text-muted-foreground mb-12 leading-relaxed">
            The page you're looking for doesn't exist or has been moved to another dimension.
          </p>
          
          <Link to="/">
            <Button size="lg" className="rounded-full px-8 h-12 gap-2 shadow-lg shadow-primary/20">
              <ArrowLeft className="w-5 h-5" />
              Return to Safety
            </Button>
          </Link>
        </motion.div>

        <div className="mt-20 flex items-center justify-center gap-2 opacity-20">
          <div className="w-6 h-6 bg-foreground rounded flex items-center justify-center">
            <Zap className="w-4 h-4 text-background fill-current" />
          </div>
          <span className="font-bold tracking-tight">AirDoodle</span>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
