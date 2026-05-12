const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/v1/admin/request-otp', {}, {
      headers: {
        Authorization: 'Bearer <REPLACE_WITH_VALID_TOKEN>'
      }
    });
    console.log(res.data);
  } catch (err) {
    console.log(err.response ? err.response.status : err.message);
    console.log(err.response ? err.response.data : '');
  }
}

// test();
