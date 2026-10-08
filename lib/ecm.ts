// Import of match data from eCircuitMania. Their site only serves data to real
// browser sessions, so the bookmarklet below reads the rendered match page in the
// user's own browser and the result is pasted into the import dialog.

export interface EcmEntry {
  // Player name and time ("1:03.504" or "DNF") in finishing order
  p: string
  t: string
}

export interface EcmSet {
  label: string
  map: string
  rounds: EcmEntry[][]
}

export interface EcmPayload {
  ecm: 1
  url?: string
  teams: Array<{ name: string; players: string[] }>
  sets: EcmSet[]
}

export function parseEcmPayload(text: string): EcmPayload | null {
  try {
    const data = JSON.parse(text)
    if (data?.ecm !== 1 || !Array.isArray(data.sets) || !Array.isArray(data.teams)) return null
    const valid = data.sets.every(
      (s: EcmSet) =>
        typeof s.label === "string" &&
        Array.isArray(s.rounds) &&
        s.rounds.every((r) => Array.isArray(r) && r.every((e) => typeof e?.p === "string"))
    )
    return valid ? (data as EcmPayload) : null
  } catch {
    return null
  }
}

// "Clin_TM" and "Clin", or "Joooooey" and "Jooooey", should be recognised as the same player
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/tm$/, "")
    .replace(/(.)\1+/g, "$1")
}

// Plain ES5-style JavaScript on purpose: it runs as a bookmarklet on the eCircuitMania page.
// It relies on visible text and table structure only, not on their generated class names.
export const ECM_BOOKMARKLET = String.raw`(async function(){
var sleep=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
var txt=function(e){return e?(e.textContent||'').replace(/\s+/g,' ').trim():''};
var own=function(e){return Array.prototype.filter.call(e.childNodes,function(n){return n.nodeType===3}).map(function(n){return n.textContent}).join(' ').replace(/\s+/g,' ').trim()};
var findTable=function(){return Array.prototype.find.call(document.querySelectorAll('table'),function(t){return Array.prototype.some.call(t.querySelectorAll('thead th'),function(h){return txt(h)==='Round 1'})})};
var readSet=function(){
var t=findTable();if(!t)return null;
var map='',el=t;
while(el&&el!==document.body){var p=el.previousElementSibling;if(p&&txt(p)&&!p.querySelector('table')){map=txt(p);break}el=el.parentElement}
var teams=[],rounds=[];
Array.prototype.forEach.call(t.querySelectorAll('tbody tr'),function(r){
var c=Array.prototype.map.call(r.children,txt);
if(/^\d+(st|nd|rd|th)$/.test(c[1]||'')){for(var i=2;i+1<c.length;i+=2){var k=(i-2)/2;(rounds[k]=rounds[k]||[]).push({p:c[i],t:c[i+1]})}}
else if(c[0])teams.push(c[0]);
});
return{map:map,teams:teams,rounds:rounds.map(function(r){return r.filter(function(x){return x.p})})};
};
var btns=Array.prototype.filter.call(document.querySelectorAll('button'),function(b){return /^Set \d+/.test(txt(b))});
var sets=[],teamNames=[],prev='';
if(btns.length){
for(var i=0;i<btns.length;i++){
btns[i].click();await sleep(500);
var d=readSet();
if(d&&i>0&&JSON.stringify(d.rounds)===prev){await sleep(1200);d=readSet()}
if(d){prev=JSON.stringify(d.rounds);if(!teamNames.length)teamNames=d.teams;sets.push({label:own(btns[i])||('Set '+(i+1)),map:d.map,rounds:d.rounds})}
}
btns[0].click();
}else{
var s=readSet();if(s){teamNames=s.teams;sets.push({label:'Set 1',map:s.map,rounds:s.rounds})}
}
if(!sets.length){alert('Keine Runden gefunden. Ist die Match-Seite geöffnet?');return}
var teams=teamNames.map(function(n){
var players=[];
Array.prototype.some.call(document.querySelectorAll('span,div'),function(e){
var sib=e.nextElementSibling;
if(own(e)===n&&sib&&sib.children.length>1&&!e.closest('table')){players=Array.prototype.map.call(sib.children,txt).filter(Boolean);return true}
return false});
return{name:n,players:players}});
var out=JSON.stringify({ecm:1,url:location.href,teams:teams,sets:sets});
var total=sets.reduce(function(a,x){return a+x.rounds.length},0);
var box=document.createElement('div');
box.style.cssText='position:fixed;z-index:2147483647;top:20px;right:20px;width:360px;padding:16px;background:#1c1819;color:#f5f0f0;border:1px solid #FBD00D;border-radius:10px;font:14px sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)';
var head=document.createElement('div');head.textContent=sets.length+' Sets, '+total+' Runden gelesen';head.style.cssText='font-weight:bold;margin-bottom:8px';
var ta=document.createElement('textarea');ta.value=out;ta.readOnly=true;ta.style.cssText='width:100%;height:80px;box-sizing:border-box;background:#0e0c0d;color:#9a9090;border:1px solid #3a3435;border-radius:6px;font:11px monospace';
var copy=document.createElement('button');copy.textContent='Kopieren';copy.style.cssText='margin-top:8px;padding:6px 14px;background:#FBD00D;color:#1a1718;border:0;border-radius:6px;font-weight:bold;cursor:pointer';
var close=document.createElement('button');close.textContent='Schließen';close.style.cssText='margin:8px 0 0 8px;padding:6px 14px;background:transparent;color:#9a9090;border:1px solid #3a3435;border-radius:6px;cursor:pointer';
copy.onclick=function(){var ok=function(){copy.textContent='Kopiert ✓'};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(out).then(ok,function(){ta.select();document.execCommand('copy');ok()})}else{ta.select();document.execCommand('copy');ok()}};
close.onclick=function(){box.remove()};
box.appendChild(head);box.appendChild(ta);box.appendChild(copy);box.appendChild(close);document.body.appendChild(box);
})();`
