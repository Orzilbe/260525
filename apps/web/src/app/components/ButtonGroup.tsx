
//src/components/ButtonGroup.tsx
import Link from "next/link";

interface Button {
  href: string;
  label: string;
  className: string;
  icon?: string; // אופציונלי - אייקון לכפתור
}

interface ButtonGroupProps {
  buttons: Button[];
  direction?: 'rtl' | 'ltr'; // הוספת תמיכה בכיווניות
  className?: string; // קלאס נוסף לקונטיינר
}

export default function ButtonGroup({ 
  buttons, 
  direction = 'ltr',
  className = '' 
}: ButtonGroupProps) {
  // הגדרת מרווחים בהתאם לכיווניות
  const spacing = direction === 'rtl' 
    ? 'space-y-4 md:space-y-0 md:space-x-reverse md:space-x-4' 
    : 'space-y-4 md:space-y-0 md:space-x-4';
  
  // הגדרת flex direction בהתאם לכיווניות
  const flexDirection = direction === 'rtl' 
    ? 'flex-col md:flex-row-reverse' 
    : 'flex-col md:flex-row';
  
  return (
    <div className={`flex ${flexDirection} justify-center items-center ${spacing} ${className}`}>
      {buttons.map((button, index) => (
        <Link
          key={index}
          href={button.href}
          className={`${button.className} px-6 py-2 text-white text-lg font-semibold rounded-lg shadow-md hover:opacity-90 transition-all duration-300 flex items-center justify-center`}
        >
          {button.icon && <span className="mr-2">{button.icon}</span>}
          {button.label}
        </Link>
      ))}
    </div>
  );
}