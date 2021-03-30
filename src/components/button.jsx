export default function Button({children, onClick}) {
  return (
    <button
      className="flex items-center justify-center w-full px-5 py-4 mt-6 text-base font-semibold text-green-100 uppercase transition-colors duration-200 transform bg-green-500 border-t border-green-400 shadow rounded-xl hover:bg-green-400 focus:ring-2 focus:outline-none focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500"
      onClick={onClick}
    >
      {children}
    </button>
  )
}
