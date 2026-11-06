/**
 * GitHub 书库：把一个公开仓库当成书架用。
 *
 * 只做通路：列仓库里的 PDF / EPUB / TXT / MD，按需下载字节交给导入管线。
 * 不做任何内容筛选——仓库里是什么，由填仓库的人自己确认。
 */
import { ProviderError } from '../http.js'

const API = 'https://api.github.com'
const UA = 'Lamplit/0.1 (+https://github.com/lysforge/lamplit)'
const KIND_BY_EXT = { pdf: 'pdf', epub: 'epub', txt: 'txt', md: 'md', markdown: 'md' }
const MAX_BYTES = 120 * 1024 * 1024

/** `owner/repo` 或 `owner/repo#books/2020` → 规范化后的三段。 */
export function parseSpec(spec) {
  const raw = String(spec ?? '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '')
  const [repoPart, ...rest] = raw.split('#')
  const [owner, repo] = String(repoPart ?? '').split('/')
  if (!owner || !repo) throw new ProviderError('BADREQ', '仓库要写成 owner/repo，例如 mozilla/pdf.js。')
  return {
    owner,
    repo,
    path: rest.join('#').replace(/^\/+|\/+$/g, ''),
  }
}

export function specOf({ owner, repo, path }) {
  return path ? `${owner}/${repo}#${path}` : `${owner}/${repo}`
}

function headersFor(token) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': UA,
    'x-github-api-version': '2022-11-28',
  }
  if (token) headers.authorization = `Bearer ${token}`
  return headers
}

async function apiJson(url, token) {
  let response
  try {
    response = await fetch(url, { headers: headersFor(token), signal: AbortSignal.timeout(20000) })
  } catch (error) {
    throw new ProviderError('NET', `连不上 GitHub：${error?.message ?? String(error)}`)
  }
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    if (remaining === '0') {
      throw new ProviderError('RATE', 'GitHub 接口限额用完了（未登录 60 次/小时）。在设置里填一个 token，或等一小时。')
    }
  }
  if (response.status === 404) {
    throw new ProviderError('NOTFOUND', '找不到这个仓库或路径（私有仓库需要在设置里填 token）。', { status: 404 })
  }
  if (!response.ok) {
    throw new ProviderError('NET', `GitHub 返回 HTTP ${response.status}`)
  }
  return response.json()
}

const branchCache = new Map()

async function defaultBranch(owner, repo, token) {
  const key = `${owner}/${repo}`
  const hit = branchCache.get(key)
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.branch
  const payload = await apiJson(`${API}/repos/${owner}/${repo}`, token)
  const branch = String(payload?.default_branch ?? 'main')
  branchCache.set(key, { branch, at: Date.now() })
  return branch
}

function kindOf(filePath) {
  const ext = String(filePath).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
  return KIND_BY_EXT[ext] ?? ''
}

/**
 * 列出仓库文件。
 * @returns {Promise<{branch: string, files: Array<{path: string, name: string, size: number, kind: string}>, truncated: boolean}>}
 */
export async function listFiles({ owner, repo, path, token }) {
  const branch = await defaultBranch(owner, repo, token)
  const tree = await apiJson(`${API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, token)
  const prefix = path ? `${path.replace(/\/+$/, '')}/` : ''
  const files = []
  for (const node of Array.isArray(tree?.tree) ? tree.tree : []) {
    if (node.type !== 'blob') continue
    const filePath = String(node.path ?? '')
    if (prefix && !filePath.startsWith(prefix)) continue
    const kind = kindOf(filePath)
    if (kind === '') continue
    const size = Number(node.size) || 0
    if (size <= 0 || size > MAX_BYTES) continue
    files.push({
      path: filePath,
      name: filePath.slice(filePath.lastIndexOf('/') + 1),
      size,
      kind,
    })
  }
  files.sort((left, right) => left.path.localeCompare(right.path))
  return { branch, files: files.slice(0, 500), truncated: tree?.truncated === true }
}

/** 下载一个文件；Git LFS 指针会自动换到 media 端点。 */
export async function download({ owner, repo, branch, path, token }) {
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
  const headers = { 'user-agent': UA }
  if (token) headers.authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(base, { headers, signal: AbortSignal.timeout(60000) })
  } catch (error) {
    throw new ProviderError('NET', `下载失败：${error?.message ?? String(error)}`)
  }
  if (!response.ok) throw new ProviderError('NET', `下载失败：HTTP ${response.status}`)

  let buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_BYTES) throw new ProviderError('FORMAT', '这个文件超过 120MB。')

  if (isLfsPointer(buffer)) {
    const media = `https://media.githubusercontent.com/media/${owner}/${repo}/${branch}/${path}`
    try {
      const real = await fetch(media, { headers, signal: AbortSignal.timeout(120000) })
      if (!real.ok) throw new Error(`HTTP ${real.status}`)
      buffer = Buffer.from(await real.arrayBuffer())
    } catch (error) {
      throw new ProviderError('NET', '这个文件在 Git LFS 里，下载不下来说明仓库没有开 LFS 直链。')
    }
  }
  if (buffer.byteLength === 0) throw new ProviderError('FORMAT', '这个文件是空的。')
  return buffer
}

export function isLfsPointer(buffer) {
  const head = buffer.subarray(0, 120).toString('utf8')
  return head.startsWith('version https://git-lfs.github.com/spec/v1')
}
