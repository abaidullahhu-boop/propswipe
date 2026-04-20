import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PropswipeLogo from "@/components/PropswipeLogo";
import PropertyFeedAuth from "@/components/PropertyFeedAuth";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { toast } from "react-hot-toast";



export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [text, setText] = useState("Forgot Password");
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [, setLocation] = useLocation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (step === 1) {
            setStep(2)
            setText("Enter Code")
            }
        else if (step === 2) {
            setStep(3)
            setText("Reset Password")
        }
        else if (step === 3) {
            setLocation("/login")
            toast.success("Password reset successfully")
            setIsLoading(false)
        }
    }

    const formVariants = {
        hidden: { opacity: 0, x: 20 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
        exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
    };

    return (
        // sw-login scopes all --sw-* tokens and shadcn overrides to this subtree only
        <div className="sw-login sw-font-body min-h-screen sw-scene-bg flex items-center justify-center p-4 relative overflow-hidden">
            {/* Floating orbs */}
            <div
                className="absolute top-20 left-10 w-72 h-72 rounded-full blur-[120px] sw-orb-float"
                style={{ backgroundColor: "hsl(270 80% 60% / 0.2)" }}
            />
            <div
                className="absolute bottom-20 right-10 w-96 h-96 rounded-full blur-[150px] sw-orb-float"
                style={{ backgroundColor: "hsl(200 100% 55% / 0.15)", animationDelay: "3s" }}
            />
            <div
                className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full blur-[100px] sw-orb-float"
                style={{ backgroundColor: "hsl(330 90% 60% / 0.1)", animationDelay: "1.5s" }}
            />

            <motion.div
                className="w-full max-w-5xl relative z-10 flex flex-col md:flex-row items-stretch gap-0 sw-frosted-card rounded-3xl overflow-hidden"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
            >
                {/* Left side — Hero / PropertyFeed */}
                <motion.div
                    className="hidden md:flex lg:w-1/2 relative items-center justify-center p-8"
                    style={{
                        background: "linear-gradient(to bottom right, hsl(270 80% 60% / 0.05), hsl(260 20% 6%), hsl(200 100% 55% / 0.05))",
                    }}
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                >
                    <div className="flex flex-col items-center gap-10">
                        <PropertyFeedAuth />
                        <div className="text-center mt-4">
                            <h2 className="text-2xl font-bold sw-font-display sw-shine-text">
                                Swipe Your Dream Home
                            </h2>
                            <p className="text-sm mt-1" style={{ color: "hsl(260 10% 55%)" }}>
                                Discover properties like never before.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Right side — Form */}
                <div className="w-full lg:w-1/2 p-8 md:p-10 lg:p-12 flex flex-col justify-center space-y-6">
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
                            className="text-2xl md:text-3xl font-bold sw-font-display"
                            style={{ color: "hsl(0 0% 95%)" }}
                        >
                            {text}
                        </h1>
                        <p className="text-sm" style={{ color: "hsl(260 10% 55%)" }}>
                            {step === 1 ? "Enter your email to reset your password" : step === 2 ? "We send you an six digit code" : "Enter your new password"}
                        </p>
                    </motion.div>



                    {/* Form */}
                    {step === 1 && (
                        <AnimatePresence mode="wait">
                            <motion.form
                                key="forgot-password"
                                onSubmit={handleSubmit}
                                variants={formVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="space-y-4"
                            >

                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
                                        style={{ color: "hsl(260 10% 55%)" }} />
                                    <Input
                                        placeholder="Email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-11 !h-12 rounded-xl !bg-input text-white sw-font-body"
                                        required
                                    />
                                </div>



                                <Button
                                    variant="default"
                                    size="lg"
                                    className="w-full text-base font-bold sw-cta-fill sw-font-display"
                                    type="submit"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            Forgotting Password...
                                        </div>
                                    ) : (
                                        "Forgot Password"
                                    )}
                                </Button>
                                <Button
                                    variant="default"
                                    size="lg"
                                    className="w-full !bg-transparent !border-none flex justify-center !p-0 text-xs"
                                    type="submit"
                                    disabled={isLoading}
                                    onClick={() => setLocation("/login")}
                                >
                                    {isLoading ? (
                                        "Going Back..."
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <ArrowLeft className="w-4 h-4" />
                                            Back to Login
                                        </div>
                                    )}
                                </Button>
                            </motion.form>
                        </AnimatePresence>
                    )}

                    {step === 2 && (
                        <AnimatePresence mode="wait">
                            <motion.form
                                key="forgot-password"
                                onSubmit={handleSubmit}
                                variants={formVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className=""
                            >
                                <InputOTP maxLength={6}>
                                    <InputOTPGroup className="w-full flex justify-center">
                                        <InputOTPSlot className="w-16 h-14 bg-background text-white border-border" index={0} />
                                        <InputOTPSlot className="w-16 h-14 bg-background text-white border-border" index={1} />
                                        <InputOTPSlot className="w-16 h-14 bg-background text-white border-border" index={2} />
                                        <InputOTPSlot className="w-16 h-14 bg-background text-white border-border" index={3} />
                                        <InputOTPSlot className="w-16 h-14 bg-background text-white border-border" index={4} />
                                        <InputOTPSlot className="w-16 h-14 bg-background text-white border-border" index={5} />
                                    </InputOTPGroup>
                                </InputOTP>
                                <Button
                                    variant="default"
                                    size="lg"
                                    className="w-full text-base mt-3 font-bold sw-cta-fill sw-font-display"
                                    type="submit"
                                    disabled={isLoading}
                                >
                                    Verify Code
                                </Button>
                                <Button
                                    variant="default"
                                    size="lg"
                                    className="w-full !bg-transparent !border-none flex justify-start !p-0 text-xs"
                                    type="submit"
                                    disabled={isLoading}
                                >

                                    <span className="text-xs">Didn't receive a code? <span className="text-primary !font-bold">Resend</span></span>
                                </Button>
                            </motion.form>
                        </AnimatePresence>
                    )}
                    {step === 3 && (
                        <AnimatePresence mode="wait">
                            <motion.form
                                key="forgot-password"
                                onSubmit={handleSubmit}
                                variants={formVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className=""
                            >
                                <Input
                                    placeholder="New Password"
                                    type="password"
                                    className="w-full !h-12 rounded-xl !bg-input text-white sw-font-body"
                                    required
                                />
                                <Input
                                    placeholder="Confirm New Password"
                                    type="password"
                                    className="w-full !h-12 mt-3 rounded-xl !bg-input text-white sw-font-body"
                                    required
                                />
                                <Button
                                    variant="default"
                                    size="lg"
                                    className="w-full text-base mt-3 font-bold sw-cta-fill sw-font-display"
                                    type="submit"
                                    disabled={isLoading}
                                >
                                    Reset Password
                                </Button>
                            </motion.form>
                        </AnimatePresence>
                    )}



                </div>
            </motion.div>
        </div>
    );
}