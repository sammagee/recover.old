import NextDocument, { Html, Head, Main, NextScript } from 'next/document'

class Document extends NextDocument {
  static async getInitialProps(ctx) {
    const initialProps = await NextDocument.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    return (
      <Html className="font-sans antialiased">
        <Head />
        <body className="bg-gray-900">
          <Main />
          <div id="modals" />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default Document
