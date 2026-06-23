import { useAuth0 } from "@auth0/auth0-react";
import React, { useEffect } from "react";
import newBackground from "./assets/home_background_2.png"; // Your existing background image
import logo from "./assets/logo.png"; // Your existing logo
// import newBackground from "./assets/outer_space_background.jpg"; // A new background image for the new design

const LoginButton = ({ setUser }) => {
  const { loginWithRedirect, user, isAuthenticated } = useAuth0();

  useEffect(() => {
    if (isAuthenticated && user) {
      setUser(user);
    }
  }, [isAuthenticated, user, setUser]);

  return (
    <div
      className="relative w-full h-screen bg-cover bg-center flex flex-col"
      style={{ backgroundImage: `url(${newBackground})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70"></div>

      <header className="absolute top-0 left-0 w-full flex justify-between items-center p-6 z-20 animate-fade-in">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="StreamApp Logo"
            className="w-10 h-10 object-contain"
          />
          <div className="text-lg font-semibold text-white">
            StreamApp
          </div>
        </div>

        <nav className="flex gap-8 text-white/80 font-medium text-sm">
          <div className="hover:text-[#FFBA08] cursor-pointer transition-colors duration-300">Home</div>
          <div className="hover:text-[#FFBA08] cursor-pointer transition-colors duration-300">Features</div>
          <div className="hover:text-[#FFBA08] cursor-pointer transition-colors duration-300">About</div>
        </nav>
      </header>

      <main className="relative mt-20 flex flex-col justify-center items-center flex-1 text-center z-10 px-6">
        <div className="animate-fade-up">
          <h1
            className="text-8xl md:text-9xl font-extrabold text-white mb-4 tracking-tight"
            style={{
              textShadow: "0 0 20px rgba(255, 186, 8, 0.4), 0 0 40px rgba(255, 186, 8, 0.2)",
            }}
          >
            STREAM<span className="text-gradient">APP</span>
          </h1>
          <p className="tracking-[0.3em] text-white/60 text-sm md:text-base mb-8 uppercase">
            Professional Video Meetings
          </p>
          <p className="text-white/70 max-w-2xl mx-auto leading-relaxed text-base md:text-lg mb-10">
            A modern platform for seamless video collaboration, recording, and content management. 
            Connect, create, and share with confidence.
          </p>
          <button
            onClick={() => loginWithRedirect()}
            className="bg-[#FFBA08] hover:bg-[#FF7A30] text-[#032B43] font-semibold px-12 py-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-[#FFBA08]/25 hover:shadow-2xl hover:scale-105 active:scale-95"
          >
            Get Started
          </button>
        </div>
      </main>
    </div>
  );
};

export default LoginButton;