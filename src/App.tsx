import { useState } from 'react';

function App() {
  const [status, setStatus] = useState('Idle');

  const startScan = () => {
    setStatus('Scanning...');
    chrome.runtime.sendMessage({ type: 'START_SCAN' }, (response) => {
      if (response && response.status === 'started') {
        setStatus('Scan Initialized');
      }
    });
  };

  return (
    <div className="p-4 flex flex-col items-center justify-center space-y-4">
      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/50">
        LZ
      </div>
      <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">
        Lazada Stats
      </h1>
      <p className="text-slate-400 text-sm">Status: <span className="text-white font-medium">{status}</span></p>
      
      <button 
        onClick={startScan}
        className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg font-semibold transition-all shadow-md active:scale-95"
      >
        Start Scan
      </button>
    </div>
  );
}

export default App;
