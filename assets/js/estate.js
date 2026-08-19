/* Tulsa Surgical Arts — site runtime. Production build 2026-08-19. */
(function(){
var mq = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* reveal-on-scroll: content is visible by default; motion is enhancement only */
if(!mq && 'IntersectionObserver' in window){
  var els=[].slice.call(document.querySelectorAll('.reveal'));
  els.forEach(function(el){el.classList.add('pre')});
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){e.target.classList.remove('pre');io.unobserve(e.target)}})},{threshold:.1});
  els.forEach(function(el){io.observe(el)});
  setTimeout(function(){els.forEach(function(el){el.classList.remove('pre')})},1200);
}

/* draggable before/after sliders — patient pixels untouched, pure clip-path */
document.querySelectorAll('.ba').forEach(function(ba){
  var inp=ba.querySelector('input'),aft=ba.querySelector('.aft'),bar=ba.querySelector('.bar'),knob=ba.querySelector('.knob');
  if(!inp||!aft||!bar||!knob)return;
  var set=function(v){aft.style.clipPath='inset(0 0 0 '+v+'%)';bar.style.left=v+'%';knob.style.left=v+'%'};
  inp.addEventListener('input',function(){set(inp.value)}); set(inp.value);
});

/* counters: real value is server-rendered in markup; animation is enhancement */
if(!mq){
  var cu=new IntersectionObserver(function(es){es.forEach(function(e){
    if(!e.isIntersecting)return;cu.unobserve(e.target);
    var el=e.target,t=parseFloat(el.dataset.count),sfx=el.dataset.sfx||'',pre=el.dataset.pre||'',dur=900,st=performance.now();
    var step=function(n){var p=Math.min(1,(n-st)/dur);
      el.textContent=pre+(t%1?(t*p).toFixed(1):Math.round(t*p).toLocaleString())+sfx;
      if(p<1)requestAnimationFrame(step)};
    requestAnimationFrame(step)});},{threshold:.6});
  document.querySelectorAll('[data-count]').forEach(function(el){cu.observe(el)});
}

/* mobile menu sheet with focus management */
var bg=document.querySelector('.burger'),sheet=document.querySelector('.sheet');
if(bg&&sheet){bg.setAttribute('aria-expanded','false');
bg.addEventListener('click',function(){sheet.classList.add('on');bg.setAttribute('aria-expanded','true');
  var c=sheet.querySelector('.x');c&&c.focus()});
var sx=sheet.querySelector('.x');
var closeSheet=function(){sheet.classList.remove('on');bg.setAttribute('aria-expanded','false');bg.focus()};
sx&&sx.addEventListener('click',closeSheet);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&sheet.classList.contains('on'))closeSheet()});}

/* click-to-play video facades (YouTube nocookie / TikTok outlink) — keyboard operable */
function playFac(v){var id=v.dataset.yt;if(!id){if(v.dataset.href)location.href=v.dataset.href;return}
  var w=v.parentElement;
  w.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0" title="Video player" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>'}
document.querySelectorAll('.vfac').forEach(function(v){
  v.addEventListener('click',function(){playFac(v)});
  v.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();playFac(v)}})});

/* per-zone filters — each .filterzone owns exactly its own items and counter (W15) */
document.querySelectorAll('.filterzone').forEach(function(zone){
  var chips=zone.querySelectorAll('.chip');if(!chips.length)return;
  var fc=zone.querySelector('.fcount');fc&&fc.setAttribute('role','status');
  chips.forEach(function(c){c.setAttribute('aria-pressed',c.classList.contains('on'));
  c.addEventListener('click',function(){
    chips.forEach(function(x){x.classList.remove('on');x.setAttribute('aria-pressed','false')});c.classList.add('on');c.setAttribute('aria-pressed','true');
    var f=c.dataset.f, items=zone.querySelectorAll('.fitem');
    items.forEach(function(g){g.classList.toggle('hide',f!=='all'&&(' '+g.dataset.tags+' ').indexOf(' '+f+' ')<0)});
    var n=[].filter.call(items,function(g){return !g.classList.contains('hide')}).length;
    if(fc)fc.textContent=(n===1?'1 item shown':n+' items shown');
  })});
});


/* deep-filter anchors: gallery.html#f-body pre-activates that chip */
if(/^#f-[a-z]+$/.test(location.hash)){
  var chip=document.getElementById(location.hash.slice(1));
  if(chip&&chip.classList.contains('chip')){chip.click();}
}

/* skip link focus target */
document.querySelectorAll('a.skip').forEach(function(a){a.addEventListener('click',function(){
  var t=document.getElementById('main');if(t){t.setAttribute('tabindex','-1');t.focus({preventScroll:true})}})});

/* expandable dossiers scroll into view */
document.querySelectorAll('details.xd').forEach(function(d){
  d.addEventListener('toggle',function(){ if(d.open){d.scrollIntoView({behavior:'smooth',block:'nearest'})} });
});

/* analytics event stubs: every conversion action carries data-evt.
   Wire-up: set window.TSA_ANALYTICS = function(evt, el){ ... } (e.g. gtag) — nothing loads until then. */
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('[data-evt]');
  if(a&&typeof window.TSA_ANALYTICS==='function'){try{window.TSA_ANALYTICS(a.getAttribute('data-evt'),a)}catch(err){}}
});
})();
