import { Transition } from '@headlessui/react'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

export default function Details({children, disabled, open = false, summary}) {
  const [isOpen, setIsOpen] = useState(open)

  useEffect(() => setIsOpen(open), [open])

  return (
    <>
      <button
        className={clsx('flex items-center justify-between w-full focus:outline-none', disabled && 'opacity-25 cursor-not-allowed')}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div>{summary}</div>

        <svg viewBox="0 0 100 101" fill="currentColor" className={clsx('w-6 h-6 text-gray-500 transform transition-transform ease-in-out duration-250 rotate-90', isOpen && 'rotate-0')}>
          <path d="M49.845 100.551c27.246 0 49.805-22.608 49.805-49.805C99.65 23.5 77.042.941 49.796.941 22.6.941.04 23.5.04 50.746c0 27.197 22.608 49.805 49.805 49.805zm17.48-64.6c2.393 0 3.467 2.686 2.1 5.03L52.531 69.642c-1.27 2.246-4.2 2.1-5.47 0L30.12 40.98c-1.27-2.148-.293-5.029 2.148-5.029h35.059z" />
        </svg>
      </button>

      <Transition
        show={isOpen}
        enter="transition-all duration-250 transform origin-top"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition-all duration-250 transform origin-top"
        leaveFrom="opacity-100 scale-100"
        leaveTo="opacity-0 scale-95"
      >
        {children}
      </Transition>
    </>
  )
}
