import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

const template = await readFile(new URL('../scripts/sw-template.js',import.meta.url),'utf8')
const shell = ['/index.html','/assets/app.js','/assets/app.css','/manifest.webmanifest','/icons/wort-192.png','/icons/wort-512.png']
function worker({failInstall=false}={}) {
  const handlers = {}, entries = new Map(), deleted = []
  let claimed = false, requests = 0, online = false
  const cache = { addAll:async(paths)=>{if(failInstall)throw new Error('offline'); for(const path of paths)entries.set(path,`cached:${path}`)}, match:async(path)=>entries.get(path),put:async(path,response)=>entries.set(path,response) }
  runInNewContext(template.replace('__CACHE_NAME__','"wort-shell-test"').replace('__SHELL__',JSON.stringify(shell)),{
    URL, Set, self:{addEventListener:(name,handler)=>{handlers[name]=handler},location:{origin:'https://wort.test'},clients:{claim:async()=>{claimed=true}}},
    caches:{open:async()=>cache,keys:async()=>['wort-shell-test','wort-shell-old','another-app-cache'],delete:async(key)=>{deleted.push(key)}},
    fetch:async(request)=>{requests++;if(!online)throw new Error('network is offline');return {ok:true,body:request.url,clone(){return this}}},
  })
  const lifetime = (name) => {let task;handlers[name]({waitUntil:(promise)=>{task=promise}});return task}
  const request = (url,mode='cors',method='GET') => {let response;handlers.fetch({request:{url,mode,method},respondWith:(promise)=>{response=promise}});return response}
  return {lifetime,request,deleted,claimed:()=>claimed,requests:()=>requests,setOnline:(value)=>{online=value}}
}
test('installed shell opens every route offline without any network request and cleans only its own obsolete caches',async()=>{
  const sw = worker(); await sw.lifetime('install'); await sw.lifetime('activate')
  for(const route of ['#study','#wordbooks','#grammar','#grammar-g-a1-01','#grammar-practice-g-a1-01','#data-overview','#data-library','#settings','#learn','#review','#output']) assert.equal(await sw.request(`https://wort.test/${route}`,'navigate'),'cached:/index.html')
  for(const path of shell) assert.equal(await sw.request(`https://wort.test${path}`),`cached:${path}`)
  assert.equal(sw.requests(),0); assert.deepEqual(sw.deleted,['wort-shell-old']); assert.equal(sw.claimed(),true)
  assert.equal(sw.request('https://external.test/anything'),undefined)
  assert.equal(sw.request('https://wort.test/private-backup.json'),undefined)
  assert.equal(sw.request('https://wort.test/index.html','cors','POST'),undefined)
})
test('a wordbook stays lazy until requested and remains available offline after first load',async()=>{
  const sw=worker();await sw.lifetime('install')
  assert.equal(sw.requests(),0)
  sw.setOnline(true)
  const first=await sw.request('https://wort.test/wordbooks/goethe-a1.json')
  assert.equal(first.body,'https://wort.test/wordbooks/goethe-a1.json')
  sw.setOnline(false)
  const cached=await sw.request('https://wort.test/wordbooks/goethe-a1.json')
  assert.equal(cached.body,first.body)
  assert.equal(sw.requests(),1)
})
test('incomplete precache fails installation instead of activating an unusable shell',async()=>{
  const sw=worker({failInstall:true});await assert.rejects(sw.lifetime('install'),/offline/);assert.equal(sw.claimed(),false)
})
test('manifest has standalone Wort identity and actual 192/512 PNG assets',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'))
  assert.equal(manifest.name,'Wort');assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/#study')
  for(const size of [192,512]) {
    const icon=manifest.icons.find((item)=>item.sizes===`${size}x${size}`)
    const png=await readFile(new URL(`../public${icon.src}`,import.meta.url))
    assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size)
  }
})
