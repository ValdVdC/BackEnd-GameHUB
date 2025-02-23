const axios = require('axios');
const axiosRetry = require('axios-retry').default;

axiosRetry(axios, {
  retries: 5,
  retryCondition: (error) => (
    error.response?.status === 429 ||
    axiosRetry.isNetworkOrIdempotentRequestError(error)
  ),
  retryDelay: (retryCount, error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      return retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, retryCount) * 1000;
    }
    return axiosRetry.exponentialDelay(retryCount);
  },
  onRetry: (retryCount, error, requestConfig) => {
    console.warn(`Retry ${retryCount} for ${requestConfig.url}`);
  }
});

module.exports = axios;