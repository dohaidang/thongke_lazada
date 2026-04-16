// Main world script (Bypass CORS)
console.log('Lazada Stats Main World Initialized!');

// Ví dụ hàm gọi API
async function fetchLazadaOrder() {
  try {
    // Sẽ lấy x-csrf-token hoặc cấu hình auth của Lazada tại đây
    // vd: window.g_config...
    window.postMessage({
      type: 'FROM_MAIN_WORLD',
      payload: { status: 'ok', data: [] }
    }, '*');
  } catch (err) {
    console.error(err);
  }
}
