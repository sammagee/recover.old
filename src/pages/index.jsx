import Head from 'next/head'
import Details from '../components/details'
import TextLoop from 'react-text-loop'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import initSqlJs from 'sql.js'
import Button from '../components/button'

const Step = {
  BACKUP: 'backup',
  LOCATE: 'locate',
  OPEN: 'open',
  EXPORT: 'export',
}

export default function Home() {
  const [step, setStep] = useState(Step.BACKUP)
  const [SQL, setSQL] = useState()
  const [parent, setParent] = useState()
  const [loadingMessages, setLoadingMessages] = useState(false)

  const showDirectoryPicker = async() => {
    if (typeof window === 'undefined') return
    setParent(await window.showDirectoryPicker())
    setStep(Step.EXPORT)
  }

  const readFileAsync = (file) => {
    return new Promise((resolve, reject) => {
      let reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  const getMessages = async() => {
    setLoadingMessages(true)
    const dirHandle = await parent.getDirectoryHandle('3d')
    const fileHandle = await dirHandle.getFileHandle('3d0d7e5fb2ce288813306e4d4636395e047a3d28')
    const file = await fileHandle.getFile()
    const arrayBuffer = await readFileAsync(file)
    const db = new SQL.Database(new Uint8Array(arrayBuffer))
    console.log(db.exec(`
      SELECT
        message.*,
        handle.id as sender_name
      FROM chat_message_join
      INNER JOIN message
        ON message.rowid = chat_message_join.message_id
      INNER JOIN handle
        ON handle.rowid = message.handle_id
    `))
    setLoadingMessages(false)
  }

  useEffect(async() => setSQL(await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` })), [])

  return (
    <>
      <Head>
        <title>Recover</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="py-32">
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

                  <Button onClick={() => setStep(Step.LOCATE)}>
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

                  <Button onClick={() => setStep(Step.OPEN)}>
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

                  <Button onClick={showDirectoryPicker}>
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
                  <button
                    className={clsx(
                      'flex items-center w-full px-5 py-4 mt-4 text-base font-semibold text-green-100 uppercase transition-colors duration-200 transform bg-green-500 border-t border-green-400 shadow rounded-xl hover:bg-green-400 focus:ring-2 focus:outline-none focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500',
                      loadingMessages && 'opacity-50 cursor-not-allowed hover:bg-green-500',
                    )}
                    disabled={loadingMessages}
                    onClick={getMessages}
                  >
                    {loadingMessages && <span className="flex-shrink-0 inline-block w-5" />}

                    <span className="flex-1 mx-4 text-center">Messages</span>

                    {loadingMessages && (
                      <svg className="flex-shrink-0 w-5 h-5 text-green-100 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                  </button>
                </Details>
              </li>
            </ol>
          </article>
        </div>
      </main>
    </>
  );
}
