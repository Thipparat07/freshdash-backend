/**
 * ส่ง Push Notification ผ่าน Expo Push API
 * @param {string} pushToken - Expo push token ของผู้รับ
 * @param {string} title
 * @param {string} body
 * @param {object} data - ข้อมูลเพิ่มเติม (optional)
 */
async function sendPush(pushToken, title, body, data = {}) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({ to: pushToken, title, body, data, sound: 'default' }),
    });
  } catch (err) {
    console.error('❌ Push notification error:', err.message);
  }
}

module.exports = { sendPush };
