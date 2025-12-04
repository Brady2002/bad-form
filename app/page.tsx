 "use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";

const SIREN_URL =
  "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg";

export default function Home() {
  const [dobColor, setDobColor] = useState("#8f8f8f");
  const [dobR, setDobR] = useState(18); // decoded "day"
  const [dobG, setDobG] = useState(9); // decoded "month"
  const [dobB, setDobB] = useState(45); // decoded "year"

  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const sirenAudioRef = useRef<HTMLAudioElement | null>(null);
  const isEmailAlertActive =
    email.length > 0 && confirmEmail.length > 0 && email !== confirmEmail;

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
    const year = Math.min(99, Math.max(0, Math.round(b / 2) || 0));

    setDobR(day);
    setDobG(month);
    setDobB(year);
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
          <section className="grid sm:grid-cols-[3fr,2fr] gap-4 border-b border-black pb-5">
            <div className="flex flex-col gap-1 order-2 sm:order-1">
              <label className="text-[10px] uppercase tracking-[0.3em]">
                Email
              </label>
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
              <label className="text-[10px] uppercase tracking-[0.3em]">
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
                We do not accept dates. Please choose a color so that{" "}
                <span className="font-semibold">R</span> is your day,
                <span className="font-semibold"> G</span> is your month, and
                <span className="font-semibold"> B</span> is the last two
                digits of your birth year.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  id="dob-color"
                  name="dob-color"
                  type="color"
                  value={dobColor}
                  onChange={handleDobColorChange}
                  className="h-10 w-14 border border-zinc-800 cursor-crosshair"
                />
                <div className="flex-1 grid grid-cols-3 gap-1 text-[10px]">
                  <div className="flex flex-col border border-zinc-400 bg-white/80 px-1 py-1">
                    <label htmlFor="dob-r" className="font-semibold">
                      R = Day
                    </label>
                    <input
                      id="dob-r"
                      name="dob-r"
                      type="number"
                      value={dobR}
                      readOnly
                      className="border border-zinc-400 px-1 py-[1px] text-[10px]"
                    />
                  </div>
                  <div className="flex flex-col border border-zinc-400 bg-white/80 px-1 py-1">
                    <label htmlFor="dob-g" className="font-semibold">
                      G = Month
                    </label>
                    <input
                      id="dob-g"
                      name="dob-g"
                      type="number"
                      value={dobG}
                      readOnly
                      className="border border-zinc-400 px-1 py-[1px] text-[10px]"
                    />
                  </div>
                  <div className="flex flex-col border border-zinc-400 bg-white/80 px-1 py-1">
                    <label htmlFor="dob-b" className="font-semibold">
                      B = Year
                    </label>
                    <input
                      id="dob-b"
                      name="dob-b"
                      type="number"
                      value={dobB}
                      readOnly
                      className="border border-zinc-400 px-1 py-[1px] text-[10px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Buttons */}
          <section className="pt-4 border-t border-dashed border-zinc-700 mt-4">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="border border-black bg-lime-300 px-4 py-2 text-[11px] font-bold uppercase shadow-[3px_3px_0_rgba(0,0,0,0.8)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                >
                  Submit?
                </button>
              </div>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}
