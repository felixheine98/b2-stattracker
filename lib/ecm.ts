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

const isDnfTime = (time: string) => time.trim().toUpperCase() === "DNF"

interface RoundNote {
  // Number of the round, starting at 1
  round: number
  player: string
}

// eCircuitMania sometimes lists a round with a player too many or too few. Such rounds are brought
// to the usual length of the set where it is clear how:
// - too many: a DNF of a player without a finished time anywhere in the set is dropped
//   (someone who joined by mistake)
// - too few: players of the set (anyone with a finished time) missing from the round are added as
//   DNF on the last place
//   (a disconnect before the round was recorded)
// A round that cannot be repaired this way is left as it is.
export function repairEcmSet(set: EcmSet): { set: EcmSet; dropped: RoundNote[]; added: RoundNote[] } {
  const lengths = set.rounds.map((r) => r.length)
  // The usual number of players per round: the most frequent length, the smaller one on a tie
  const usual = [...new Set(lengths)].sort(
    (a, b) => lengths.filter((l) => l === b).length - lengths.filter((l) => l === a).length || a - b
  )[0]
  const finishers = new Set(set.rounds.flatMap((r) => r.filter((e) => !isDnfTime(e.t)).map((e) => e.p)))

  const dropped: RoundNote[] = []
  const added: RoundNote[] = []
  const rounds = set.rounds.map((entries, i) => {
    if (entries.length > usual) {
      const stray = entries.filter((e) => isDnfTime(e.t) && !finishers.has(e.p))
      if (entries.length - stray.length !== usual) return entries
      dropped.push(...stray.map((e) => ({ round: i + 1, player: e.p })))
      return entries.filter((e) => !stray.includes(e))
    }
    if (entries.length < usual) {
      const missing = [...finishers].filter((p) => !entries.some((e) => e.p === p))
      if (entries.length + missing.length !== usual) return entries
      added.push(...missing.map((p) => ({ round: i + 1, player: p })))
      return [...entries, ...missing.map((p) => ({ p, t: "DNF" }))]
    }
    return entries
  })
  return dropped.length + added.length > 0 ? { set: { ...set, rounds }, dropped, added } : { set, dropped, added }
}

// "Clin_TM" and "Clin", or "Joooooey" and "Jooooey", should be recognised as the same player
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/tm$/, "")
    .replace(/(.)\1+/g, "$1")
}

// Where the bookmarklet takes the data it has read: the import page of this app
export const ECM_IMPORT_PATH = "/ecm-import"

// The javascript: address to save as a bookmark; target is the full address of the import page
export function ecmBookmarkletUrl(target: string): string {
  return `javascript:${encodeURIComponent(ECM_BOOKMARKLET.replace("__ECM_TARGET__", target))}`
}

// The data the bookmarklet appended to the import page's address (base64url of the JSON), or null
export function decodeEcmFragment(fragment: string): string | null {
  const encoded = fragment.replace(/^#/, "")
  if (!encoded) return null
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
  } catch {
    return null
  }
}

// Handed from the import page to the match page, which opens the import dialog with it
export const ECM_PENDING_KEY = "ecm-pending-import"

// Plain ES5-style JavaScript on purpose: it runs as a bookmarklet on the eCircuitMania page.
// It relies on visible text and table structure only, not on their generated class names.
// When done it opens the import page of this app with the data in the address; only a match
// too large for that falls back to a window to copy the data from.
// The roster of a team is the first element with several children after its name; once a match
// has a result, the score sits between the two.
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
if(own(e)!==n||e.closest('table'))return false;
var sib=e.nextElementSibling;
while(sib&&sib.children.length<2)sib=sib.nextElementSibling;
if(sib){players=Array.prototype.map.call(sib.children,txt).filter(Boolean);return true}
return false});
return{name:n,players:players}});
var out=JSON.stringify({ecm:1,url:location.href,teams:teams,sets:sets});
var b64=btoa(unescape(encodeURIComponent(out))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
if(b64.length<60000){location.href='__ECM_TARGET__#'+b64;return}
var total=sets.reduce(function(a,x){return a+x.rounds.length},0);
var box=document.createElement('div');
box.style.cssText='position:fixed;z-index:2147483647;top:20px;right:20px;width:360px;padding:16px;background:#1c1819;color:#f5f0f0;border:1px solid #FBD00D;border-radius:10px;font:14px sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)';
var head=document.createElement('div');head.textContent=sets.length+' Sets, '+total+' Runden gelesen – zu viel für den direkten Weg, bitte kopieren und im Import einfügen';head.style.cssText='font-weight:bold;margin-bottom:8px';
var ta=document.createElement('textarea');ta.value=out;ta.readOnly=true;ta.style.cssText='width:100%;height:80px;box-sizing:border-box;background:#0e0c0d;color:#9a9090;border:1px solid #3a3435;border-radius:6px;font:11px monospace';
var copy=document.createElement('button');copy.textContent='Kopieren';copy.style.cssText='margin-top:8px;padding:6px 14px;background:#FBD00D;color:#1a1718;border:0;border-radius:6px;font-weight:bold;cursor:pointer';
var close=document.createElement('button');close.textContent='Schließen';close.style.cssText='margin:8px 0 0 8px;padding:6px 14px;background:transparent;color:#9a9090;border:1px solid #3a3435;border-radius:6px;cursor:pointer';
copy.onclick=function(){var ok=function(){copy.textContent='Kopiert ✓';setTimeout(function(){box.remove()},800)};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(out).then(ok,function(){ta.select();document.execCommand('copy');ok()})}else{ta.select();document.execCommand('copy');ok()}};
close.onclick=function(){box.remove()};
box.appendChild(head);box.appendChild(ta);box.appendChild(copy);box.appendChild(close);document.body.appendChild(box);
})();`
