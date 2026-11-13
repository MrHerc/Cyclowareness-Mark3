/**
 * The offline page's only script. It runs inline with the request's CSP nonce, because the chunks a client
 * component would need may not be cached. It
 * - shows the text in the language of the `locale` cookie, with its direction;
 * - tells the two failures apart: navigator.onLine is false only when the device has no network at all, so
 *   otherwise the server did not answer (stopped, restarting, or blocked) and the page must not say "offline";
 * - reloads the page as soon as /api/health answers, so nobody has to press a button after a restart; a reload
 *   that lands here again within 15 seconds waits 15 seconds before the next try instead of looping;
 * - makes the retry button work even when React never hydrates.
 */
export function offlineScript(localeCookie: string): string {
  return `(function(){
var d=document,i,m=d.cookie.match(/(?:^|;\\s*)${localeCookie}=([^;]+)/),l=m&&m[1],b=d.querySelectorAll("[data-offline-locale]"),f=null;
for(i=0;i<b.length;i++)if(b[i].getAttribute("data-offline-locale")===l)f=b[i];
if(f){for(i=0;i<b.length;i++)b[i].hidden=b[i]!==f;d.documentElement.lang=l;d.documentElement.dir=f.dir;}
function show(){var s=navigator.onLine===false?"offline":"server",x=d.querySelectorAll("[data-offline-state]"),k;for(k=0;k<x.length;k++)x[k].hidden=x[k].getAttribute("data-offline-state")!==s;}
var K="cy-offline-reload",last=0,t=null;try{last=Number(sessionStorage.getItem(K))||0;}catch(e){}
function poll(ms){clearTimeout(t);t=setTimeout(function(){fetch("/api/health",{cache:"no-store"}).then(function(r){if(!r.ok)throw r.status;try{sessionStorage.setItem(K,String(Date.now()));}catch(e){}location.reload();}).catch(function(){poll(5000);});},ms);}
show();
addEventListener("offline",show);
addEventListener("online",function(){show();poll(0);});
d.addEventListener("click",function(e){var g=e.target;if(g&&g.closest&&g.closest("[data-offline-retry]"))location.reload();});
poll(Date.now()-last<15000?15000:3000);
})();`;
}
