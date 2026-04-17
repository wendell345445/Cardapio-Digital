import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1'

const api = axios.create({ baseURL, withCredentials: true })

export interface CheckCustomerResult {
  exists: boolean
  name: string | null
  address: {
    zipCode?: string
    street?: string
    number?: string
    complement?: string | null
    neighborhood?: string
    city?: string
  } | null
}

export interface CustomerMeResult {
  whatsapp: string
  name: string | null
  address: CheckCustomerResult['address']
}

export async function checkCustomer(whatsapp: string): Promise<CheckCustomerResult> {
  const { data } = await api.get('/menu/customer/check', { params: { whatsapp } })
  return data.data
}

export async function requestOtp(whatsapp: string): Promise<void> {
  await api.post('/menu/customer/otp/request', { whatsapp })
}

export async function verifyOtp(whatsapp: string, code: string): Promise<void> {
  await api.post('/menu/customer/otp/verify', { whatsapp, code })
}

export async function getCustomerMe(): Promise<CustomerMeResult> {
  const { data } = await api.get('/menu/customer/me')
  return data.data
}

export async function logoutCustomer(): Promise<void> {
  await api.post('/menu/customer/logout')
}
