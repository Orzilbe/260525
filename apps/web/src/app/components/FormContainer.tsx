import React, { PropsWithChildren } from 'react';

const FormContainer: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="bg-white p-8 rounded-xl shadow-xl border border-gray-100 w-full max-w-md transform transition-all duration-300 hover:shadow-2xl">
      {children}
    </div>
  );
};

export default FormContainer;