// Runs before the character's scripts: the page is just a transparent stage for the fox's canvas.
// Hand the real animation timer to desktop.js and stub the global one, so nothing else starts a loop.
window.__realRAF = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = () => 0;
(() => {
  const css = `
    html, body { background: transparent !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
    body > *:not(#desk) { display: none !important; }
    #desk { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); display: block; transition: opacity .4s; }
    html[data-look="float"] #desk { filter: drop-shadow(0 0 1px rgba(0,0,0,.75)) drop-shadow(0 2px 3px rgba(0,0,0,.3)); }
    html[data-look="ink"] #desk { filter: drop-shadow(0 0 1px rgba(255,255,255,.6)); }
    html[data-look="glass"] #desk { filter: drop-shadow(0 4px 10px rgba(0,0,0,.35)); }`;
  const add = () => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); };
  if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add, { once: true });
})();
