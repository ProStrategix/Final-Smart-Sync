const axios = require('axios');

// Replace with your actual API key and endpoint
const API_KEY = 'IST.eyJraWQiOiJQb3pIX2FDMiIsImFsZyI6IlJTMjU2In0.eyJkYXRhIjoie1wiaWRcIjpcIjBiMzAxOWNjLWQ3YTMtNDFmMi04NjNiLTE1YmQzYjQwZDk2OFwiLFwiaWRlbnRpdHlcIjp7XCJ0eXBlXCI6XCJhcHBsaWNhdGlvblwiLFwiaWRcIjpcImJhZWEwMDM2LTk2NzctNDViMi05MDVhLWM5YjI3MWM1ZGYzM1wifSxcInRlbmFudFwiOntcInR5cGVcIjpcImFjY291bnRcIixcImlkXCI6XCJhYjlkNGQzNC1iMzcwLTQ2NzktYmVkZS0wOWYxNGNhMjhmYTFcIn19IiwiaWF0IjoxNzYwNDY3MzM1fQ.GZGOcmoNEZfOKoF_1atr2wKNgmUsHhRDziYAb8MdQxYoHAFguBwAw6lb8IE7YwJ64XuDqt5UPhUH8qlqQ8l-fEOCcCATRWMatLdH25bWN6q8mSNGEGKfQkej1lO4LcXkitNtIolQmqsOzLgejnThI9FDSGKV94cv-du0v0q6Of7VZZ_SNCS7j9UH-GsiCoQtoN4dfQQg5Q7Xbc5_MbxQQFyngvd2MfcmlVqOOUwOr7kfSusET8Ls3Sn4R3203o23-FhI8PMQWcZdnCVE6keuFuGNxIgPjIJJbwuDHBSkCdFQz3FMksfBHQa_VGtXHU2jkQCJ0-zaen3OeuFHpR7QHw';
const MCP_ENDPOINT = 'https://mcp.wix.com/sse/v1/some-endpoint'; // Replace with actual endpoint

async function testMCPConnection() {
  try {
    const response = await axios.get(MCP_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(response.data);
  } catch (error) {
    console.error('Error connecting to Wix MCP:', error);
  }
}

testMCPConnection();