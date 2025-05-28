// apps/web/src/app/components/SignupFormWrapper.tsx
'use client';

import dynamic from 'next/dynamic';

// ייבוא דינמי של SignupForm עם ביטול SSR
const SignupForm = dynamic(() => import('./SignupForm'), {
  ssr: false, // זה מבטיח שהקומפוננטה תרונדר רק בצד הלקוח
  loading: () => <div className="flex justify-center items-center min-h-screen">
    <div className="animate-pulse text-teal-600 text-xl">טוען טופס...</div>
  </div>
});

export default function SignupFormWrapper() {
  return <SignupForm />;
}