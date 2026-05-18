/**
 * คำนวณระยะทางระหว่างพิกัดละติจูดและลองจิจูด 2 จุด (Haversine Formula)
 * @param {number} lat1 Latitude ของจุดที่ 1
 * @param {number} lon1 Longitude ของจุดที่ 1
 * @param {number} lat2 Latitude ของจุดที่ 2
 * @param {number} lon2 Longitude ของจุดที่ 2
 * @returns {number} ระยะทางเป็นกิโลเมตร
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity; // ป้องกันพิกัดพังหรือไม่มีพิกัด

  const R = 6371; // รัศมีของโลกเป็นกิโลเมตร
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceKm = R * c;
  
  return distanceKm;
};

module.exports = {
  calculateDistance
};
