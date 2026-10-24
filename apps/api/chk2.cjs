const sh = require('@app/shared');
const [,, schema, route] = process.argv;
(async()=>{
const fs=require('fs'); const st=JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-afroespat/b604e56b-762f-5033-9aa9-c83b59d52246/scratchpad/lot-h2/state-super.json'));
const cookie=st.cookies.map(c=>c.name+'='+c.value).join('; ');
const r=await fetch('http://localhost:3028/v1/admin'+route,{headers:{cookie}}); const j=await r.json();
const p=sh[schema].safeParse(j); console.log(r.status, p.success, p.success?'':JSON.stringify(p.error.issues.slice(0,4)));
})();
