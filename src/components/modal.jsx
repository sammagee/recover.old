import { Transition } from '@headlessui/react'
import hotkeys from 'hotkeys-js'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({
  actions,
  children,
  icon,
  show,
  setShow,
  title,
}) {
  const container = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  })

  useEffect(() => {
    hotkeys('esc', event => {
      event.preventDefault()
      setShow(false)
    })
    return () => hotkeys.unbind('esc')
  })

  useEffect(() => {
    if (!show) return
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) document.activeElement?.blur()
    setTimeout(() => container.current?.focus(), 0)
  }, [show])

  return mounted ? createPortal((
    <Transition show={show}>
      <div className="fixed inset-0 z-30 overflow-x-hidden overflow-y-auto pb-safe-bottom">
        <div className="flex items-end justify-center min-h-screen p-4 text-center sm:block sm:p-0">
          <Transition.Child
            className="fixed inset-0 transition-all bg-black backdrop-filter backdrop-blur-sm bg-opacity-90 focus:outline-none"
            enter="duration-300 ease-out"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="duration-200 ease-in"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            aria-hidden="true"
            onClick={() => setShow(false)}
          />

          {/* This element is to trick the browser into centering the modal contents. */}
          <span
            className="hidden sm:inline-block sm:align-middle sm:h-screen"
            aria-hidden="true"
          >
            &#8203;
          </span>

          <Transition.Child
            className="inline-block w-full text-left align-bottom transition-all transform bg-gray-900 rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg"
            enter="duration-300 ease-out"
            enterFrom="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
            enterTo="translate-y-0 opacity-100 sm:scale-100"
            leave="duration-200 ease-in"
            leaveFrom="translate-y-0 opacity-100 sm:scale-100"
            leaveTo="translate-y-4 opacity-0 sm:translate-y-0 sm:scale-95"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-headline"
          >
            <div ref={container}>
              <div className="p-4 sm:p-6">
                <div className="flex items-start sm:space-x-6">
                  {icon && (
                    <div className="hidden sm:block">
                      <div className="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-gray-800 rounded-full sm:mx-0 sm:h-10 sm:w-10">
                        <svg className="w-6 h-6 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          {icon}
                        </svg>
                      </div>
                    </div>
                  )}

                  <div className="flex-1">
                    {title && (
                      <header className="flex items-center">
                        <h3 className="flex items-center text-lg font-semibold leading-6 text-gray-200 sm:h-10" id="modal-headline">
                          {title}
                        </h3>
                      </header>
                    )}

                    <div className="mt-3 text-gray-400">
                      {children}
                    </div>
                  </div>
                </div>
              </div>

              {actions && (
                <div className="flex items-center justify-end p-4 space-x-3 bg-gray-800 rounded-b-lg sm:px-6 sm:py-3">
                  {actions}
                </div>
              )}
            </div>
          </Transition.Child>
        </div>
      </div>
    </Transition>
  ), document.getElementById('modals')) : null
}
