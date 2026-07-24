#!/usr/bin/env node
// score-page.js — standalone Node port of the Landing Copy Grader.
//
// The grade() function below is byte-identical to the one in grader.html
// (and to the live version at https://1h-money-store.vercel.app/grader).
// Same input → same score, always. No LLM, no API key, no dependencies.
//
// Usage:
//   node scripts/score-page.js <url>              # fetch page, extract hero, score it
//   node scripts/score-page.js --text "headline" "subhead" "cta"   # score raw text
//   node scripts/score-page.js <url> --json       # machine-readable output
//
// Hero-extraction method (canonical — this is the method used to build
// data/landing-pages-scores.csv):
//   1. GET the URL (redirects followed, 15s timeout, desktop UA).
//   2. Strip <script>/<style>/<noscript>/<svg>/<template> blocks and HTML comments.
//   3. headline  = text of the FIRST <h1>; fallback: og:title, then <title>.
//      If the h1 text is one phrase repeated N times (animated/duplicated
//      spans, e.g. marquee headlines), it is collapsed to a single instance.
//   4. subhead   = first <h2> or <p> AFTER the h1 with 20–400 chars of text,
//      skipping cookie/consent boilerplate.
//   5. cta       = text of the first <a> or <button> AFTER the h1 with 2–40 chars,
//      skipping non-CTA UI strings (skip-links, cookie/consent, sign-in/log-in,
//      "Home", "Menu", "Search", 2-letter language codes).
//   6. Pages whose total visible text is under 200 chars (JS-only render) are
//      rejected, not scored.
// Regex-based on purpose: deterministic, dependency-free, auditable.

'use strict';

/* ---------- scoring (identical to grader.html) ---------- */
var HYPE=['revolutionize','revolutionary','unlock','unleash','seamless','seamlessly','game-changer','game changer','game-changing','cutting-edge','cutting edge','next-level','next level','supercharge','effortless','effortlessly','elevate','empower','empowering','transform','transformative','best-in-class','world-class','state-of-the-art','robust','synergy','disruptive','innovative','innovation','leverage','harness','turbocharge','skyrocket','10x','paradigm','frictionless','bleeding-edge','holistic'];
var FILLER=['solutions','solution','platform','powerful','amazing','great','awesome','stuff','things','simply','just','very','really','stunning','beautiful','ultimate','premium','quality','value','experience','journey','ecosystem','suite','toolkit','all-in-one','one-stop'];
var WEAKCTA=['submit','learn more','click here','read more','get started','sign up','signup','continue','next','go','here','more info','discover','explore'];
function words(t){return (t.trim().match(/[A-Za-z0-9'-]+/g)||[]);}
function countHits(t,list){var l=' '+t.toLowerCase()+' ';var n=0;list.forEach(function(w){var re=new RegExp('(^|[^a-z])'+w.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&')+'([^a-z]|$)','g');var m=l.match(re);if(m)n+=m.length;});return n;}
function hasNumber(t){return /\d/.test(t);}
function emojiCount(t){return (t.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu)||[]).length;}

function grade(h,s,c){
  var all=(h+' '+s+' '+c);
  var dims=[];
  // 1. Anti-hype (25)
  var hype=countHits(all,HYPE), excl=(all.match(/!/g)||[]).length, emo=emojiCount(all);
  var caps=(words(h+' '+s).filter(function(w){return w.length>2 && w===w.toUpperCase() && /[A-Z]/.test(w);})).length;
  var antiPen=hype*7+excl*5+emo*4+caps*4;
  dims.push({key:'Anti-hype',max:25,score:Math.max(0,25-antiPen),notes:{hype:hype,excl:excl,emo:emo,caps:caps}});
  // 2. Specificity (25) — a concrete number / proof
  var spec=hasNumber(all)?25:8; if(/%|\bx\b|×|hours?|days?|minutes?|\bno\b|zero/i.test(all)&&spec<25)spec=Math.min(25,spec+9);
  dims.push({key:'Specificity',max:25,score:spec,notes:{number:hasNumber(all)}});
  // 3. Clarity (25) — low filler, plain
  var filler=countHits(all,FILLER);
  var clar=Math.max(0,25-filler*6);
  dims.push({key:'Clarity',max:25,score:clar,notes:{filler:filler}});
  // 4. Headline shape (13)
  var hw=words(h).length; var hlScore=13;
  if(hw===0)hlScore=0; else if(hw>12)hlScore=5; else if(hw>10)hlScore=9; else if(hw<3)hlScore=7;
  dims.push({key:'Headline shape',max:13,score:hlScore,notes:{words:hw}});
  // 5. CTA (12)
  var ctaW=c.trim().toLowerCase(); var weak=WEAKCTA.indexOf(ctaW)>=0 || ctaW==='';
  var ctaScore= c.trim()===''?0 : (weak?4:12);
  dims.push({key:'CTA',max:12,score:ctaScore,notes:{weak:weak,empty:c.trim()===''}});

  var total=dims.reduce(function(a,d){return a+d.score;},0);
  total=Math.round(total);
  var verdict = total>=80?'Reads human & sharp.' : total>=60?'Decent, but softening in places.' : total>=40?'Somewhat generic.' : 'This reads AI-generated.';
  var flags=[];
  if(hype>0)flags.push('hype');
  if(filler>0)flags.push('filler');
  if(weak&&c.trim()!=='')flags.push('weakcta');
  if(!hasNumber(all))flags.push('nonum');
  if(hw>12)flags.push('longhl');
  if(hw>0&&hw<3)flags.push('shorthl');
  if(excl>0)flags.push('excl');
  if(emo>0)flags.push('emoji');
  if(caps>0)flags.push('caps');
  return {total:total,verdict:verdict,dims:dims,flags:flags};
}

/* ---------- hero extraction ---------- */
var ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',mdash:'—',ndash:'–',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',hellip:'…',copy:'©',trade:'™',reg:'®',rarr:'→',times:'×'};
function decode(t){
  return t
    .replace(/&#x([0-9a-f]+);/gi,function(_,h){return String.fromCodePoint(parseInt(h,16));})
    .replace(/&#(\d+);/g,function(_,d){return String.fromCodePoint(parseInt(d,10));})
    .replace(/&([a-z]+);/gi,function(m,n){return ENT[n.toLowerCase()]!==undefined?ENT[n.toLowerCase()]:m;});
}
function textOf(inner){
  return decode(inner.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
}
function cleanHtml(html){
  return html
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi,' ');
}
function collapseRepeat(t){
  var w=t.split(' ');
  for(var n=4;n>=2;n--){
    if(w.length%n===0&&w.length/n>=2){
      var u=w.slice(0,w.length/n).join(' '),ok=true;
      for(var i=1;i<n;i++)if(w.slice(i*w.length/n,(i+1)*w.length/n).join(' ')!==u){ok=false;break;}
      if(ok)return u;
    }
  }
  return t;
}
function extractHero(html){
  var doc=cleanHtml(html);
  var h='',s='',c='',after=doc;
  var m=doc.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if(m && textOf(m[1])){ h=collapseRepeat(textOf(m[1])); after=doc.slice(m.index+m[0].length); }
  if(!h){
    var og=doc.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)||doc.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    if(og)h=decode(og[1]).trim();
  }
  if(!h){ var ti=doc.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i); if(ti)h=textOf(ti[1]); }
  // subhead: first h2 or p after the h1 with 20-400 chars
  var re=/<(h2|p)\b[^>]*>([\s\S]*?)<\/\1>/gi,mm;
  while((mm=re.exec(after))){ var t=textOf(mm[2]); if(t.length>=20&&t.length<=400&&!/cookie|consent|privacy policy/i.test(t)){ s=t; break; } }
  // cta: first a/button after the h1 with 2-40 chars of text
  var NOTCTA=/^(skip |cookie|manage |accept|reject|privacy|sign in|log ?in|home$|menu$|search$)/i;
  var rc=/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/gi,mc;
  while((mc=rc.exec(after))){ var tc=textOf(mc[2]); if(tc.length>=2&&tc.length<=40&&!NOTCTA.test(tc)&&!/^[A-Z]{2}$/.test(tc)){ c=tc; break; } }
  var totalText=textOf(doc.replace(/<head\b[\s\S]*?<\/head>/i,' '));
  return {h:h,s:s,c:c,totalChars:totalText.length};
}

/* ---------- CLI ---------- */
async function fetchPage(url){
  var ctrl=new AbortController(); var to=setTimeout(function(){ctrl.abort();},15000);
  try{
    var r=await fetch(url,{redirect:'follow',signal:ctrl.signal,headers:{
      'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'Accept':'text/html,application/xhtml+xml',
      'Accept-Language':'en-US,en;q=0.9'
    }});
    if(!r.ok)throw new Error('HTTP '+r.status);
    return await r.text();
  } finally { clearTimeout(to); }
}

async function main(){
  var args=process.argv.slice(2);
  var json=args.includes('--json'); args=args.filter(function(a){return a!=='--json';});
  if(args[0]==='--text'){
    var R=grade(args[1]||'',args[2]||'',args[3]||'');
    console.log(json?JSON.stringify(R):R.total+'/100 — '+R.verdict+(R.flags.length?'  ['+R.flags.join(',')+']':''));
    return;
  }
  var url=args[0];
  if(!url){ console.error('usage: score-page.js <url> [--json] | --text <headline> <subhead> <cta>'); process.exit(1); }
  var html=await fetchPage(url);
  var hero=extractHero(html);
  if(hero.totalChars<200){ console.error('REJECT: page renders <200 chars of text without JS ('+hero.totalChars+')'); process.exit(2); }
  var R=grade(hero.h,hero.s,hero.c);
  if(json){ console.log(JSON.stringify({url:url,hero:hero,result:R})); return; }
  console.log('headline: '+hero.h+'\nsubhead : '+hero.s+'\ncta     : '+hero.c);
  console.log('score   : '+R.total+'/100 — '+R.verdict+(R.flags.length?'  ['+R.flags.join(',')+']':''));
}

if(require.main===module)main().catch(function(e){console.error(String(e&&e.message||e));process.exit(1);});
module.exports={grade:grade,extractHero:extractHero,fetchPage:fetchPage};
