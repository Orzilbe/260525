'use client';

interface ErrorMessageProps {
  message?: string;
}

const ErrorMessage = ({ message }: ErrorMessageProps) =>
    message ? <p className="text-red-500 text-sm">{message}</p> : null;
    
export default ErrorMessage;