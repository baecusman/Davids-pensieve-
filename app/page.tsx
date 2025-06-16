import { processContent } from "@/lib/content-processor"

async function getData() {
  // Simulate fetching data (replace with your actual data fetching logic)
  const content = `
    # Hello World

    This is some example content.

    <MyComponent />
  `

  return content
}

export default async function Page() {
  const content = await getData()
  const processedContent = processContent(content)

  return (
    <main>
      <h1>My Page</h1>
      <div dangerouslySetInnerHTML={{ __html: processedContent }} />
    </main>
  )
}
