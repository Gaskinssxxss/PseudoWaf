class DDOSHandler {
  constructor(rateLimitThreshold = 100, rateLimitWindow = 30 * 1000) {
    this.rateLimitStore = new Map();
    this.rateLimitThreshold = rateLimitThreshold;
    this.rateLimitWindow = rateLimitWindow;
  }

  detect(clientIP) {
    const now = Date.now();

    if (!this.rateLimitStore.has(clientIP)) {
      this.rateLimitStore.set(clientIP, []);
    }

    const requestTimestamps = this.rateLimitStore.get(clientIP);

    requestTimestamps.push(now);

    const filteredTimestamps = requestTimestamps.filter(
      (timestamp) => now - timestamp <= this.rateLimitWindow
    );

    this.rateLimitStore.set(clientIP, filteredTimestamps);

    if (filteredTimestamps.length > this.rateLimitThreshold) {
      return `Indikasi DDoS terdeteksi untuk IP '${clientIP}' dengan ${
        filteredTimestamps.length
      } permintaan dalam ${this.rateLimitWindow / 1000} detik.`;
    }

    return null;
  }
}

module.exports = DDOSHandler;
