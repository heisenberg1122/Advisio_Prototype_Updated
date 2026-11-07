// Offline video optimization. Runs on an isolated GitHub branch, never in Vercel builds.
// All original URLs, web playback files, captions, chapter navigation and dimensions stay intact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('apps/web/public/walkthroughs');
const roles = ['dean','coordinator','adviser','panelist-structured','panelist-pdf','panelist-preparation'];
const catalogPath = path.join(root, 'catalog.json');
const catalog = JSON.parse(await fs.readFile(catalogPath,'utf8'));
const run = (command,args) => {
  const p=spawnSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:4194304});
  if(p.error || p.status!==0) throw Error(command+': '+(p.error?.message||p.stderr?.slice(-1200)||p.status));
  return p.stdout;
};
const probe = p => JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p]));
const sha = async p => createHash('sha256').update(await fs.readFile(p)).digest('hex');
const target = name => name==='master-1080p.mp4'||/^[a-z0-9-]+-captioned\.mp4$/.test(name)||/^chapters\/[a-z0-9-]+\.mp4$/.test(name);
let saved=0, changed=0;
for(const role of roles){
  const dir=path.join(root,role),releasePath=path.join(dir,'release.json');
  const manifest=JSON.parse(await fs.readFile(releasePath,'utf8'));
  let modified=false;
  for(const item of manifest.files){
    if(!target(item.name))continue;
    assert.match(item.name,/^[a-z0-9./-]+$/);
    assert.ok(!item.name.includes('..'));
    const input=path.join(dir,item.name),temp=path.join(path.dirname(input),'.optimized-'+path.basename(input));
    const before=await fs.stat(input);
    assert.equal(before.size,item.bytes,'Original size mismatch: '+input);
    assert.equal(await sha(input),item.sha256,'Original checksum mismatch: '+input);
    const a=probe(input),v=a.streams.find(s=>s.codec_type==='video');
    assert.equal(v?.codec_name,'h264');
    try{
      run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y','-i',input,
        '-map','0:v:0','-map','0:a?','-map_metadata','0','-c:v','libx264',
        '-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',temp]);
      const b=probe(temp),w=b.streams.find(s=>s.codec_type==='video');
      assert.equal(w?.codec_name,'h264');assert.equal(w.width,v.width);assert.equal(w.height,v.height);
      assert.equal(b.streams.some(s=>s.codec_type==='audio'),a.streams.some(s=>s.codec_type==='audio'));
      assert.ok(Math.abs(Number(b.format.duration)-Number(a.format.duration))<=0.75,'Duration drift: '+input);
      const after=await fs.stat(temp);
      if(after.size>before.size*0.9){console.log('Keep original '+item.name+' (less than 10% saving)');continue;}
      await fs.rename(temp,input);
      item.bytes=after.size;item.sha256=await sha(input);
      saved+=before.size-after.size;changed++;modified=true;
      console.log('Optimized '+role+'/'+item.name+': '+(before.size/1048576).toFixed(1)+' -> '+(after.size/1048576).toFixed(1)+' MiB');
    }finally{await fs.rm(temp,{force:true});}
  }
  if(modified){
    await fs.writeFile(releasePath,JSON.stringify(manifest,null,2)+'\n');
    const entry=catalog.find(x=>x.role===role);assert.ok(entry);
    entry.bytes=manifest.files.reduce((sum,x)=>sum+x.bytes,0);
  }
  for(const item of manifest.files){
    const p=path.join(dir,item.name);
    assert.equal((await fs.stat(p)).size,item.bytes,'Final size mismatch: '+p);
    assert.equal(await sha(p),item.sha256,'Final checksum mismatch: '+p);
  }
}
await fs.writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');
console.log('Completed: '+changed+' files; saved '+(saved/1048576).toFixed(1)+' MiB.');
