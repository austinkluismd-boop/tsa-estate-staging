/* Tulsa Surgical Arts — store runtime (bag + Stripe switchboard). */
(function(){
var CFG = window.TSA_STRIPE || {};
var bag = [];   /* in-memory by design: no cookies, no storage */
var drawer = document.querySelector('.bagdrawer'), pill = document.querySelector('.bagpill');
var list = document.querySelector('.bagitems'), count = document.querySelector('.bagcount');
if(!drawer || !pill) return;

function stripeFor(sku, kind){ return (kind==='sub' ? CFG.subscriptionLinks : CFG.paymentLinks)[sku] || ""; }
function render(){
  count.textContent = bag.length;
  pill.classList.toggle('on', bag.length > 0);
  list.innerHTML = '';
  bag.forEach(function(it, i){
    var row = document.createElement('div'); row.className = 'bagrow';
    var link = stripeFor(it.sku, it.kind);
    row.innerHTML = '<b>'+it.name+'</b>'+(it.kind==='sub'?' <i>· refill subscription</i>':'')+
      '<span><a href="'+(link || it.url)+'" target="_blank" rel="noopener">'+(link?'Checkout →':'Buy on the practice store →')+'</a>'+
      ' <button class="bagrm" data-i="'+i+'" aria-label="Remove '+it.name+'">Remove</button></span>';
    list.appendChild(row);
  });
  var note = document.querySelector('.bagnote');
  if(note) note.textContent = bag.length === 0 ? 'Your bag is empty — every product below is one tap away.' :
    (Object.keys(CFG.paymentLinks||{}).length ? 'Checkout is powered by Stripe.' :
     'Each item checks out securely on the practice’s own store — one tap per item.');
}
document.addEventListener('click', function(e){
  var add = e.target.closest && e.target.closest('[data-addbag]');
  if(add){ bag.push({sku: add.getAttribute('data-addbag'), name: add.getAttribute('data-name'),
                     url: add.getAttribute('data-url'), kind: add.getAttribute('data-kind')||'one'});
           render(); drawer.classList.add('on'); return; }
  if(e.target.closest && e.target.closest('.bagpill')){ drawer.classList.toggle('on'); return; }
  if(e.target.closest && e.target.closest('.bagclose')){ drawer.classList.remove('on'); return; }
  var rm = e.target.closest && e.target.closest('.bagrm');
  if(rm){ bag.splice(parseInt(rm.getAttribute('data-i'),10),1); render(); }
});
document.addEventListener('keydown', function(e){ if(e.key==='Escape') drawer.classList.remove('on'); });
render();
})();
