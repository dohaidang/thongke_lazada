// Content Script
console.log('Lazada Stats Content Script Injected!');

// Lấy URL của main-world script từ extension namespace
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/content/main-world.ts');
script.type = 'module';
document.head.appendChild(script);

// Lắng nghe dữ liệu gửi từ main world
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data.type && event.data.type === 'FROM_MAIN_WORLD') {
    console.log('Content Script nhận data:', event.data.payload);
  }
});
