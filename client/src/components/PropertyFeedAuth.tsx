import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Share2, Play } from "lucide-react";
import property1 from "@/assets/property-1.jpg";
import property2 from "@/assets/property-2.jpg";
import property3 from "@/assets/property-3.jpg";
import property4 from "@/assets/property-4.jpg";

const properties = [
  { image: property1, title: "Modern Villa", location: "Miami, FL", price: "$2.4M", likes: "12.3K" },
  { image: property2, title: "Sky Penthouse", location: "New York, NY", price: "$8.1M", likes: "24.7K" },
  { image: property3, title: "Beach Resort", location: "Malibu, CA", price: "$5.6M", likes: "18.9K" },
  { image: property4, title: "Designer Loft", location: "Brooklyn, NY", price: "$1.8M", likes: "9.4K" },
];

const PropertyFeedAuth = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % properties.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const prop = properties[current];

  return (
    <div className="relative w-[280px] h-[520px] mx-auto">
      {/* Phone frame */}
      <div className="absolute inset-0 rounded-[2.5rem] border-2 border-border/50 !bg-login-background/50 backdrop-blur-sm z-20 pointer-events-none shadow-[var(--shadow-glow)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-login-background/80 rounded-b-2xl z-30" />

      {/* Screen content */}
      <div className="absolute inset-[3px] rounded-[2.3rem] overflow-hidden z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            <img
              src={prop.image}
              alt={prop.title}
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-foreground/10 backdrop-blur-md flex items-center justify-center border border-foreground/20">
                <Play className="w-5 h-5 text-foreground fill-foreground ml-0.5" />
              </div>
            </div>

            {/* Right side actions */}
            <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
              <div className="flex flex-col items-center gap-1">
                <Heart className="w-6 h-6 text-hot-pink fill-hot-pink" />
                <span className="text-[10px] text-foreground font-medium">{prop.likes}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <MessageCircle className="w-6 h-6 text-foreground" />
                <span className="text-[10px] text-foreground font-medium">847</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Share2 className="w-6 h-6 text-foreground" />
                <span className="text-[10px] text-foreground font-medium">Share</span>
              </div>
            </div>

            {/* Bottom info */}
            <div className="absolute bottom-6 left-4 right-14">
              <p className="text-foreground font-bold text-sm font-display">{prop.title}</p>
              <p className="text-foreground/70 text-xs">{prop.location}</p>
              <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold gradient-cta text-primary-foreground">
                {prop.price}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        {properties.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default PropertyFeedAuth;
