'use client';

import Header from "./components/Header";
import ButtonGroup from "./components/ButtonGroup";
import Footer from "./components/Footer";

export default function Home() {
   const buttons = [
 {
 href: "/login",
 label: "Login",
 className: "bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded",
 },
 {
 href: "/signup",
 label: "Signup",
className: "bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded",
 }, ];

 return (
 <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-yellow-100 to-orange-200">
<style jsx global>{`
  @import url('https://fonts.googleapis.com/css2?family=Sour+Gummy:ital,wght@0,100..900;1,100..900&display=swap');
  * {
    font-family: 'Sour Gummy', cursive;
  }
`}</style>
  <Header titleClass="text-6xl text-orange-500 mb-8" />
 <ButtonGroup buttons={buttons} className="mb-8" />
 <Footer />
 </div>
);
}