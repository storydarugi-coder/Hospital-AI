import { jsxRenderer } from 'hono/jsx-renderer'

// @ts-expect-error - Hono JSX type compatibility
export const renderer = jsxRenderer(({ children }: { children: unknown }) => {
  return (
    <html>
      <head>
        <link href="/static/style.css" rel="stylesheet" />
      </head>
      <body>{children as any}</body>
    </html>
  )
})
