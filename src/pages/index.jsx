import Head from 'next/head'
import Details from '../components/details'

export default function Home() {
  let fileHandle
  const showFilePicker = async() => {
    if (typeof window === 'undefined') return
    [fileHandle] = await window.showOpenFilePicker();
    console.log(fileHandle)
  }

  return (
    <>
      <Head>
        <title>Recover</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="mt-32">
        <div className="w-full max-w-lg mx-auto">
          <h1 className="text-4xl font-black text-white">Recover</h1>
          <h2 className="mt-2 text-2xl font-bold text-green-200">
            Save the memories that
            <br />
            mean the world to you
          </h2>

          <article className="mt-6 prose prose-xl text-gray-200">
            <p className="font-semibold">
              Follow the steps below to access your data:
            </p>

            <ol>
              <li>
                <Details summary="Back up your iPhone">
                  Test
                </Details>
              </li>
              <li>
                <Details summary="Locate your backup folder">
                  <div className="text-gray-400">
                    <p className="!mt-0">
                      Open Finder and press{" "}
                      <code className="text-gray-300">⌘+shift+g</code> on your
                      keyboard. In the box that opens, enter{" "}
                      <code className="text-gray-300">
                        ~/Library/Application Support/MobileSync/Backup
                      </code>
                      .
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
                  </div>
                </Details>
              </li>
              <li>
                <Details summary="Open the backup folder here">
                  <button onClick={async() => await showFilePicker()}>Open</button>
                </Details>
              </li>
            </ol>
          </article>
        </div>
      </main>
    </>
  );
}
