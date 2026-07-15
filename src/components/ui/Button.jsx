// Button - Section 8 Specs UX v0.5
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-blue-800 text-white hover:bg-blue-900 focus:ring-blue-500 border border-transparent',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700',
  destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border border-transparent',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-300 border border-transparent dark:text-gray-300 dark:hover:bg-gray-700',
};

const sizes = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-5 py-2.5 gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  onClick,
  children,
  type = 'button',
  className = '',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {isLoading && <Loader2 size={14} className="animate-spin flex-shrink-0" />}
      {children}
    </button>
  );
}
