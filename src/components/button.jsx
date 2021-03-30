import clsx from "clsx"
import { forwardRef } from "react"

const Button = forwardRef(({
  children,
  className,
  disabled,
  loading,
  onClick,
  variant = 'primary',
}, ref) => {
  const classes = {
    primary: clsx(
      'shadow text-green-100 bg-green-500 border-t border-green-400 focus:ring-2 focus:outline-none focus:ring-green-500',
      (disabled || loading) ? 'hover:bg-green-500' : 'hover:bg-green-400',
    ),
    secondary: clsx(
      'text-gray-200 focus:ring-2 focus:outline-none focus:ring-gray-700',
      !(disabled || loading) && 'hover:bg-gray-700'
    ),
  }[variant]

  return (
    <button
      ref={ref}
      className={clsx(
        'flex items-center justify-center px-6 py-4 text-base font-semibold uppercase transition-colors duration-200 ease-in-out transform rounded-xl focus:ring-offset-2 focus:ring-offset-gray-900',
        (disabled || loading) && 'opacity-50 cursor-not-allowed select-none',
        classes,
        className,
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
})

export default Button
