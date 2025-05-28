import React from 'react';

interface InputFieldProps {
  label: string;
  type: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  icon?: React.ReactNode;
}

const InputField: React.FC<InputFieldProps> = ({ 
  label, 
  type, 
  name, 
  value, 
  onChange, 
  error, 
  placeholder,
  icon 
}) => {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative rounded-md shadow-sm">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder || `Enter your ${label.toLowerCase()}`}
          className={`${icon ? 'pl-10' : 'pl-3'} w-full px-3 py-2 border rounded-md ${
            error ? 'border-red-500' : 'border-gray-300'
          } focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors duration-200 text-gray-700`}
        />
      </div>
      {error && (
        <p className="text-red-500 text-xs">{error}</p>
      )}
    </div>
  );
};

export default InputField;