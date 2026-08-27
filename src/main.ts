import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

// Offline support is a progressive enhancement, and it is production-only for the same
// reason GoogleAnalytics.svelte guards on `import.meta.env.PROD`: a service worker in dev
// would cache assets out from under Vite's HMR. Both the script URL and the scope come from
// BASE_URL so the worker controls the whole app under the GitHub Pages sub-path.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const registerServiceWorker = () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // A failed registration must never break the app; the user just stays online-only.
    })
  }
  // Wait for load so the install-time precache does not compete with the first render.
  if (document.readyState === 'complete') {
    registerServiceWorker()
  } else {
    window.addEventListener('load', registerServiceWorker, { once: true })
  }
}

export default app
