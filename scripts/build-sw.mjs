import { readdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, relative, sep } from 'node:path'

const outDir = resolve('dist')
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(resolve(directory, entry.name)) : resolve(directory, entry.name)))).flat()
}
const paths = (await files(outDir)).map((path) => relative(outDir,path).split(sep).join('/'))
  .filter((path) => path === 'index.html' || path === 'manifest.webmanifest' || path.startsWith('assets/') || path.startsWith('icons/')).sort()
const lazyPaths = (await files(resolve(outDir,'wordbooks'))).map((path)=>relative(outDir,path).split(sep).join('/')).sort()
const template = await readFile(new URL('./sw-template.js', import.meta.url),'utf8')
const hash = createHash('sha256').update(template)
for (const path of [...paths,...lazyPaths]) hash.update(path).update(await readFile(resolve(outDir,path)))
const cacheName = `wort-shell-${hash.digest('hex').slice(0,16)}`
const basePath = process.env.GITHUB_PAGES ? '/wort/' : '/'
const output = template
  .replace('__CACHE_NAME__',JSON.stringify(cacheName))
  .replace('__BASE_PATH__',JSON.stringify(basePath))
  .replace('__SHELL__',JSON.stringify(paths.map((path) => `${basePath}${path}`)))
await writeFile(resolve(outDir,'sw.js'),output)
console.log(`Offline shell: ${paths.length} resources, ${cacheName}`)
