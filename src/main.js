import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// Lock body scroll while a modal is open (CheckoutModal etc.)
window.addEventListener('dp:scroll-lock', (e) => {
  document.body.style.overflow = e.detail ? 'hidden' : ''
})

createApp(App).mount('#app')