import Head from 'next/head'
import Details from '../components/details'
import TextLoop from 'react-text-loop'
import { useEffect, useRef, useState } from 'react'
import initSqlJs from 'sql.js'
import Button from '../components/button'
import Modal from '../components/modal'
import clsx from 'clsx'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import updateLocale from 'dayjs/plugin/updateLocale'

dayjs.extend(relativeTime)
dayjs.extend(updateLocale)
dayjs.updateLocale('en', {
  relativeTime: {
    future: 'in %s',
    past: '%s ago',
    s: '%ds',
    m: '1min',
    mm: '%dmin',
    h: '1hr',
    hh: '%dhr',
    d: '1d',
    dd: '%dd',
    M: '1mo',
    MM: '%dmo',
    y: '1y',
    yy: '%dy',
  },
})

const Databases = {
  ADDRESS_BOOK: undefined,
  SMS: undefined,
}

const Locations = {
  ADDRESS_BOOK: '31bb7ba8914766d4ba40d6dfb6113c8b614be442',
  SMS: '3d0d7e5fb2ce288813306e4d4636395e047a3d28',
}

const Step = {
  BACKUP: 'backup',
  LOCATE: 'locate',
  OPEN: 'open',
  EXPORT: 'export',
}

const cache = {}

export default function Home() {
  const [step, setStep] = useState(Step.BACKUP)
  const [SQL, setSQL] = useState()
  const [parent, setParent] = useState()
  const [showModal, setShowModal] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [messagesPage, setMessagesPage] = useState(0)
  const [messagesEnd, setMessagesEnd] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState()
  const backupBtn = useRef(null)
  const locateBtn = useRef(null)
  const openBtn = useRef(null)
  const messagesBtn = useRef(null)
  const messagesContainer = useRef(null)
  const messagesLoader = useRef(null)

  const locate = () => {
    setStep(Step.LOCATE)
    setTimeout(() => locateBtn.current?.focus(), 0)
  }

  const open = () => {
    setStep(Step.OPEN)
    setTimeout(() => openBtn.current?.focus(), 0)
  }

  const showDirectoryPicker = async() => {
    if (typeof window === 'undefined') return
    setParent(await window.showDirectoryPicker())
    setStep(Step.EXPORT)
    setTimeout(() => messagesBtn.current?.focus(), 0)
  }

  const readFileAsync = file => {
    return new Promise((resolve, reject) => {
      let reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  const DB = async(location) => {
    if (Databases[location] !== undefined) {
      return Databases[location]
    }

    const dirHandle = await parent.getDirectoryHandle(Locations[location].slice(0, 2))
    const fileHandle = await dirHandle.getFileHandle(Locations[location])
    const file = await fileHandle.getFile()
    const arrayBuffer = await readFileAsync(file)

    Databases[location] = new SQL.Database(new Uint8Array(arrayBuffer))

    return Databases[location]
  }

  const parseTimestamp = field_name => {
    return `CASE WHEN (${field_name} > 1000000000) THEN datetime(${field_name} / 1000000000 + 978307200, 'unixepoch') 
          WHEN ${field_name} <> 0 THEN datetime((${field_name} + 978307200), 'unixepoch') 
          ELSE ${field_name} END`
  }

  const getName = async(messageDest) => {
    if (messageDest.indexOf('@') === -1) {
      messageDest = messageDest.replace(/[\s+\-()]*/g, '')
      if (messageDest.length === 11 && messageDest[0] === '1') {
        messageDest = messageDest.substring(1)
      }
    }

    if (cache[messageDest] !== undefined) {
      return cache[messageDest]
    }

    const result = (await DB('ADDRESS_BOOK')).exec(`
      SELECT c0First as first, c1Last as last
      FROM ABPersonFullTextSearch_content
      WHERE c16Phone LIKE '%${messageDest}%'
    `)
    let name = result?.[0]?.values?.[0]
    name = typeof name !== 'undefined' && name[0]
      ? name[1] ? `${name[0]} ${name[1]}` : name[0]
      : messageDest

    cache[messageDest] = name

    return name
  }

  const getConversations = async() => {
    setLoadingConversations(true)

    const conversationsTemp = (await DB('SMS')).exec(`
      SELECT
        messages.chat_identifier,
        messages.is_from_me,
        messages.date,
        messages.text
      FROM (
        SELECT
          chat.chat_identifier,
          message.ROWID,
          message.is_from_me,
          message.date,
          message.text
        FROM message
        JOIN chat_message_join
          ON message.ROWID = chat_message_join.message_id
        JOIN chat
            ON chat.ROWID = chat_message_join.chat_id
        ORDER BY message.date DESC
      ) AS messages
      GROUP BY messages.chat_identifier
      ORDER BY messages.date DESC
    `)?.[0]?.values
    const conversationsMap = await conversationsTemp.map(async(conversation) => {
      const name = await getName(conversation[0])
      const initials = name.replace(/[^a-zA-Z\s]/g, '').match(/\b\w/g)?.join('').toUpperCase()
      return [...conversation, name, initials]
    })
    setConversations(await Promise.all(conversationsMap))
    setLoadingConversations(false)
    setShowModal(true)
  }

  const selectConversation = async(conversation) => {
    setSelectedConversation(conversation)
    await loadMessages(conversation[0])
  }

  const loadMessages = async(conversationId) => {
    setLoadingMessages(true)
    const limit = 20
    const messagesTemp = (await DB('SMS')).exec(`
      SELECT
        chat.chat_identifier,
        message.is_from_me,
        ${parseTimestamp('message.date')} AS date,
        message.text,
        message.service
      FROM message
      JOIN chat_message_join
        ON message.ROWID = chat_message_join.message_id
      JOIN chat
        ON chat.ROWID = chat_message_join.chat_id
      WHERE chat.chat_identifier = '${conversationId}'
      ORDER BY message.date DESC
      LIMIT ${limit} OFFSET ${limit * messagesPage}
    `)?.[0]?.values
    if (!messagesTemp) {
      setMessagesEnd(true)
      return
    }
    const messagesMap = await messagesTemp.map(async(message) => {
      const name = await getName(message[0])
      const initials = name.replace(/[^a-zA-Z\s]/g, '').match(/\b\w/g)?.join('').toUpperCase()
      return [...message, name, initials]
    })
    const newMessages = await Promise.all(messagesMap)
    setMessages(currentMessages => [...newMessages.reverse(), ...currentMessages])
    setLoadingMessages(false)
  }

  const resetMessages = () => {
    setMessagesEnd(false)
    setMessagesPage(0)
    setMessages([])
    setSelectedConversation(undefined)
  }

  useEffect(async() => setSQL(await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` })), [])

  useEffect(() => backupBtn.current?.focus(), [backupBtn])

  useEffect(() => {
    if (!messagesContainer.current) return
    messagesContainer.current.scrollTop = messagesContainer.current.scrollHeight
  }, [messagesContainer.current])

  useEffect(() => {
    if (!messagesContainer.current) return
    const handleObserver = entities => entities[0].isIntersecting && setMessagesPage(page => page + 1)
    const observer = new IntersectionObserver(handleObserver, {root: messagesContainer.current, rootMargin: '0px', threshold: 1})
    messagesLoader.current && observer.observe(messagesLoader.current)
  }, [messagesContainer.current])

  useEffect(async() => {
    if (!messagesContainer.current) return
    const currentScrollHeight = messagesContainer.current.scrollHeight
    selectedConversation && await loadMessages(selectedConversation[0])
    messagesContainer.current.scrollTop = messagesContainer.current.scrollHeight - currentScrollHeight
  }, [messagesPage])

  return (
    <>
      <Head>
        <title>Recover</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="p-8 sm:py-32">
        <div className="w-full max-w-lg mx-auto">
          <h1 className="text-4xl font-black text-white">Recover</h1>
          <h2 className="mt-2 text-2xl font-bold text-green-200">
            Save the{' '}
            <TextLoop className="text-green-500" interval={5000}>
              {/* <span>memories</span> */}
              <span>conversations</span>
              {/* <span>voicemails</span> */}
            </TextLoop>
            {' '}that
            <br />
            mean the world to you
          </h2>

          <article className="mt-6 prose prose-xl text-gray-200">
            <p className="font-semibold">
              Follow the steps below to access your data:
            </p>

            <ol>
              <li>
                <Details
                  summary="Back up your iPhone"
                  open={step === Step.BACKUP}
                >
                  <p className="!mt-2 text-base">
                    Plug your iPhone into your Mac, then open Finder. You should
                    see your iPhone's name show up in Finder's sidebar. Click
                    that name. Then click the "Back Up" button and wait for
                    it to finish.
                  </p>

                  <Button ref={backupBtn} className="w-full" onClick={locate}>
                    I'm backed up
                  </Button>
                </Details>
              </li>
              <li>
                <Details
                  summary="Locate your backup folder"
                  disabled={[Step.BACKUP].includes(step)}
                  open={step === Step.LOCATE}
                >
                  <p className="!mt-2 text-base">
                    Open Finder and press{' '} <code>⌘+shift+g</code> on your
                    keyboard. In the box that opens, type{' '}
                    <code>~/Library/Application Support/MobileSync/Backup</code>,{' '}
                    then press <code>enter</code>.
                  </p>

                  <p className="text-base">
                    You should now see a list of folders with names like <br /><code>00000000-0000000000000000</code>.
                    Locate the folder that was most recently modified. Move or copy this folder to be another folder
                    that is more easily accessible (e.g. your <code>Downloads</code> folder).
                  </p>

                  <div className="flex items-start px-5 py-4 space-x-4 text-sm text-gray-400 bg-gray-800 border border-gray-700 rounded-xl">
                    <span className="relative inline-flex px-2 py-1 text-sm font-semibold leading-none text-green-900 uppercase bg-green-200 rounded-full top-1">
                      Tip
                    </span>

                    <p className="!my-0">
                      You will be able to find the most recent backup by
                      changing your Finder display mode to&nbsp;&nbsp;
                      <svg
                        viewBox="0 0 100 72"
                        fill="currentColor"
                        className="relative inline-block w-3 h-3 -mt-0.5 text-gray-400"
                        title="list"
                      >
                        <path d="M6.803 12.406c3.418 0 6.153-2.734 6.153-6.103A6.127 6.127 0 006.803.15 6.127 6.127 0 00.651 6.303c0 3.369 2.734 6.103 6.152 6.103zm21.582-2.197h66.7c2.197 0 3.955-1.709 3.955-3.906 0-2.246-1.758-3.955-3.955-3.955h-66.7c-2.246 0-3.955 1.709-3.955 3.955 0 2.197 1.71 3.906 3.955 3.906zM6.803 41.947a6.127 6.127 0 006.153-6.152 6.127 6.127 0 00-6.153-6.152 6.127 6.127 0 00-6.152 6.152 6.127 6.127 0 006.152 6.152zm21.582-2.197h66.7a3.939 3.939 0 003.955-3.955c0-2.197-1.758-3.906-3.955-3.906h-66.7c-2.246 0-3.955 1.709-3.955 3.906s1.71 3.955 3.955 3.955zM6.803 71.488c3.418 0 6.153-2.783 6.153-6.152a6.127 6.127 0 00-6.153-6.152 6.127 6.127 0 00-6.152 6.152c0 3.37 2.734 6.152 6.152 6.152zm21.582-2.246h66.7c2.197 0 3.955-1.709 3.955-3.906 0-2.246-1.758-3.955-3.955-3.955h-66.7c-2.246 0-3.955 1.709-3.955 3.955 0 2.197 1.71 3.906 3.955 3.906z" />
                      </svg>
                      . It will be the most recently modified folder.
                    </p>
                  </div>

                  <Button ref={locateBtn} className="w-full mt-6" onClick={open}>
                    Found It
                  </Button>
                </Details>
              </li>
              <li>
                <Details
                  summary="Open your backup folder"
                  disabled={[Step.BACKUP, Step.LOCATE].includes(step)}
                  open={step === Step.OPEN}
                >
                  <p className="!mt-2 text-base">
                    Click the button below and navigate to and select the folder you just moved (e.g.{' '}
                    <code>Downloads/00000000-0000000000000000</code>).
                  </p>

                  <div className="flex items-start px-5 py-4 mt-4 space-x-4 text-sm text-gray-400 bg-gray-800 border border-gray-700 rounded-xl">
                    <span className="relative inline-flex px-2 py-1 text-sm font-semibold leading-none text-green-900 uppercase bg-green-200 rounded-full top-1">
                      Note
                    </span>

                    <p className="!my-0">
                      This will currently only work in the latest versions of{' '}
                      <a className="focus:outline-none focus:ring-2 focus:ring-green-500" href="https://www.google.com/chrome/" target="_blank" rel="noopener">Google Chrome</a>
                    </p>
                  </div>

                  <Button ref={openBtn} className="w-full mt-6" onClick={showDirectoryPicker}>
                    Open Backup Folder
                  </Button>
                </Details>
              </li>
              <li>
                <Details
                  summary="Choose what you would like to export"
                  disabled={[Step.BACKUP, Step.LOCATE, Step.OPEN].includes(step) || !parent}
                  open={step === Step.EXPORT}
                >
                  <Button
                    ref={messagesBtn}
                    className="w-full mt-6"
                    disabled={loadingConversations}
                    onClick={getConversations}
                  >
                    {loadingConversations && <span className="flex-shrink-0 inline-block w-5" />}

                    <span className="flex-1 mx-4 text-center">Messages</span>

                    {loadingConversations && (
                      <svg className="flex-shrink-0 w-5 h-5 text-green-100 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                  </Button>
                </Details>
              </li>
            </ol>
          </article>
        </div>
      </main>

      <Modal
        actions={(
          <>
            <Button offsetClass="focus:ring-offset-gray-800" variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
            {messages.length > 0 && <Button offsetClass="focus:ring-offset-gray-800" onClick={() => setShowModal(false)}>Download Messages</Button>}
          </>
        )}
        icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />}
        show={showModal}
        setShow={setShowModal}
        title="Export Messages"
      >
        <h3 className="text-sm font-semibold text-gray-500">
          {messages.length > 0 ? (
            <div className="flex items-center space-x-2">
              <button
                className="focus:outline-none focus:ring-2 focus:ring-green-500"
                onClick={resetMessages}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-gray-500">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>

              <span>Conversation with <span className="text-gray-400">{selectedConversation[4]}</span></span>
            </div>
          ) : 'Choose a Conversation'}
        </h3>

        {messages.length > 0 && (
          <div
            ref={messagesContainer}
            className="mt-3 overflow-y-auto max-h-48 shadow-scroll"
          >
            {!messagesEnd ? (
              <button
                ref={messagesLoader}
                className={clsx(
                  'select-none flex items-center justify-center w-10 h-10 mx-auto mt-3 transition-colors duration-200 ease-in-out bg-gray-800 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-gray-900 focus:ring-offset-2 focus:bg-gray-700',
                  loadingMessages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700',
                )}
                disabled={loadingMessages}
                onClick={() => setMessagesPage(page => page + 1)}
              >
                {!loadingMessages ? (
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-500 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
              </button>
            ) : <p className="py-4 mx-auto text-xs text-center text-gray-600">End of Messages</p>}

            {messages.map((message, index) => (
              <div
                className={clsx(
                  'max-w-xs flex items-end',
                  message[1] === 1 && 'ml-auto justify-end',
                  index > 0 && message[1] !== messages[index - 1][1] ? 'mt-2' : 'mt-px',
                )}
                key={message[2] + index}
              >
                {((index < messages.length - 1 && index > 0
                    && message[1] === 0
                    && message[1] !== messages[index + 1][1]
                    && message[1] === messages[index - 1][1]
                  ) || ((index < messages.length - 1 && index > 0)
                    && message[1] === 0
                    && message[1] !== messages[index - 1][1]
                    && message[1] !== messages[index + 1][1]
                  ) || ((index === 0
                      && message[1] === 0
                      && message[1] !== messages[index + 1][1])
                    ) || (index === messages.length - 1
                      && message[1] === 0
                      && message[1] !== messages[index - 1][1]))
                  && (
                  <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 mr-2 transition-colors duration-200 ease-in-out bg-gray-700 rounded-full select-none group-hover:border-gray-800 group-focus:border-gray-800">
                    {message[6] ? (
                      <span className="text-sm font-semibold">{message[6]}</span>
                    ) : (
                      <span className="inline-flex items-center justify-center overflow-hidden rounded-full">
                        <svg className="w-4 h-4" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 83 89">
                          <path d="M41.864 43.258c10.45 0 19.532-9.375 19.532-21.582C61.396 9.616 52.314.68 41.864.68c-10.449 0-19.53 9.13-19.53 21.093 0 12.11 9.032 21.485 19.53 21.485zM11.152 88.473H72.48c7.715 0 10.449-2.198 10.449-6.495 0-12.597-15.772-29.98-41.113-29.98C16.523 51.998.75 69.381.75 81.978c0 4.297 2.735 6.495 10.4 6.495z" />
                        </svg>
                      </span>
                    )}
                  </div>
                )}

                <div
                  className={clsx(
                    !((index < messages.length - 1 && index > 0
                      && message[1] === 0
                      && message[1] !== messages[index + 1][1]
                      && message[1] === messages[index - 1][1]
                    ) || ((index < messages.length - 1 && index > 0)
                      && message[1] === 0
                      && message[1] !== messages[index - 1][1]
                      && message[1] !== messages[index + 1][1]
                    ) || ((index === 0
                        && message[1] === 0
                        && message[1] !== messages[index + 1][1])
                      ) || (index === messages.length - 1
                        && message[1] === 0
                        && message[1] !== messages[index - 1][1])) && 'ml-10',
                    message[1] === 1 && 'text-right',
                  )}
                >
                  {((index > 0 && message[1] === 0 && message[1] !== messages[index - 1][1])
                    || (index === 0 && message[1] === 0)) && (
                    <span className="ml-3 text-xs">
                      {message[5]}<span className="text-gray-500">{' '} &middot; {' '}{dayjs(message[2]).fromNow()}</span>
                    </span>
                  )}

                  {((index > 0 && message[1] === 1 && message[1] !== messages[index - 1][1])
                    || (index === 0 && message[1] === 1)) && (
                    <span className="mr-3 text-xs">
                      <span className="text-gray-500">{dayjs(message[2]).fromNow()}{' '} &middot; {' '}</span>Me
                    </span>
                  )}

                  <div
                    className={clsx(
                      'py-1 px-3 rounded-2xl max-w-max',
                      message[1] === 1 ? message[4] === 'SMS' ? 'bg-green-500 text-green-100' : 'bg-blue-500 text-blue-100' : 'bg-gray-700 text-gray-300',
                      message[1] === 1 && 'ml-auto',
                    )}
                  >
                    <p className="text-left break-word">{message[3]}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {messages.length === 0 && (
          <ul className="mt-3 -ml-6 overflow-y-auto max-h-48 shadow-scroll overscroll-contain">
            {conversations.map(conversation => (
              <li key={conversation[0]}>
                <button
                  className="flex items-center justify-between w-full px-6 py-2 space-x-3 text-left transition-colors duration-200 ease-in-out rounded-xl focus:outline-none hover:bg-gray-800 focus:bg-gray-800 group"
                  onClick={() => selectConversation(conversation)}
                >
                  <div>
                    <span className="font-semibold">{conversation[4]}</span>
                    <p className="text-sm line-clamp-1">{conversation[3]}</p>
                  </div>
                  <div className="flex items-center flex-shrink-0 -space-x-6">
                    <div className="flex items-center justify-center w-12 h-12 transition-colors duration-200 ease-in-out bg-gray-700 border-4 border-gray-900 rounded-full select-none group-hover:border-gray-800 group-focus:border-gray-800">
                      {conversation[5] ? (
                        <span className="text-base font-semibold">{conversation[5]}</span>
                      ) : (
                        <span className="inline-flex items-center justify-center overflow-hidden rounded-full">
                          <svg className="w-6 h-6" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 83 89">
                            <path d="M41.864 43.258c10.45 0 19.532-9.375 19.532-21.582C61.396 9.616 52.314.68 41.864.68c-10.449 0-19.53 9.13-19.53 21.093 0 12.11 9.032 21.485 19.53 21.485zM11.152 88.473H72.48c7.715 0 10.449-2.198 10.449-6.495 0-12.597-15.772-29.98-41.113-29.98C16.523 51.998.75 69.381.75 81.978c0 4.297 2.735 6.495 10.4 6.495z" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
