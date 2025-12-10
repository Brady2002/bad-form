 "use client";

import { useState, useRef, useEffect, ChangeEvent, useCallback } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";

const SIREN_URL =
  "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg";

// Sound effect URLs
const WIN_SOUND = "/rps/win.mp3";
const LOSE_SOUND = "/rps/lose.mp3";
const TIE_SOUND = "/rps/lose.mp3";
const CLICK_SOUND = "/rps/click.mp3";

// Captcha stages
type CaptchaStage = "hidden" | "images" | "rps" | "complete";

// Image captcha data - using local images
// Fire hydrants (correct): IDs 1, 3, 5, 7, 9
// Other images (incorrect): IDs 2, 4, 6, 8
const CAPTCHA_IMAGES = [
  { 
    id: 1, 
    url: "/captcha/hydrant1.png",
    isCorrect: true 
  },
  { 
    id: 2, 
    url: "/captcha/other1.png",
    isCorrect: false 
  },
  { 
    id: 3, 
    url: "/captcha/hydrant2.png",
    isCorrect: true 
  },
  { 
    id: 4, 
    url: "/captcha/other2.png",
    isCorrect: false 
  },
  { 
    id: 5, 
    url: "/captcha/other3.png",
    isCorrect: false 
  },
  { 
    id: 6, 
    url: "/captcha/other4.png",
    isCorrect: false 
  },
  { 
    id: 7, 
    url: "/captcha/other5.png",
    isCorrect: false 
  },
  { 
    id: 8, 
    url: "/captcha/hydrant3.png",
    isCorrect: true 
  },
  { 
    id: 9, 
    url: "/captcha/other6.png",
    isCorrect: false 
  },
];

// Rock Paper Scissors choices
type RPSChoice = "rock" | "paper" | "scissors" | null;

export default function Home() {
  const [dobColor, setDobColor] = useState("#8f8f8f");
  const [dobR, setDobR] = useState(18); // decoded "day"
  const [dobG, setDobG] = useState(9); // decoded "month"
  const [dobB, setDobB] = useState(1945); // decoded "year" (full 4-digit)

  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const sirenAudioRef = useRef<HTMLAudioElement | null>(null);
  const isEmailAlertActive =
    email.length > 0 && confirmEmail.length > 0 && email !== confirmEmail;

  // Address/Google Maps state
  const [addressPin, setAddressPin] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [addressLoading, setAddressLoading] = useState(false);
  const [isAddressValid, setIsAddressValid] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // RPS sound refs
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  const loseSoundRef = useRef<HTMLAudioElement | null>(null);
  const tieSoundRef = useRef<HTMLAudioElement | null>(null);
  const clickSoundRef = useRef<HTMLAudioElement | null>(null);
  const rockSoundRef = useRef<HTMLAudioElement | null>(null);
  const paperSoundRef = useRef<HTMLAudioElement | null>(null);
  const scissorsSoundRef = useRef<HTMLAudioElement | null>(null);

  // RPS animation states
  const [rpsAnimating, setRpsAnimating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [botChoiceRevealed, setBotChoiceRevealed] = useState(false);

  // Captcha state
  const [captchaStage, setCaptchaStage] = useState<CaptchaStage>("hidden");
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [imageCaptchaLoading, setImageCaptchaLoading] = useState(false);
  const [imageCaptchaSuccess, setImageCaptchaSuccess] = useState(false);
  const [rpsPlayerChoice, setRpsPlayerChoice] = useState<RPSChoice>(null);
  const [rpsBotChoice, setRpsBotChoice] = useState<RPSChoice>(null);
  const [rpsResult, setRpsResult] = useState<string>("");
  const [rpsWins, setRpsWins] = useState(0);

  const handleDobColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDobColor(value);

    const match = /^#?([0-9a-fA-F]{6})$/.exec(value);
    if (!match) return;

    const hex = match[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    // Decode approximate day/month/year from a brighter RGB color.
    // Multiplier choices are intentionally awkward.
    const day = Math.min(31, Math.max(1, Math.round(r / 8) || 1));
    const month = Math.min(12, Math.max(1, Math.round(g / 16) || 1));
    // Map B (0-255) to full year range 1900-2025
    const yearRange = 2025 - 1900; // 125 years
    const year = Math.min(2025, Math.max(1900, Math.round(1900 + (b / 255) * yearRange)));

    setDobR(day);
    setDobG(month);
    setDobB(year);
  };

  // Calculate the actual date from RGB values
  const calculateDate = () => {
    const day = Math.min(31, Math.max(1, dobR));
    const month = Math.min(12, Math.max(1, dobG));
    const fullYear = Math.min(2025, Math.max(1900, dobB));
    
    // Format the date
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    // Validate the date (e.g., Feb 30 doesn't exist)
    const daysInMonth = new Date(fullYear, month, 0).getDate();
    const validDay = Math.min(day, daysInMonth);
    
    return `${monthNames[month - 1]} ${validDay}, ${fullYear}`;
  };

  // Calculate age from the date of birth
  const calculateAge = () => {
    const day = Math.min(31, Math.max(1, dobR));
    const month = Math.min(12, Math.max(1, dobG));
    const fullYear = Math.min(2025, Math.max(1900, dobB));
    
    // Validate the date (e.g., Feb 30 doesn't exist)
    const daysInMonth = new Date(fullYear, month, 0).getDate();
    const validDay = Math.min(day, daysInMonth);
    
    const birthDate = new Date(fullYear, month - 1, validDay);
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    // Handle future dates (shouldn't happen with the clamp, but just in case)
    if (age < 0) {
      return 0;
    }
    
    return age;
  };

  useEffect(() => {
    // Start or stop the persistent siren based on mismatch state.
    if (isEmailAlertActive) {
      try {
        if (!sirenAudioRef.current) {
          sirenAudioRef.current = new Audio(SIREN_URL);
        }
        const audio = sirenAudioRef.current;
        audio.loop = true;
        audio.currentTime = 0;
        audio.volume = 1;
        void audio.play();
      } catch {
      }
    } else if (sirenAudioRef.current) {
      // Stop the siren once emails match or one is cleared.
      sirenAudioRef.current.pause();
      sirenAudioRef.current.currentTime = 0;
      sirenAudioRef.current.loop = false;
    }
  }, [isEmailAlertActive]);

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEmail(value);
  };

  const handleConfirmEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setConfirmEmail(value);
  };

  // Reverse geocode coordinates to get address
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    
    setAddressLoading(true);
    setIsAddressValid(false);
    geocoderRef.current.geocode(
      { location: { lat, lng } },
      (results, status) => {
        setAddressLoading(false);
        if (status === "OK" && results && results[0]) {
          const result = results[0];
          setAddress(result.formatted_address);
          
          // Check if address is in North Carolina, United States
          const addressComponents = result.address_components || [];
          const stateComponent = addressComponents.find(
            (component) => component.types.includes("administrative_area_level_1")
          );
          const countryComponent = addressComponents.find(
            (component) => component.types.includes("country")
          );
          
          const isInNorthCarolina = 
            stateComponent &&
            (stateComponent.long_name === "North Carolina" || 
             stateComponent.short_name === "NC") &&
            countryComponent &&
            countryComponent.short_name === "US";
          
          setIsAddressValid(isInNorthCarolina || false);
        } else {
          setAddress("Address not found");
          setIsAddressValid(false);
        }
      }
    );
  }, []);

  // Google Maps handlers
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapLoaded(true);
    geocoderRef.current = new google.maps.Geocoder();
  }, []);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setAddressPin({ lat, lng });
      reverseGeocode(lat, lng);
    }
  }, [reverseGeocode]);

  const mapContainerStyle = {
    width: "100%",
    height: "400px",
  };

  const defaultCenter = {
    lat: -33.8688,
    lng: 151.2093, // Sydney, Australia default
  };

  // Captcha handlers
  const handleOpenCaptcha = () => {
    setShowCaptchaModal(true);
    setCaptchaStage("images");
    setSelectedImages([]);
    setRpsWins(0);
    setRpsPlayerChoice(null);
    setRpsBotChoice(null);
    setRpsResult("");
    setRpsAnimating(false);
    setShowConfetti(false);
    setBotChoiceRevealed(false);
    setImageCaptchaLoading(false);
    setImageCaptchaSuccess(false);
  };

  const handleImageClick = (imageId: number) => {
    if (selectedImages.includes(imageId)) {
      setSelectedImages(selectedImages.filter((id) => id !== imageId));
    } else {
      setSelectedImages([...selectedImages, imageId]);
    }
  };

  const handleImageCaptchaSubmit = () => {
    if (imageCaptchaLoading) return; // Prevent multiple clicks
    
    setImageCaptchaLoading(true);
    
    // Simulate checking/verification delay
    setTimeout(() => {
      const correctImages = CAPTCHA_IMAGES.filter((img) => img.isCorrect).map((img) => img.id);
      const selectedCorrect = selectedImages.filter((id) => correctImages.includes(id));
      
      // Check if all correct images are selected and no incorrect ones
      if (
        selectedCorrect.length === correctImages.length &&
        selectedImages.length === correctImages.length
      ) {
        setImageCaptchaLoading(false);
        setImageCaptchaSuccess(true);
        // Show success message briefly before transitioning
        setTimeout(() => {
          setCaptchaStage("rps");
          setImageCaptchaSuccess(false);
        }, 1500); // Show success for 1.5 seconds
      } else {
        // Reset selection on wrong answer
        setSelectedImages([]);
        setImageCaptchaLoading(false);
        alert("Please select all images with fire hydrants. Try again.");
      }
    }, 1500); // 1.5 second loading delay
  };

  const handleCloseCaptcha = () => {
    if (captchaStage === "complete") {
      setShowCaptchaModal(false);
    }
  };

  const playSound = (soundRef: React.MutableRefObject<HTMLAudioElement | null>, url: string) => {
    // Try to load external audio, but don't break if it fails
    try {
      if (!soundRef.current) {
        soundRef.current = new Audio(url);
        soundRef.current.addEventListener("error", () => {
          // Silently fail - we're using fallback anyway
        });
      }
      const audio = soundRef.current;
      audio.currentTime = 0;
      audio.volume = 0.5;
      void audio.play().catch(() => {
        // Silently fail
      });
    } catch {
      // Silently fail
    }
  };

  const playRPSChoiceSound = (choice: RPSChoice) => {
    try {
      let soundRef: React.MutableRefObject<HTMLAudioElement | null>;
      let soundUrl: string;
      
      switch (choice) {
        case "rock":
          soundRef = rockSoundRef;
          soundUrl = "/rps/rock.mp3";
          break;
        case "paper":
          soundRef = paperSoundRef;
          soundUrl = "/rps/paper.mp3";
          break;
        case "scissors":
          soundRef = scissorsSoundRef;
          soundUrl = "/rps/scissors.mp3";
          break;
        default:
          return;
      }
      
      if (!soundRef.current) {
        soundRef.current = new Audio(soundUrl);
        soundRef.current.addEventListener("error", () => {
          console.debug("RPS sound failed to load:", soundUrl);
        });
      }
      const audio = soundRef.current;
      audio.currentTime = 0;
      audio.volume = 0.7;
      void audio.play().catch(() => {
        // Silently fail
      });
    } catch (error) {
      console.debug("RPS sound playback failed:", error);
    }
  };

  const handleRPSChoice = (choice: RPSChoice) => {
    if (rpsPlayerChoice || rpsAnimating) return; // Already made a choice or animating
    
    setRpsAnimating(true);
    setBotChoiceRevealed(false);
    playSound(clickSoundRef, CLICK_SOUND);
    
    setRpsPlayerChoice(choice);
    
    // Animated reveal of bot choice
    setTimeout(() => {
      // Bot makes a random choice
      const botChoices: RPSChoice[] = ["rock", "paper", "scissors"];
      const botChoice = botChoices[Math.floor(Math.random() * botChoices.length)];
      setRpsBotChoice(botChoice);
      setBotChoiceRevealed(true);
      
      // Determine winner after a brief delay
      setTimeout(() => {
        if (choice === botChoice) {
          setRpsResult("Tie! Try again.");
          playSound(tieSoundRef, TIE_SOUND);
          setTimeout(() => {
            setRpsPlayerChoice(null);
            setRpsBotChoice(null);
            setRpsResult("");
            setRpsAnimating(false);
            setBotChoiceRevealed(false);
          }, 2000);
        } else if (
          (choice === "rock" && botChoice === "scissors") ||
          (choice === "paper" && botChoice === "rock") ||
          (choice === "scissors" && botChoice === "paper")
        ) {
          setRpsResult("You win this round!");
          setShowConfetti(true);
          playSound(winSoundRef, WIN_SOUND);
          playRPSChoiceSound(choice); // Play the winning choice's sound
          setRpsWins(rpsWins + 1);
          setTimeout(() => {
            setShowConfetti(false);
            if (rpsWins + 1 >= 3) {
              setCaptchaStage("complete");
            } else {
              setRpsPlayerChoice(null);
              setRpsBotChoice(null);
              setRpsResult("");
              setRpsAnimating(false);
              setBotChoiceRevealed(false);
            }
          }, 2000);
        } else {
          setRpsResult("You lose! Try again.");
          playSound(loseSoundRef, LOSE_SOUND);
          playRPSChoiceSound(botChoice); // Play the winning (bot's) choice's sound
          setTimeout(() => {
            setRpsPlayerChoice(null);
            setRpsBotChoice(null);
            setRpsResult("");
            setRpsAnimating(false);
            setBotChoiceRevealed(false);
          }, 2000);
        }
      }, 500);
    }, 300);
  };

  // Prevent closing modal unless captcha is complete
  useEffect(() => {
    if (captchaStage === "complete") {
      // Auto-close after a moment
      setTimeout(() => {
        setShowCaptchaModal(false);
      }, 1500);
    }
  }, [captchaStage]);

  return (
    <div
      className={`min-h-screen w-full bg-[#fffbf0] text-zinc-900 flex items-stretch justify-center ${
        isEmailAlertActive ? "flash-screen" : ""
      }`}
    >
      <main className="w-full max-w-4xl m-6 border-[5px] border-dotted border-red-500 bg-[repeating-linear-gradient(45deg,#fff,#fff_10px,#ffe4e6_10px,#ffe4e6_20px)] shadow-[8px_8px_0_rgba(0,0,0,0.8)] overflow-auto">
        <header className="px-8 pt-6 pb-3 border-b border-black bg-yellow-200/80 text-center">
          <h1 className="text-3xl font-black tracking-[0.25em] uppercase">
            Very Important Official Form
          </h1>
          <p className="mt-1 text-xs italic text-red-900">
            Please fill out every field correctly.
          </p>
        </header>

        <form
          className="px-6 pb-10 pt-5 text-sm sm:text-[13px] leading-tight space-y-7"
          onSubmit={(e) => {
            e.preventDefault();
            if (captchaStage !== "complete") {
              alert("Please complete the verification challenge first.");
              return;
            }
            if (!addressPin) {
              alert("Please place a pin on the map to indicate your address.");
              return;
            }
            if (!isAddressValid) {
              alert("Address must be in North Carolina, United States to submit this form.");
              return;
            }
            alert(
              "Thank you for submitting absolutely nothing of value.\n\n(Also, none of this was saved.)"
            );
          }}
        >
          {/* Name section */}
          <section className="grid sm:grid-cols-[2fr,3fr] gap-4 items-stretch border-b border-black pb-5">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-[0.3em]">
                Name
              </label>
              <label htmlFor="name" className="font-semibold">
                Name
              </label>
              <p className="text-[11px] text-zinc-700">
                First and Last Name
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <input
                id="name"
                name="name"
                type="text"
                required
                autoComplete="off"
                className="border border-zinc-500 bg-yellow-50 px-2 py-[6px] tracking-[0.25em] uppercase placeholder:text-[10px] placeholder:text-zinc-500 focus:ring-0 focus:outline-none focus:border-blue-700"
              />
            </div>
          </section>

          {/* Email section */}
          <section className="grid sm:grid-cols-[2fr,3fr] gap-4 border-b border-black pb-5">
            <div className="flex flex-col gap-1 order-2 sm:order-1">
              <label className="text-[10px] uppercase tracking-[0.3em]">
                Email
              </label>
              <p className="text-[11px] text-zinc-700">
                For your security, we have obscured your email address.
              </p>
              <input
                id="email"
                name="email"
                type="password"
                required
                placeholder="••••••••••"
                value={email}
                onChange={handleEmailChange}
                className={`border bg-yellow-50 px-2 py-[6px] tracking-[0.25em] uppercase placeholder:text-[10px] placeholder:text-zinc-500 focus:ring-0 focus:outline-none ${
                  isEmailAlertActive
                    ? "border-red-700 focus:border-red-900"
                    : "border-zinc-500 focus:border-blue-700"
                }`}
              />
              <label className="text-[10px] uppercase tracking-[0.3em] mt-3">
                Confirm Email
              </label>
              <input
                id="confirm-email"
                name="confirm-email"
                type="password"
                required
                placeholder="••••••••••"
                value={confirmEmail}
                onChange={handleConfirmEmailChange}
                className={`border bg-yellow-50 px-2 py-[6px] tracking-[0.25em] uppercase placeholder:text-[10px] placeholder:text-zinc-500 focus:ring-0 focus:outline-none ${
                  isEmailAlertActive
                    ? "border-red-700 focus:border-red-900"
                    : "border-zinc-500 focus:border-blue-700"
                }`}
              />
              {isEmailAlertActive && (
                <p className="mt-1 text-[10px] font-semibold text-red-800">
                  Emails do not match.
                </p>
              )}
            </div>
          </section>

          {/* RGB Date-of-birth */}
          <section className="grid sm:grid-cols-[2fr,3fr] gap-4 border-b border-black pb-5">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-[0.3em]">
                Date of Birth
              </label>
              <label className="font-semibold" htmlFor="dob-r">
                Date of Birth (RGB format only)
              </label>
              <p className="text-[11px] text-zinc-700">
                <span className="font-semibold">R</span> is your day,
                <span className="font-semibold"> G</span> is your month, and
                <span className="font-semibold"> B</span> is your birth year
                (1900-2025).
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-1">
                    Date
                  </p>
                  <p className="text-sm font-semibold text-zinc-900">
                    {calculateDate()}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mt-2 mb-1">
                    Age
                  </p>
                  <p className="text-sm font-semibold text-zinc-900">
                    {calculateAge()} years old
                </p>
              <div className="flex items-center gap-2">
                <input
                  id="dob-color"
                  name="dob-color"
                  type="color"
                  value={dobColor}
                  onChange={handleDobColorChange}
                  className="h-10 w-14 border border-zinc-800 cursor-crosshair"
                />
              </div>
            </div>
          </section>

          {/* Address section with Google Maps */}
          <section className="grid sm:grid-cols-[2fr,3fr] gap-4 border-b border-black pb-5">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-[0.3em]">
                Address
              </label>
              <label className="font-semibold">
                Address (Pin Placement Required)
              </label>
              <p className="text-[11px] text-zinc-700">
                Click on the map to place a pin at your address location.
              </p>
              {addressLoading && (
                <p className="text-[10px] text-blue-600 mt-2 italic">
                  Loading address...
                </p>
              )}
              {address && !addressLoading && (
                <>
                  <p className="text-[10px] mt-2">
                    Address: {address}
                  </p>
                  {isAddressValid ? (
                    <p className="text-[10px] text-green-700 mt-1 font-semibold">
                      ✓ Valid address
                    </p>
                  ) : (
                    <p className="text-[10px] text-red-700 mt-1 font-semibold">
                      ✗ Address must be in North Carolina, United States
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="border border-zinc-500 bg-yellow-50 overflow-hidden">
                {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
                  <LoadScript
                    googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                    loadingElement={<div className="w-full h-[400px] bg-gray-200 flex items-center justify-center">Loading map...</div>}
                  >
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={addressPin || defaultCenter}
                      zoom={addressPin ? 15 : 10}
                      onLoad={onMapLoad}
                      onClick={onMapClick}
                      options={{
                        disableDefaultUI: false,
                        zoomControl: true,
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: true,
                        mapTypeId: "satellite" as google.maps.MapTypeId,
                        styles: [
                          {
                            featureType: "all",
                            elementType: "labels",
                            stylers: [{ visibility: "off" }],
                          },
                        ],
                      }}
                    >
                      {addressPin && (
                        <Marker
                          position={addressPin}
                          draggable={true}
                          onDragEnd={(e) => {
                            if (e.latLng) {
                              const lat = e.latLng.lat();
                              const lng = e.latLng.lng();
                              setAddressPin({ lat, lng });
                              reverseGeocode(lat, lng);
                            }
                          }}
                        />
                      )}
                    </GoogleMap>
                  </LoadScript>
                ) : (
                  <div className="w-full h-[400px] bg-gray-200 flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-sm font-semibold text-red-600 mb-2">Google Maps API Key Required</p>
                    <p className="text-xs text-gray-600">
                      Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Get your API key from: https://console.cloud.google.com/google/maps-apis
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Captcha Section */}
          <section className="grid sm:grid-cols-[2fr,3fr] gap-4 border-b border-black pb-5">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-[0.3em]">
                Verification
              </label>
              <label className="font-semibold">
                Security Verification
              </label>
              <p className="text-[11px] text-zinc-700">
                Complete verification to submit form
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {captchaStage === "complete" ? (
                <div className="text-green-600 font-bold text-sm">
                  ✓ Verification complete
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenCaptcha}
                  className="border border-black bg-[#6890d0] px-4 py-2 text-[11px] font-bold uppercase self-start hover:bg-blue-200"
                >
                  Verify you're human
                </button>
              )}
            </div>
          </section>

          {/* Buttons */}
          <section>
            <div className="flex flex-wrap gap-2 justify-end items-center">
              <button
                type="submit"
                disabled={captchaStage !== "complete"}
                className={`border border-black px-4 py-2 text-[11px] font-bold uppercase shadow-[3px_3px_0_rgba(0,0,0,0.8)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ${
                  captchaStage === "complete"
                    ? "bg-[#6890d0] cursor-pointer"
                    : "bg-gray-400 cursor-not-allowed opacity-60"
                }`}
              >
                Submit?
              </button>
            </div>
          </section>
        </form>
      </main>

      {/* Captcha Modal */}
      {showCaptchaModal && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={captchaStage === "complete" ? handleCloseCaptcha : undefined}
        >
          <div 
            className="bg-white border-4 border-gray-800 shadow-2xl max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-300">
              <h2 className="text-xl font-bold">Security Verification</h2>
              {captchaStage === "complete" && (
                <button
                  onClick={handleCloseCaptcha}
                  className="text-gray-600 hover:text-gray-800 text-2xl leading-none"
                >
                  ×
                </button>
              )}
            </div>

            {captchaStage === "images" && (
              <div className="space-y-4">
                {imageCaptchaSuccess ? (
                  <div className="text-center py-8">
                    <div className="text-green-600 text-5xl mb-4 animate-pulse">✓</div>
                    <p className="text-xl font-bold text-green-600 mb-2">Verification Successful!</p>
                    <p className="text-sm text-gray-600">Proceeding to next step...</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50 border-2 border-blue-300 p-3">
                      <p className="font-semibold text-sm mb-1">Select all images with a fire hydrant</p>
                      <p className="text-xs text-gray-600">Click verify once you're done</p>
                    </div>
                <div className="grid grid-cols-3 gap-2">
                  {CAPTCHA_IMAGES.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => handleImageClick(image.id)}
                      className={`aspect-square border-2 relative overflow-hidden transition-all ${
                        selectedImages.includes(image.id)
                          ? "border-blue-600 bg-blue-100 ring-2 ring-blue-400"
                          : "border-gray-300 hover:border-gray-500"
                      }`}
                    >
                      <img 
                        src={image.url} 
                        alt="Captcha image" 
                        className="w-full h-full object-cover"
                      />
                      {selectedImages.includes(image.id) && (
                        <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                          <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                            ✓
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCaptchaModal(false)}
                    disabled={imageCaptchaLoading}
                    className="text-sm text-gray-600 hover:text-gray-800 underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleImageCaptchaSubmit}
                    disabled={imageCaptchaLoading}
                    className="border border-black bg-green-500 text-white px-6 py-2 text-sm font-bold uppercase hover:bg-green-600 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {imageCaptchaLoading ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        Verifying...
                      </>
                    ) : (
                      "Verify"
                    )}
                  </button>
                </div>
                {imageCaptchaLoading && (
                  <div className="text-center text-sm text-gray-600 mt-2">
                    Checking your selections...
                  </div>
                )}
                  </>
                )}
              </div>
            )}

            {captchaStage === "rps" && (
              <div className="space-y-4 relative">
                {showConfetti && (
                  <div className="confetti-container">
                    {Array.from({ length: 50 }).map((_, i) => {
                      const startLeft = Math.random() * 100;
                      const drift = (Math.random() - 0.5) * 200; // Random horizontal drift
                      const duration = 2 + Math.random() * 2; // 2-4 seconds
                      const delay = Math.random() * 0.3; // Stagger the start
                      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#8800ff'];
                      
                      return (
                        <div 
                          key={i} 
                          className="confetti" 
                          style={{
                            '--start-left': `${startLeft}%`,
                            '--drift': `${drift}px`,
                            '--duration': `${duration}s`,
                            animationDelay: `${delay}s`,
                            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                            width: `${8 + Math.random() * 6}px`,
                            height: `${8 + Math.random() * 6}px`,
                          } as React.CSSProperties}
                        />
                      );
                    })}
                  </div>
                )}
                <div className="bg-yellow-50 border-2 border-yellow-300 p-3">
                  <p className="font-semibold text-sm mb-1">Beat the bot in Rock Paper Scissors</p>
                  <p className="text-xs text-gray-600">Win 3 rounds to complete verification</p>
                </div>
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="font-semibold text-lg mb-2">Wins: {rpsWins} / 3</p>
                    {rpsResult && (
                      <p className={`font-bold text-lg animate-pulse ${
                        rpsResult.includes("win") ? "text-green-600" : 
                        rpsResult.includes("lose") ? "text-red-600" : 
                        "text-yellow-600"
                      }`}>
                        {rpsResult}
                      </p>
                    )}
                  </div>
                  
                  {/* Choices display */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-xs font-semibold mb-2">You</p>
                      <div className={`rps-choice-display ${rpsPlayerChoice ? 'reveal' : ''} ${rpsResult.includes("win") && rpsPlayerChoice ? 'winner' : ''}`}>
                        {rpsPlayerChoice ? (
                          <span className="text-4xl">
                            {rpsPlayerChoice === "rock" ? "🪨" : rpsPlayerChoice === "paper" ? "📄" : "✂️"}
                          </span>
                        ) : (
                          <span className="text-2xl text-gray-400">?</span>
                        )}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold mb-2">Bot</p>
                      <div className={`rps-choice-display ${botChoiceRevealed ? 'reveal' : ''} ${rpsResult.includes("lose") && botChoiceRevealed ? 'bot-winner' : ''}`}>
                        {botChoiceRevealed && rpsBotChoice ? (
                          <span className="text-4xl">
                            {rpsBotChoice === "rock" ? "🪨" : rpsBotChoice === "paper" ? "📄" : "✂️"}
                          </span>
                        ) : (
                          <span className="text-2xl text-gray-400">?</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => handleRPSChoice("rock")}
                      disabled={!!rpsPlayerChoice || rpsAnimating}
                      className={`rps-button ${rpsPlayerChoice === "rock" ? "selected" : ""} border-2 border-black bg-yellow-50 px-4 py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-100 active:scale-95 transition-all`}
                    >
                      🪨 Rock
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRPSChoice("paper")}
                      disabled={!!rpsPlayerChoice || rpsAnimating}
                      className={`rps-button ${rpsPlayerChoice === "paper" ? "selected" : ""} border-2 border-black bg-yellow-50 px-4 py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-100 active:scale-95 transition-all`}
                    >
                      📄 Paper
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRPSChoice("scissors")}
                      disabled={!!rpsPlayerChoice || rpsAnimating}
                      className={`rps-button ${rpsPlayerChoice === "scissors" ? "selected" : ""} border-2 border-black bg-yellow-50 px-4 py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-100 active:scale-95 transition-all`}
                    >
                      ✂️ Scissors
                    </button>
                  </div>
                </div>
              </div>
            )}

            {captchaStage === "complete" && (
              <div className="text-center py-8">
                <div className="text-green-600 text-4xl mb-4">✓</div>
                <p className="text-xl font-bold text-green-600 mb-2">Verification Successful!</p>
                <p className="text-sm text-gray-600">You may now submit the form.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
