import axios from 'axios'

import {getEnv} from '@src/env'

/**
 * Configured axios instance for the Eivu upload API
 * Pre-configured with base URL, authentication, and request parameters
 */
const env = getEnv()
const api = axios.create({
  baseURL: env.EIVU_UPLOAD_SERVER_HOST + '/api/upload/v1/buckets/' + env.EIVU_BUCKET_UUID + '/',
  headers: {
    Authorization: 'Token ' + env.EIVU_USER_TOKEN,
    'Content-Type': 'application/json',
  },
  params: {
    keyFormat: 'camel_lower',
  },
})

export default api
