'use client';
export default function Header({ title = "Unity Voice", subtitle = "Learn English, Share Israel's Story!", titleClass = "text-6xl text-orange-500", subtitleClass = "text-xl text-gray-700 mt-4" }) {
    return (
      <div className="text-center mb-8">
        <h1 className={`${titleClass} font-bold`}>{title}</h1>
        {subtitle && <p className={`${subtitleClass}`}>{subtitle}</p>}
      </div>
    );
  }
  