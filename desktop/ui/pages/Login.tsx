import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Info } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useAuthStore } from "@/stores/auth";

const carouselImages = [
  "/images/sample-meals/beef-fry-rice.png",
  "/images/sample-meals/chicken-fry-chapati.png",
  "/images/sample-meals/beef-fry-ugali.png",
  "/images/sample-meals/chicken-fry-rice.png",
];

function ImageCarousel() {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const plugin = Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: false });

  const onSelect = (api: CarouselApi) => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    setCount(api.scrollSnapList().length);
  };

  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-brand-tan">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-green/50 via-brand-green/30 to-brand-beige/40 z-10 pointer-events-none" />
      <Carousel
        setApi={(api) => {
          setApi(api);
          if (api) {
            onSelect(api);
            api.on("select", () => onSelect(api));
            api.on("reInit", () => onSelect(api));
          }
        }}
        plugins={[plugin]}
        opts={{ loop: true, align: "start" }}
        className="w-full h-full"
      >
        <CarouselContent className="h-full -ml-0">
          {carouselImages.map((src, index) => (
            <CarouselItem key={index} className="pl-0 basis-full h-full">
              <div
                className="w-full h-full bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${src})` }}
                role="img"
                aria-label={`Restaurant view ${index + 1}`}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {Array.from({ length: count }).map((_, index) => (
          <button
            key={index}
            onClick={() => api?.scrollTo(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === current
                ? "bg-white w-6"
                : "bg-white/50 hover:bg-white/70"
            }`}
            aria-label={`Go to image ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function Login() {
  const [pin, setPin] = useState("");
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuthStore();

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
        waiter: "/waiter",
        store: "/admin",
        kitchen: "/admin",
      };
      navigate(paths[user.role] || "/");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5EDE0] text-brand-ebony flex flex-col font-sans selection:bg-brand-gold/30">
      {/* Top Logo Section */}
      <div className="flex flex-col items-center pt-10 pb-6 px-4">
        <img
          src="/images/logo/eraeva-logo.png"
          alt="Eraeva Logo"
          className="w-40 h-40 object-contain rounded-2xl drop-shadow-[0_4px_20px_rgba(181,103,37,0.3)] mb-[30px]"
        />
        <p className="text-brand-maroon text-[60px] font-bold my-8 tracking-wide uppercase">
          Eraeva Catering Services
        </p>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 grid grid-cols-2 gap-8 px-10 pb-10 overflow-hidden">
        {/* Left Column - Image Carousel */}
        <div className="min-w-0 h-full">
          <ImageCarousel />
        </div>

        {/* Right Column - PIN Keypad */}
        <div className="min-w-0 h-full">
          <div className="relative w-full aspect-[4/3] bg-brand-tan rounded-2xl border border-brand-tan/80">
            <div className="absolute inset-0 p-4 flex flex-col overflow-hidden">
              <div className="text-[36px] font-semibold text-brand-green text-center">
                Enter LOGIN PIN
              </div>

              {/* PIN Indicators */}
              <div className="flex justify-center gap-3 my-auto">
                {[0, 1, 2, 3].map((index) => {
                  const isActive = pin.length === index;
                  const isFilled = pin.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all duration-200 ${
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

              {/* Keypad Grid */}
              <div className="grid grid-cols-3 gap-4 mt-auto justify-items-center">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleKeyPress(num)}
                    className="h-[80px] aspect-square bg-brand-red hover:bg-brand-red/85 active:bg-brand-red/70 text-white text-3xl font-semibold rounded-xl flex items-center justify-center transition-all cursor-pointer border border-brand-ebony/20 hover:shadow-lg hover:shadow-brand-red/30 hover:scale-105 active:scale-95"
                  >
                    {num}
                  </button>
                ))}

                <button
                  onClick={handleClear}
                  className="h-[80px] aspect-square bg-transparent text-brand-ebony hover:bg-brand-ebony/5 text-2xl font-medium rounded-xl flex items-center justify-center transition-all cursor-pointer"
                >
                  ✕
                </button>
                <button
                  onClick={() => handleKeyPress("0")}
                  className="h-[80px] aspect-square bg-brand-red hover:bg-brand-red/85 active:bg-brand-red/70 text-white text-3xl font-semibold rounded-xl flex items-center justify-center transition-all cursor-pointer border border-brand-ebony/20 hover:shadow-lg hover:shadow-brand-red/30 hover:scale-105 active:scale-95"
                >
                  0
                </button>
                <button
                  onClick={handleSubmit}
                  className={`h-[80px] aspect-square rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    pin.length === 4 && !loading
                      ? "bg-brand-gold text-brand-ebony hover:bg-brand-gold/80 shadow-lg shadow-brand-gold/20"
                      : "bg-brand-gold/80 text-brand-ebony/80 cursor-not-allowed"
                  }`}
                  disabled={pin.length !== 4 || loading}
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-brand-ebony/40 border-t-brand-ebony rounded-full animate-spin" />
                  ) : (
                    <ArrowRight className="w-10 h-10 stroke-[2.5]" />
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
