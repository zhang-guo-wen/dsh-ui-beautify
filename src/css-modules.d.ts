/**
 * CSS Modules as the client bundler hands them to components: a hashed class
 * name per local name. `build-client.mjs` compiles and injects the sheet, so the
 * default export is the only surface a component sees.
 */
declare module '*mobile-layout.css' {
  const css: string
  export default css
}

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
