import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const [inDir, outDir, batchArg] = process.argv.slice(2);
const BATCH = Number(batchArg ?? 300);
const CAT=new Set(["phrase","dance","song","image","comment","challenge"]);
const MED=new Set(["image","video","audio","text","embed"]);
const SAF=new Set(["green","yellow","gray","red"]); const DIF=new Set(["beginner","normal","deep"]);
const SEN=new Set(["funny","ironic","controversial","negative","wholesome"]);
const q=(s)=> (s==null||s==="")?"null":`'${String(s).replaceAll("'","''")}'`;
const arr=(a)=> !a||!a.length?"'{}'":`array[${a.map(q).join(",")}]`;
const seen=new Set(); const rows=[];
for(const f of readdirSync(inDir).filter(f=>f.endsWith(".jsonl")).sort())
 for(const line of readFileSync(join(inDir,f),"utf8").split("\n")){
  const t=line.trim(); if(!t||!t.startsWith("{"))continue;
  let m; try{m=JSON.parse(t)}catch{continue}
  if(!m.title||!m.summary)continue;
  const k=String(m.title).replace(/\s+/g,"").toLowerCase(); if(seen.has(k))continue; seen.add(k);
  const year=Math.min(2026,Math.max(1980,Number(m.year)||2020));
  const cat=CAT.has(m.category)?m.category:(m.media_type==="video"?"challenge":"image");
  const med=MED.has(m.media_type)?m.media_type:"image";
  const saf=SAF.has(m.safety_level)?m.safety_level:"yellow";
  const dif=DIF.has(m.difficulty)?m.difficulty:"normal";
  const sen=SEN.has(m.sentiment)?m.sentiment:"funny";
  const life=year>=2025?"active":year>=2023?"cooling":"archived";
  const slug=String(m.title).trim().replace(/\s+/g,"-").replaceAll("'","").slice(0,60);
  const uc=m.usage_note?`jsonb_build_object('work',${q(saf)},'friends','green','family',${q(saf)},'sns',${q(saf)})`:"'{}'::jsonb";
  rows.push(`(${q(m.title)},${q(slug)},${arr(m.aliases)},${q(m.summary)},${q(m.description)},${q(m.origin)},${q(m.usage_note)},${q(m.caution)},${q(saf)},${q(life)},${q(cat)},${q(med)},${q(dif)},${q(sen)},${year},${uc})`);
 }
mkdirSync(outDir,{recursive:true});
let idx=0;
for(let i=0;i<rows.length;i+=BATCH){
 idx++;
 const chunk=rows.slice(i,i+BATCH);
 writeFileSync(join(outDir,`memes-${String(idx).padStart(2,"0")}.sql`),
  `insert into memes (title,slug,aliases,summary,description,origin,usage_note,caution,safety_level,lifecycle_status,category,media_type,difficulty,sentiment,origin_year,usage_context,moderation_status,published_at)\nselect v.* , 'approved'::moderation_status, now() from (values\n${chunk.join(",\n")}\n) as v(title,slug,aliases,summary,description,origin,usage_note,caution,safety_level,lifecycle_status,category,media_type,difficulty,sentiment,origin_year,usage_context)\non conflict (slug) do nothing;\n`);
}
console.log(`rows=${rows.length} files=${idx}`);
