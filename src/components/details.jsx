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

        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={clsx('w-6 h-6 text-gray-500 transform transition-transform ease-in-out duration-250', isOpen && 'rotate-180')}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
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
