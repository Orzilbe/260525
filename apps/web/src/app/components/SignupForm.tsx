// apps/web/src/app/components/SignupForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FormContainer from './FormContainer';
import InputField from './InputField';
import SelectField from './SelectField';
import Header from './Header';

interface FormData {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  englishLevel: string;
  ageRange: string;
}

export default function SignupForm() {
  const router = useRouter();
  // דגל שמציין אם אנחנו בצד הלקוח
  const [isMounted, setIsMounted] = useState(false);

  // השתמש ב-useEffect כדי לעדכן את הדגל רק בעת רינדור בדפדפן
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [formData, setFormData] = useState<FormData>({
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    englishLevel: '',
    ageRange: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [levelDescription, setLevelDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'englishLevel') {
      const descriptions: Record<string, string> = {
        beginner: 'You know a few basic words and phrases.',
        intermediate: 'You can hold simple conversations.',
        advanced: 'You can speak fluently and understand detailed texts.',
      };
      setLevelDescription(descriptions[value] || '');
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    // Email validation with more robust regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) newErrors.email = 'Invalid email address.';
    
    // Name validations
    if (formData.firstName.trim().length < 2) newErrors.firstName = 'First name must be at least 2 characters.';
    if (formData.lastName.trim().length < 2) newErrors.lastName = 'Last name must be at least 2 characters.';
    
    // Phone number validation (adjust regex for your country's phone number format)
    const phoneRegex = /^0[5-9]\d{8}$/; // Israeli mobile phone format
    if (!phoneRegex.test(formData.phoneNumber)) newErrors.phoneNumber = 'Invalid Israeli phone number.';
    
    // Password validations
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters, include uppercase, lowercase, number, and special character.';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }
    
    // Required field validations
    if (!formData.englishLevel) newErrors.englishLevel = 'Please select your English level.';
    if (!formData.ageRange) newErrors.ageRange = 'Please select your age range.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

 // עדכון לפונקציית handleSubmit ב-SignupForm.tsx להוספת לוגים מפורטים

const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setApiError('');
  
  if (validateForm()) {
    setIsLoading(true);
    
    try {
      console.log('Sending registration data:', {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        // לא מציגים את הסיסמה בלוגים מטעמי אבטחה
        password: '********',
        englishLevel: formData.englishLevel,
        ageRange: formData.ageRange,
      });

      // בדיקה אם השרת זמין
      try {
        const healthCheck = await fetch('http://localhost:5000/api/health', { mode: 'no-cors' });
        console.log('API server health check status:', healthCheck.status);
      } catch (healthError) {
        console.error('API server health check failed. Server might be down:', healthError);
      }
      
      // אפשרות 1 - ישירות לשרת ה-API (עלול להיתקל בבעיות CORS)
      /*
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          password: formData.password,
          englishLevel: formData.englishLevel,
          ageRange: formData.ageRange,
        }),
      });
      */
      
      // אפשרות 2 - דרך ה-API Route שלנו (מומלץ)
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          password: formData.password,
          englishLevel: formData.englishLevel,
          ageRange: formData.ageRange,
        }),
      });
      
      console.log('Registration response status:', response.status);
      const data = await response.json();
      console.log('Registration response data:', data);

      if (!response.ok) {
        // לוג מפורט של השגיאה
        console.error('Registration error details:', {
          status: response.status,
          message: data.message || 'No error message provided',
          details: data.details || data.errors || 'No details provided'
        });
        
        let errorMessage = data.message || 'Registration failed';
        
        // אם יש פרטי שגיאה נוספים, נציג אותם
        if (data.details) {
          if (Array.isArray(data.details)) {
            errorMessage += ': ' + data.details.map((err: any) => err.msg || err.message).join(', ');
          } else if (typeof data.details === 'string') {
            errorMessage += ': ' + data.details;
          }
        } else if (data.errors && Array.isArray(data.errors)) {
          errorMessage += ': ' + data.errors.map((err: any) => err.msg || err.message).join(', ');
        }
        
        throw new Error(errorMessage);
      }

      // Store the token if provided
      if (data.token) {
        console.log('Received and storing auth token');
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        console.warn('No auth token received in response');
      }

      console.log('Registration successful, redirecting to topics page');
      router.push('/topics');
    } catch (error: unknown) {
      console.error('Registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      setApiError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  } else {
    console.warn('Form validation failed');
  }
};
  // החזר מסך טעינה אם טרם הושלם הרינדור בצד הלקוח
  if (!isMounted) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 font-sans">
        <div className="text-teal-600 text-xl animate-pulse">טוען...</div>
      </div>
    );
  }

  // כל הקוד הרגיל של הטופס...
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-teal-50 font-sans">
      <div className="absolute top-0 left-0 w-full h-32 bg-teal-500 rounded-b-[40%]"></div>
      
      <div className="relative z-10 w-full max-w-6xl px-6 py-12 flex flex-col lg:flex-row lg:items-center lg:justify-between">
        {/* Left side content (desktop only) */}
        <div className="lg:w-1/2 lg:pr-12 mb-8 lg:mb-0">
        <div className="hidden lg:block">
          <Header title="Join Our Community" />
          <div className="hidden lg:block mt-6 text-gray-600">
            <h2 className="text-2xl font-bold text-teal-700 mb-4">Master English for Israeli Advocacy</h2>
            <p className="mb-3">Join our cutting-edge platform designed to enhance your English skills for effective advocacy.</p>
            <div className="mt-8 space-y-4">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-teal-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>A personalized learning experience with practical language skills for advocacy.</span>
              </div>
              <div className="flex items-center">
                <svg className="h-6 w-6 text-teal-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>AI-powered feedback on writing and speaking to improve clarity and confidence.</span>
              </div>
              <div className="flex items-center">
                <svg className="h-6 w-6 text-teal-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Interactive exercises to practice responding to social media discussions, press questions, and debates.</span>
              </div>
            </div>
          </div>
        </div>
        </div>
        {/* Right side form */}
        <div className="lg:w-1/2">
          <div className="lg:hidden">
            <Header title="Join Our Community" />
          </div>
          <FormContainer>
            {apiError && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md mb-4 shadow-md">
                <div className="flex">
                  <div className="py-1">
                    <svg className="h-6 w-6 text-red-500 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold">Registration Error</p>
                    <p className="text-sm">{apiError}</p>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* כל תוכן הטופס כמו שהיה קודם */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="First Name"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={errors.firstName}
                />
                <InputField
                  label="Last Name"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  error={errors.lastName}
                />
              </div>
              
              <InputField
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
              
              <InputField
                label="Phone Number"
                type="text"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                error={errors.phoneNumber}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                }
              />
              
              {/* Password Field */}
              <div className="space-y-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className={`pl-10 w-full px-3 py-2 border rounded-md ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-700`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs">{errors.password}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 8 characters
                </p>
              </div>
              
              {/* Confirm Password Field */}
              <div className="space-y-1">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className={`pl-10 w-full px-3 py-2 border rounded-md ${
                      errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    } focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-700`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-xs">{errors.confirmPassword}</p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label="English Level"
                  name="englishLevel"
                  value={formData.englishLevel}
                  onChange={handleChange}
                  options={[
                    { value: "beginner", label: "Beginner" },
                    { value: "intermediate", label: "Intermediate" },
                    { value: "advanced", label: "Advanced" },
                  ]}
                  error={errors.englishLevel}
                  description={levelDescription}
                />
                
                <SelectField
                  label="Age Range"
                  name="ageRange"
                  value={formData.ageRange}
                  onChange={handleChange}
                  options={[
                    { value: "0-17", label: "0-17" },
                    { value: "18-24", label: "18-24" },
                    { value: "25-34", label: "25-34" },
                    { value: "35-44", label: "35-44" },
                    { value: "45-54", label: "45-54" },
                    { value: "55-64", label: "55-64" },
                    { value: "65+", label: "65+" },
                  ]}
                  error={errors.ageRange}
                />
              </div>
              
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-teal-600 text-white font-medium rounded-lg shadow-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors duration-200 transform hover:scale-105"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing Up...
                    </div>
                  ) : 'Sign Up'}
                </button>
              </div>
              
              <div className="text-center text-sm text-gray-600 mt-4">
                Already have an account? <a href="/login" className="font-medium text-teal-600 hover:text-teal-500">Sign in</a>
              </div>
            </form>
          </FormContainer>
        </div>
      </div>
    </div>
  );
}