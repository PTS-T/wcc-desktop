// Applies a custom browser-tab favicon from appConfig (set in WCC Backend → Public).
// appConfig.faviconMode = 'icon' | 'image' | '' ; faviconIcon (FA class), faviconColor, faviconImage (data URL).
(function () {
  function setIcon(href) {
    var ls = document.querySelectorAll("link[rel~='icon'],link[rel='shortcut icon']");
    for (var i = 0; i < ls.length; i++) { if (ls[i].parentNode) ls[i].parentNode.removeChild(ls[i]); }
    var l = document.createElement('link'); l.rel = 'icon'; l.href = href; document.head.appendChild(l);
  }
  function ensureFA(cb) {
    var have = false, ss = document.styleSheets || [];
    for (var i = 0; i < ss.length; i++) { var h = (ss[i].href || ''); if (h.indexOf('font-awesome') > -1 || h.indexOf('fontawesome') > -1) { have = true; break; } }
    if (!have && !document.getElementById('__fa_favicon_css')) {
      var l = document.createElement('link'); l.id = '__fa_favicon_css'; l.rel = 'stylesheet';
      l.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
      document.head.appendChild(l);
    }
    cb();
  }
  function apply() {
    try {
      var ac = (typeof appConfig !== "undefined") ? appConfig : {};
      if (ac.faviconMode === 'image' && ac.faviconImage) { setIcon(ac.faviconImage); return; }
      if (ac.faviconMode === 'icon' && ac.faviconIcon) {
        ensureFA(function () {
          var el = document.createElement('i'); el.className = ac.faviconIcon;
          el.style.cssText = 'position:absolute;left:-9999px;font-size:52px;';
          (document.body || document.documentElement).appendChild(el);
          var cs = getComputedStyle(el, '::before');
          var ch = (cs.content || '').replace(/^["']|["']$/g, '');
          var fam = cs.fontFamily || '"Font Awesome 6 Free"';
          var wght = cs.fontWeight || '900';
          if (el.parentNode) el.parentNode.removeChild(el);
          if (!ch || ch === 'none' || ch === 'normal') return;
          var draw = function () {
            var c = document.createElement('canvas'); c.width = c.height = 64;
            var x = c.getContext('2d'); x.clearRect(0, 0, 64, 64);
            x.font = wght + ' 52px ' + fam; x.textAlign = 'center'; x.textBaseline = 'middle';
            x.fillStyle = ac.faviconColor || '#111827'; x.fillText(ch, 32, 34);
            setIcon(c.toDataURL('image/png'));
          };
          if (document.fonts && document.fonts.load) {
            document.fonts.load(wght + ' 52px ' + fam).then(draw).catch(draw);
            document.fonts.ready.then(draw);
          } else { setTimeout(draw, 300); }
        });
      }
    } catch (e) { /* keep default favicon on any error */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
