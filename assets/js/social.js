/* Tulsa Surgical Arts — social embed layer (plug-and-play).
 *
 * HOW IT WORKS
 *  - Every social slot on the site is a normal, styled card that links to the real
 *    profile/post. With no network and no config it is already complete.
 *  - Platform embed markup is standard: TikTok = blockquote.tiktok-embed,
 *    Instagram = blockquote.instagram-media. When this file's autoload flag is on
 *    and the site is served over http(s), the official platform script is injected
 *    once and every blockquote on the page hydrates into the live embed.
 *  - To add a new embed anywhere: paste the platform's blockquote inside a
 *    div.soccard .scbody — no other change needed. See SOCIAL_EMBED_MAP.md.
 *
 * SWITCHBOARD */
window.TSA_SOCIAL = window.TSA_SOCIAL || {
  autoload: true,
  platforms: {
    tiktok:    { selector: '.tiktok-embed',    script: 'https://www.tiktok.com/embed.js' },
    instagram: { selector: '.instagram-media', script: 'https://www.instagram.com/embed.js',
                 after: function(){ if(window.instgrm&&instgrm.Embeds){instgrm.Embeds.process()} } }
  }
};
(function(){
  var cfg = window.TSA_SOCIAL;
  if(!cfg.autoload) return;
  if(!/^https?:$/.test(location.protocol)) return;   /* file:// review stays card-only */
  var loaded = {};
  function boot(){
    Object.keys(cfg.platforms).forEach(function(k){
      var p = cfg.platforms[k];
      if(loaded[k] || !document.querySelector(p.selector)) return;
      loaded[k] = true;
      var s = document.createElement('script');
      s.src = p.script; s.async = true;
      if(p.after) s.onload = p.after;
      document.body.appendChild(s);
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
