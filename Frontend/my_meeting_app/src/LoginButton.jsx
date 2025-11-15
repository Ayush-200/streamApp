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
      {/* Overlay for readability, now slightly darker to match the example */}
      <div className="absolute inset-0 bg-black/50"></div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center p-6 z-20">
        {/* Logo + Text */}
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="Future Connect Logo"
            className="w-10 h-10 object-contain"
          />
          <div className="text-lg font-semibold text-white">
            Giggling Platypus Co.
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex gap-8 text-white font-medium">
          <div className="hover:text-[#FE7743] cursor-pointer transition">Home</div>
          <div className="hover:text-[#FE7743] cursor-pointer transition">Photo</div>
          <div className="hover:text-[#FE7743] cursor-pointer transition">About Us</div>
          <div className="hover:text-[#FE7743] cursor-pointer transition">Contact</div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative mt-20 flex flex-col justify-center items-center flex-1 text-center z-10">
        <h1
          className="text-9xl font-extrabold text-white mb-2"
          style={{
            textShadow: "0 0 10px #FE7743, 0 0 20px #FE7743, 0 0 30px #FE7743, 0 0 40px #FE7743",
          }}
        >
          FUTURE CONNECT
        </h1>
        <p className="tracking-widest text-white/80 text-lg mb-12">
          www.futureConnect.com
        </p>
        <p className="text-white w-[50vw]">
          Welcome to Future Connect — a platform designed to bring people and technology together. Explore innovative tools, learn new skills, and stay updated with the latest trends in the digital world. Whether you're a student, professional, or tech enthusiast, Future Connect helps you grow, connect, and stay ahead.
        </p><br />
        <button
          onClick={() => loginWithRedirect()}
          className="bg-[#FE7743] hover:bg-[#273F4F] text-black font-semibold px-10 py-4 rounded-full shadow-xl transition"
        >
          Log In
        </button>
      </main>
    </div>
  );
};

export default LoginButton;