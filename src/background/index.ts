// Service Worker Background Script
console.log('Lazada Stats Background Worker Tải Thành Công!');

// Chứa logic db IndexedDB và lắng nghe message từ UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SCAN') {
    console.log('Bắt đầu scan dữ liệu...');
    sendResponse({ status: 'started' });
  }
});
