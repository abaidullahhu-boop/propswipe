import { motion } from "framer-motion";

const PropswipeLogo = () => (
  <motion.div
    className="flex items-center gap-3"
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
  >
    {/* Swipe-inspired icon */}
    <div className="relative w-10 h-10">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(270 80% 60%)" />
            <stop offset="50%" stopColor="hsl(330 90% 60%)" />
            <stop offset="100%" stopColor="hsl(200 100% 55%)" />
          </linearGradient>
        </defs>
        <rect x="4" y="2" width="22" height="36" rx="6" stroke="url(#logoGrad)" strokeWidth="2.5" fill="none" opacity="0.4" />
        <rect x="14" y="2" width="22" height="36" rx="6" stroke="url(#logoGrad)" strokeWidth="2.5" fill="url(#logoGrad)" fillOpacity="0.15" />
        <path d="M22 14 L28 20 L22 26" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <span className="text-2xl font-bold font-display text-primary tracking-tight">
      Propswipe
    </span>
  </motion.div>
);

export default PropswipeLogo;