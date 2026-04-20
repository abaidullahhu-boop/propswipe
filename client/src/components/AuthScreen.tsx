import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, Mail } from "lucide-react";
import { FaGoogle } from "react-icons/fa";

interface AuthScreenProps {
  onAuth: (email: string, provider?: "google" | "email") => void;
}

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);

  const handleEmailSignIn = () => {
    if (email.trim()) {
      onAuth(email, "email");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      {/* Background video montage effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-card to-black opacity-95" />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-card/95 backdrop-blur-xl rounded-3xl p-8 border border-white/10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-12">
            <div className="bg-primary/20 backdrop-blur-md p-6 rounded-2xl mb-4">
              <Home className="w-20 h-20 text-primary" />
            </div>
            <h1 className="text-4xl font-black text-white">PropSwipe</h1>
            <p className="text-white/70 mt-2">Discover your dream property</p>
          </div>

          {/* Auth Buttons */}
          <div className="space-y-4">
            {!showEmailInput ? (
              <>
                <Button
                  data-testid="button-google-signin"
                  onClick={() => onAuth("", "google")}
                  className="w-full bg-white text-black hover:bg-white/90 rounded-2xl py-6 text-lg font-semibold flex items-center justify-center gap-3"
                >
                  <FaGoogle className="w-6 h-6" />
                  Continue with Google
                </Button>

                <Button
                  data-testid="button-email-signin"
                  onClick={() => setShowEmailInput(true)}
                  variant="outline"
                  className="w-full bg-white/10 text-white hover:bg-white/20 border-white/20 rounded-2xl py-6 text-lg font-semibold flex items-center justify-center gap-3"
                >
                  <Mail className="w-6 h-6" />
                  Continue with Email
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <Input
                  data-testid="input-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSignIn()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-lg px-4 py-6 text-lg focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <Button
                  data-testid="button-signin-submit"
                  onClick={handleEmailSignIn}
                  disabled={!email.trim()}
                  className="w-full bg-accent text-white hover:bg-accent/90 rounded-2xl py-6 text-lg font-semibold shadow-lg shadow-accent/20"
                >
                  Sign In
                </Button>
                <Button
                  data-testid="button-back"
                  onClick={() => {
                    setShowEmailInput(false);
                    setEmail("");
                  }}
                  variant="ghost"
                  className="w-full text-white/70 hover:text-white"
                >
                  Back
                </Button>
              </div>
            )}
          </div>

          {/* Terms */}
          <p className="text-white/50 text-xs text-center mt-8">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
