const path = require('path');

async function check() {
  const { Zalo } = await import('zca-js');
  const zalo = new Zalo({ selfListen: false, checkUpdate: false });
  try {
    const QR_PATH = path.join(__dirname, 'public/zalo-qr-test.png');
    console.log('Attempting login with saved session (via loginQR)...');
    const api = await zalo.loginQR({ qrPath: QR_PATH });
    
    console.log('Login successful! Fetching user 5305787729876041949...');
    const info1 = await api.getUserInfo('5305787729876041949');
    console.log(JSON.stringify(info1, null, 2));
    
    console.log('Fetching user 965238375481443387...');
    const info2 = await api.getUserInfo('965238375481443387');
    console.log(JSON.stringify(info2, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

check();
