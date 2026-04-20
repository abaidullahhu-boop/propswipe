import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import PropswipeLogo from "./PropswipeLogo";
import PropertyFeedAuth from "./PropertyFeedAuth";
import { ThemeToggle } from "./ThemeToggle";

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    try {
      await login(email, password);
      setLocation("/");
      onSuccess?.();
    } catch (error) {
      // Error is already handled in AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>

      <div
        className="min-h-screen animated-bg flex items-center justify-center p-4 relative overflow-hidden"
        style={{ fontFamily: "var(--font-body)" }}
      >
        
        {/* Floating orbs */}
        <div
          className="absolute top-20 left-10 w-72 h-72 rounded-full blur-[120px] animate-float"
          style={{ backgroundColor: "hsl(174 72% 50% / 0.15)" }}
        />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-[150px] animate-float"
          style={{ backgroundColor: "hsl(190 80% 55% / 0.12)", animationDelay: "3s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full blur-[100px] animate-float"
          style={{ backgroundColor: "hsl(200 70% 50% / 0.08)", animationDelay: "1.5s" }}
        />

        <motion.div
          className="w-full max-w-5xl relative z-10 flex flex-col md:flex-row items-stretch gap-0 glass-card rounded-3xl overflow-hidden"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* Left side — Hero / PropertyFeed */}
          <motion.div
            className="hidden md:flex lg:w-1/2 relative items-center justify-center p-8 bg-hero-gradient"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="flex flex-col items-center gap-10">
              <PropertyFeedAuth />
              <div className="text-center mt-4">
                <h2
                  className="text-2xl font-bold text-primary"
                >
                  Swipe Your Dream Home
                </h2>
                <p className="text-sm mt-1 text-muted-foreground">
                  Discover properties like never before.
                </p>
              </div>
            </div>
          </motion.div> 

          {/* Right side — Login Form */}
          <div className="w-full lg:w-1/2 p-8 md:p-10 lg:p-12 flex flex-col justify-center space-y-6">
            <div className="absolute top-4 right-4">
              <ThemeToggle />
            </div>
            {/* Logo */}
            <div className="flex justify-center lg:justify-start">
              <PropswipeLogo />
            </div>

            {/* Headline */}
            <motion.div
              className="text-center lg:text-left space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h1
                className="text-2xl md:text-3xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Welcome Back
              </h1>
              <p className="text-sm text-muted-foreground">
                Swipe. Watch. Connect.
              </p>
            </motion.div>

            {/* Browse without login */}
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="w-full text-sm text-left font-medium text-primary hover:text-accent transition-colors"
            >
              Browse properties without login
            </button>

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
              onSubmit={handleSubmit}
            >
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Email or username"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 !h-12 rounded-xl"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-11 !h-12 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex justify-end !mt-2">
                <button
                  type="button"
                  className="text-sm text-primary hover:text-accent transition-colors"
                  onClick={() => setLocation("/forgot-password")}
                >
                  Forgot Password?
                </button>
              </div>

              <Button
                variant="default"
                size="lg"
                className="w-full text-base !mt-2 font-bold bg-primary"
                style={{ fontFamily: "var(--font-display)" }}
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Signing In...
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </motion.form>

            {/* Switch to Sign Up */}
            <p className="text-center !mt-2 lg:text-left text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button
                onClick={() => setLocation("/signup")}
                className="font-semibold text-primary hover:text-accent transition-colors"
              >
                Sign Up
              </button>
            </p>


          </div>
        </motion.div>
      </div>
    </>
  );
}