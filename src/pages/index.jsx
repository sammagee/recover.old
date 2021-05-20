import Head from 'next/head'
import Details from '../components/details'
import { useEffect, useRef, useState } from 'react'
import initSqlJs from 'sql.js'
import Button from '../components/button'
import Modal from '../components/modal'
import clsx from 'clsx'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import updateLocale from 'dayjs/plugin/updateLocale'
import filehash from '../utils/fileHash'

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
  ADDRESS_BOOK: filehash('Library/AddressBook/AddressBook.sqlitedb'),
  SMS: filehash('Library/SMS/sms.db'),
  VOICEMAILS: filehash('Library/Voicemail/voicemail.db'),
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
  const [showMessagesModal, setShowMessagesModal] = useState(false)
  const [showVoicemailsModal, setShowVoicemailsModal] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [messagesPage, setMessagesPage] = useState(0)
  const [messagesEnd, setMessagesEnd] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState()
  const [voicemails, setVoicemails] = useState([])
  const [loadingVoicemails, setLoadingVoicemails] = useState(false)
  const backupBtn = useRef(null)
  const locateBtn = useRef(null)
  const openBtn = useRef(null)
  const messagesBtn = useRef(null)
  const messagesContainer = useRef(null)
  const messagesLoader = useRef(null)
  const voicemailsBtn = useRef(null)
  const voicemailsContainer = useRef(null)

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

  const getName = async(dest) => {
    if (dest.indexOf('@') === -1) {
      dest = dest.replace(/[\s+\-()]*/g, '')
      if (dest.length === 11 && dest[0] === '1') {
        dest = dest.substring(1)
      }
    }

    if (cache[dest] !== undefined) {
      return cache[dest]
    }

    const result = (await DB('ADDRESS_BOOK')).exec(`
      SELECT c0First as first, c1Last as last
      FROM ABPersonFullTextSearch_content
      WHERE c16Phone LIKE '%${dest}%'
    `)
    let name = result?.[0]?.values?.[0]
    name = typeof name !== 'undefined' && name[0]
      ? name[1] ? `${name[0]} ${name[1]}` : name[0]
      : dest

    cache[dest] = name

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
    setShowMessagesModal(true)
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

  const downloadMessages = async() => {
    const html2pdf = (await import('html2pdf.js')).default
    html2pdf().set({
      margin: 16,
      pagebreak: {mode: 'avoid-all'},
      filename: 'Messages.pdf',
      html2canvas:  { scale: 2 },
    }).from(document.getElementById('messages')).save();
  }

  const getVoicemails = async() => {
    setLoadingVoicemails(true)
    const voicemailsTemp = (await DB('VOICEMAILS')).exec(`
      SELECT
        ROWID,
        sender,
        duration,
        datetime(date, 'unixepoch') AS XFORMATTEDDATESTRING
      FROM voicemail
      ORDER BY date DESC
    `)?.[0]?.values
    const voicemailsMap = await voicemailsTemp.map(async(voicemail) => {
      const name = await getName(voicemail[1])
      const initials = name.replace(/[^a-zA-Z\s]/g, '').match(/\b\w/g)?.join('').toUpperCase()
      return [...voicemail, name, initials]
    })
    setVoicemails(await Promise.all(voicemailsMap))
    setLoadingVoicemails(false)
    setShowVoicemailsModal(true)
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
            <span className="text-green-500">conversations</span>
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
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <Button
                      ref={messagesBtn}
                      disabled={loadingConversations}
                      onClick={getConversations}
                    >
                      <span className="flex-shrink-0 inline-block w-5" />
                      <span className="flex-1 mx-4 text-center">Messages</span>

                      {loadingConversations ? (
                        <svg className="flex-shrink-0 w-5 h-5 text-green-100 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="flex-shrink-0 w-5 h-5 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      )}
                    </Button>

                    <Button
                      ref={voicemailsBtn}
                      disabled={loadingVoicemails}
                      onClick={getVoicemails}
                    >
                      <span className="flex-shrink-0 inline-block w-5" />
                      <span className="flex-1 mx-4 text-center">Voicemails</span>

                      {loadingVoicemails ? (
                        <svg className="flex-shrink-0 w-5 h-5 text-green-100 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <svg className="flex-shrink-0 w-5 h-5 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      )}
                    </Button>
                  </div>
                </Details>
              </li>
            </ol>
          </article>

          <footer>
            <p className="flex items-center justify-center mt-6 text-gray-500">
              Made with&nbsp;
              <svg className="flex-shrink-0 w-4 h-4 text-green-500 animate-beat" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              &nbsp;by&nbsp;<a className="font-medium hover:underline focus:ring-2 focus:outline-none focus:ring-green-500" href="https://krafted.dev" target="_blank" rel="noopener">Krafted</a>
            </p>
          </footer>
        </div>
      </main>

      {/* Messages Modal */}
      <Modal
        actions={(
          <>
            <Button offsetClass="focus:ring-offset-gray-800" variant="secondary" onClick={() => setShowMessagesModal(false)}>Close</Button>
            {messages.length > 0 && <Button offsetClass="focus:ring-offset-gray-800" onClick={downloadMessages}>Download Messages</Button>}
          </>
        )}
        icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />}
        show={showMessagesModal}
        setShow={setShowMessagesModal}
        title="Messages"
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
            id="messagesContainer"
            ref={messagesContainer}
            className="mt-3 overflow-y-auto max-h-48 shadow-scroll overscroll-contain"
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

            <div id="messages">
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
                    <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 mr-2 text-gray-400 transition-colors duration-200 ease-in-out bg-gray-700 rounded-full select-none group-hover:border-gray-800 group-focus:border-gray-800">
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
                      <span className="ml-3 text-xs text-gray-400">
                        {message[5]}<span className="text-gray-500">{' '} &middot; {' '}{dayjs(message[2]).fromNow()}</span>
                      </span>
                    )}

                    {((index > 0 && message[1] === 1 && message[1] !== messages[index - 1][1])
                      || (index === 0 && message[1] === 1)) && (
                      <span className="mr-3 text-xs text-gray-400">
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
          </div>
        )}

        {messages.length === 0 && (
          <div className="mt-3 overflow-y-auto sm:-ml-6 max-h-48 shadow-scroll overscroll-contain">
            {conversations.map(conversation => (
              <div key={conversation[0]}>
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
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Voicemails Modal */}
      <Modal
        actions={<Button offsetClass="focus:ring-offset-gray-800" variant="secondary" onClick={() => setShowVoicemailsModal(false)}>Close</Button>}
        icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />}
        show={showVoicemailsModal}
        setShow={setShowVoicemailsModal}
        title="Voicemails"
      >
        {voicemails.length > 0 && (
          <div
            id="voicemailsContainer"
            ref={voicemailsContainer}
            className="mt-3 overflow-y-auto sm:-ml-6 max-h-48 shadow-scroll overscroll-contain"
          >
            <div id="voicemails">
              {voicemails.map(voicemail => (
                <div key={voicemail[0]}>
                  <div className="flex items-center justify-between w-full px-6 py-2 space-x-3 text-left transition-colors duration-200 ease-in-out rounded-xl focus:outline-none hover:bg-gray-800 focus:bg-gray-800 group">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-gray-700 rounded-full select-none">
                        {voicemail[5] ? (
                          <span className="text-base font-semibold">{voicemail[5]}</span>
                        ) : (
                          <span className="inline-flex items-center justify-center overflow-hidden rounded-full">
                            <svg className="w-6 h-6" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 83 89">
                              <path d="M41.864 43.258c10.45 0 19.532-9.375 19.532-21.582C61.396 9.616 52.314.68 41.864.68c-10.449 0-19.53 9.13-19.53 21.093 0 12.11 9.032 21.485 19.53 21.485zM11.152 88.473H72.48c7.715 0 10.449-2.198 10.449-6.495 0-12.597-15.772-29.98-41.113-29.98C16.523 51.998.75 69.381.75 81.978c0 4.297 2.735 6.495 10.4 6.495z" />
                            </svg>
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="font-semibold">{voicemail[4]}</span>
                        <p className="text-sm text-gray-500">
                          {dayjs(voicemail[3]).fromNow()}{' '}&middot;{' '}{voicemail[2]}s
                        </p>
                      </div>
                    </div>

                    <button className="flex items-center justify-center w-10 h-10 transition-colors duration-200 ease-in-out rounded-full focus:outline-none hover:bg-gray-700 focus:bg-gray-700 focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 focus:ring-offset-gray-800">
                      <svg className="w-5 h-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
