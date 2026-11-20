self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
const scope = new URL(self.registration.scope);
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const prefix = scope.pathname + 'play/';
  if (url.origin !== scope.origin || !url.pathname.startsWith(prefix)) return;
  event.respondWith(serve(event.clientId, url.pathname.slice(prefix.length)));
});
async function serve(clientId, name) {
  const client = clientId && await self.clients.get(clientId);
  if (!client || !client.url.startsWith(scope.href)) return new Response(null, {status:403});
  const channel = new MessageChannel();
  const authorization = await new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), 3000);
    channel.port1.onmessage = ({data}) => {clearTimeout(timer);resolve(data);};
    client.postMessage({type:'game-file',name}, [channel.port2]);
  });
  channel.port1.close();
  if (!authorization) return new Response(null,{status:403});
  const response = await fetch(new URL(authorization.file, scope));
  if (!response.ok) return new Response(null,{status:response.status});
  const encrypted = new Uint8Array(await response.arrayBuffer());
  const bytes = await crypto.subtle.decrypt({name:'AES-GCM',iv:encrypted.subarray(0,12)},authorization.key,encrypted.subarray(12));
  const headers = {'Cache-Control':'no-store','Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':'application/octet-stream'};
  return new Response(bytes,{headers});
}
