import axios from 'axios'

const api = axios.create({
  baseURL: process.env.EIVU_SERVER_HOST + '/api/upload/v1/',
  headers: {
    Authorization: 'Token ' + process.env.EIVU_USER_TOKEN,
    'Content-Type': 'application/json',
  },
  params: {
    keyFormat: 'camel_lower',
  },
})

export default api
