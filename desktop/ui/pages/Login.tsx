import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Info, Loader2, Power, UtensilsCrossed } from "lucide-react";

import { useAuthStore } from "@/stores/auth";
import { getMenuImages, menuImageUrl } from "@/lib/api";

const fallbackImages = [
  "beef-fry-rice.png",
  "chicken-fry-chapati.png",
  "beef-fry-ugali.png",
  "chicken-fry-rice.png",
].map((name) => menuImageUrl(name) ?? "");

function ImageCarousel() {
  const [images, setImages] = useState<string[]>(fallbackImages);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let active = true;

    async function refreshCarousel() {
      try {
        const paths = await getMenuImages();
        if (!active) return;
        const urls = paths.map((p) => menuImageUrl(p) ?? "").filter(Boolean);
        if (urls.length === 0) {
          setImages([]);
          return;
        }
        setImages(urls);
        // Clamp the current index in case the list shrank between refreshes.
        setCurrent((prev) => (prev < urls.length ? prev : 0));
        // Preload every image up-front so the carousel never shows a blank
        // frame while a large PNG is still downloading.
        urls.forEach((url) => {
          const img = new Image();
          img.onload = () => {
            if (active) setLoaded((prev) => ({ ...prev, [url]: true }));
          };
          img.onerror = () => {
            if (active) setLoaded((prev) => ({ ...prev, [url]: false }));
          };
          img.src = url;
        });
      } catch {
        /* keep current images */
      }
    }

    // Load once on mount, then re-poll so images uploaded via the admin Menu /
    // Accompaniment forms appear on this login screen without a manual reload.
    refreshCarousel();
    const timer = setInterval(refreshCarousel, 30000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // Every 2s pick a random image and fade it in. No sliding — the next image
  // simply replaces the current one, guaranteed different from what's showing.
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => {
        let next = Math.floor(Math.random() * images.length);
        if (next === prev) next = (next + 1) % images.length;
        return next;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [images.length]);

  const url = images[current] ?? "";
  const isLoaded = !!url && loaded[url];

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-brand-tan">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-green/50 via-brand-green/30 to-brand-beige/40 z-10 pointer-events-none" />
      {url ? (
        isLoaded ? (
          <img
            key={url}
            src={url}
            alt={`Restaurant view ${current + 1}`}
            className="absolute inset-0 w-full h-full object-contain animate-[fade-in_0.5s_ease]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green/60" />
          </div>
        )
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <UtensilsCrossed className="h-12 w-12 text-brand-green/40" />
          <p className="text-brand-green/60 font-medium">
            Upload menu images to display here
          </p>
        </div>
      )}
    </div>
  );
}

function Login() {
  const [pin, setPin] = useState("");
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuthStore();
  // Electron-only affordances: window.electron exists solely behind the
  // contextBridge, so in any plain browser (phone live view included) the
  // Exit button would pop a confirm dialog and then do nothing.
  const isElectron = typeof window !== "undefined" && !!window.electron;

  const handleKeyPress = (num: string) => {
    if (loading) return;
    if (pin.length < 4) {
      setPin((prev) => prev + num);
    }
    if (error) clearError();
  };

  const handleClear = () => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
    if (error) clearError();
  };

  const handleSubmit = async () => {
    if (pin.length !== 4 || loading) return;
    await login(pin);
    const user = useAuthStore.getState().user;
    if (user) {
      const paths: Record<string, string> = {
        admin: "/admin",
        manager: "/admin",
        waiter: "/waiter",
        cashier: "/admin",
        store: "/admin",
        kitchen: "/admin",
      };
      navigate(paths[user.role] || "/");
    }
  };

  const handleExit = () => {
    if (window.confirm("Are you sure you want to exit Eraeva POS?")) {
      window.electron?.app?.quit();
    }
  };

  return (
    <div className="relative h-dvh overflow-hidden bg-[#F5EDE0] text-brand-ebony flex flex-col font-sans selection:bg-brand-gold/30">
      {/* Exit Button — Electron only (no-op in the browser) */}
      {isElectron && (
        <button
          onClick={handleExit}
          className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-brand-red hover:bg-brand-red/85 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-brand-red/30 cursor-pointer transition-all"
        >
          <Power className="w-5 h-5" />
          Exit
        </button>
      )}
      {/* Top Logo Section */}
      <div className="flex flex-col items-center pt-[min(4dvh,40px)] pb-[min(3dvh,24px)] px-4 [@media(max-height:560px)]:pt-2 [@media(max-height:560px)]:pb-1">
        <img
          src="./images/logo/eraeva-logo.png"
          alt="Eraeva Logo"
          className="w-[min(18dvh,160px)] h-[min(18dvh,160px)] object-contain rounded-2xl drop-shadow-[0_4px_20px_rgba(181,103,37,0.3)] mb-[min(3dvh,30px)] [@media(max-height:560px)]:w-[clamp(2.75rem,9dvh,6rem)] [@media(max-height:560px)]:h-[clamp(2.75rem,9dvh,6rem)] [@media(max-height:560px)]:mb-2"
        />
        <p className="text-brand-maroon text-[clamp(1.125rem,min(6dvh,5.5vw),3.75rem)] font-bold my-[min(2dvh,32px)] tracking-wide uppercase leading-none [@media(max-height:560px)]:text-[clamp(1rem,4dvh,1.75rem)] [@media(max-height:560px)]:my-1">
          Eraeva Catering Services
        </p>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-[min(4dvh,32px)] px-[min(6dvh,40px)] pb-[min(4dvh,40px)] overflow-hidden">
        {/* Left Column - Image Carousel */}
        <div className="min-w-0 h-full">
          <ImageCarousel />
        </div>

        {/* Right Column - PIN Keypad */}
        <div className="min-w-0 h-full">
          <div className="relative w-full h-full bg-brand-tan rounded-2xl border border-brand-tan/80">
            <div className="absolute inset-0 p-4 flex flex-col overflow-y-auto overscroll-contain">
              <div className="text-[clamp(1rem,min(4dvh,4.5vw),2.25rem)] font-semibold text-brand-green text-center">
                Enter LOGIN PIN
              </div>

              {/* PIN Indicators */}
              <div className="flex justify-center gap-3 my-auto">
                {[0, 1, 2, 3].map((index) => {
                  const isActive = pin.length > 0 && pin.length === index;
                  const isFilled = pin.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-[min(4dvh,32px)] h-[min(4dvh,32px)] rounded-xl flex items-center justify-center border-2 transition-all duration-200 ${
                        isActive
                          ? "border-brand-green bg-transparent"
                          : isFilled
                            ? "border-brand-ebony/30 bg-transparent"
                            : "border-brand-ebony/20 bg-transparent"
                      }`}
                    >
                      {isFilled && (
                        <div className="w-2 h-2 rounded-full bg-brand-green" />
                      )}
                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Keypad Grid — flex-1 + grid-rows-4: rows share the remaining
                  card height so the keys shrink to fit any viewport instead
                  of overflowing (min 40px touch floor, max 80px = today's
                  desktop size). */}
              <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-4 gap-[min(1.6dvh,16px)] items-center justify-items-center">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="min-h-[40px] h-full max-h-[80px] w-full max-w-[80px] touch-manipulation select-none bg-brand-red hover:bg-brand-red/85 active:bg-brand-red/70 text-white text-[clamp(0.9rem,4dvh,1.875rem)] font-semibold rounded-xl flex items-center justify-center transition-all cursor-pointer border border-brand-ebony/20 hover:shadow-lg hover:shadow-brand-red/30 hover:scale-105 active:scale-95"
                  >
                    {num}
                  </button>
                ))}

                <button
                  onClick={handleClear}
                  className="min-h-[40px] h-full max-h-[80px] w-full max-w-[80px] touch-manipulation select-none bg-transparent text-brand-ebony hover:bg-brand-ebony/5 text-[clamp(0.9rem,4dvh,1.5rem)] font-medium rounded-xl flex items-center justify-center transition-all cursor-pointer"
                >
                  ✕
                </button>
                <button
                  onClick={() => handleKeyPress("0")}
                  className="min-h-[40px] h-full max-h-[80px] w-full max-w-[80px] touch-manipulation select-none bg-brand-red hover:bg-brand-red/85 active:bg-brand-red/70 text-white text-[clamp(0.9rem,4dvh,1.875rem)] font-semibold rounded-xl flex items-center justify-center transition-all cursor-pointer border border-brand-ebony/20 hover:shadow-lg hover:shadow-brand-red/30 hover:scale-105 active:scale-95"
                >
                  0
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={pin.length !== 4 || loading}
                  className={`min-h-[40px] h-full max-h-[80px] w-full max-w-[80px] touch-manipulation select-none rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    pin.length === 4 && !loading
                      ? "bg-brand-gold text-brand-ebony hover:bg-brand-gold/80 shadow-lg shadow-brand-gold/20"
                      : "bg-brand-gold/80 text-brand-ebony/80 cursor-not-allowed"
                  }`}
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-brand-ebony/40 border-t-brand-ebony rounded-full animate-spin" />
                  ) : (
                    <ArrowRight className="w-[clamp(1.25rem,4dvh,40px)] h-[clamp(1.25rem,4dvh,40px)] stroke-[2.5]" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-brand-ebony/60 mt-3">
                <Info className="w-3.5 h-3.5 text-brand-ebony/50" />
                <span>Forgot your PIN? Contact Manager</span>
              </div>

              {error && (
                <p className="text-brand-red text-sm text-center mt-2">{error}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
