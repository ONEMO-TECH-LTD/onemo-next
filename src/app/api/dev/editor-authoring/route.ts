import { handleGet, handlePost } from './handler'

export async function GET(req: Request) {
  return handleGet(req)
}

export async function POST(req: Request) {
  return handlePost(req)
}
