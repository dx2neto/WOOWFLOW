import { supabase } from '@/lib/supabaseClient'

// ==========================================================================
// Camada de dados Supabase que expõe a MESMA interface do SDK base44
// (entities.<Entity>.list/filter/get/create/update/delete + auth + functions).
// Permite migrar tela a tela sem quebrar as páginas ainda não reescritas.
// ==========================================================================

// Mapeamento Entidade (PascalCase, como no base44) -> tabela (snake_case).
// Entidades sem tabela ainda criada caem no pluralizador padrão e retornam
// vazio de forma graciosa (a tabela ainda não existe nesta fase da migração).
const TABLE_MAP = {
  Plan: 'plans',
  Organization: 'organizations',
  PermissionProfile: 'permission_profiles',
  Profile: 'profiles',
  User: 'profiles',
  Customer: 'customers',
  Conversation: 'conversations',
  Message: 'messages',
  IntegrationLog: 'integration_logs',
  EvolutionInstance: 'evolution_instances',
}

// Tabelas com coluna organization_id: o create injeta o tenant automaticamente.
const ORG_SCOPED = new Set([
  'permission_profiles',
  'customers',
  'conversations',
  'messages',
  'integration_logs',
  'evolution_instances',
])

function toSnake(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}

// Pluralização simples suficiente para os nomes de entidades do projeto.
function pluralize(word) {
  if (/y$/.test(word)) return word.replace(/y$/, 'ies')
  if (/(s|x|z|ch|sh)$/.test(word)) return word + 'es'
  return word + 's'
}

function tableFor(entityName) {
  if (TABLE_MAP[entityName]) return TABLE_MAP[entityName]
  const snake = toSnake(entityName)
  return pluralize(snake)
}

// base44 usa created_date/updated_date; nossas tabelas usam created_at/updated_at.
function normalizeSortField(field) {
  if (field === 'created_date') return 'created_at'
  if (field === 'updated_date') return 'updated_at'
  return field
}

// Aliases para compatibilidade com telas que leem created_date/updated_date.
function decorateRow(row) {
  if (row && typeof row === 'object') {
    if ('created_at' in row && !('created_date' in row))
      row.created_date = row.created_at
    if ('updated_at' in row && !('updated_date' in row))
      row.updated_date = row.updated_at
  }
  return row
}

function decorate(rows) {
  if (Array.isArray(rows)) return rows.map(decorateRow)
  return decorateRow(rows)
}

// Erros de "tabela inexistente" não devem derrubar telas ainda não migradas.
function isMissingTable(error) {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist/i.test(error.message || '') ||
    /find the table/i.test(error.message || '')
  )
}

let cachedProfile = null

async function getCurrentProfile() {
  if (cachedProfile) return cachedProfile
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData?.session?.user?.id
  if (!uid) return null
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle()
  cachedProfile = data || null
  return cachedProfile
}

export function clearProfileCache() {
  cachedProfile = null
}

function applySort(query, sort) {
  if (!sort) return query
  const desc = sort.startsWith('-')
  const field = normalizeSortField(desc ? sort.slice(1) : sort)
  return query.order(field, { ascending: !desc })
}

function applyFilter(query, conditions = {}) {
  for (const [key, value] of Object.entries(conditions)) {
    if (value === undefined) continue
    if (Array.isArray(value)) query = query.in(key, value)
    else if (value === null) query = query.is(key, null)
    else query = query.eq(key, value)
  }
  return query
}

function makeEntity(entityName) {
  const table = tableFor(entityName)

  return {
    _table: table,

    async list(sort = '-created_at', limit = 1000) {
      let query = supabase.from(table).select('*')
      query = applySort(query, sort)
      if (limit) query = query.limit(limit)
      const { data, error } = await query
      if (error) {
        if (isMissingTable(error)) return []
        throw error
      }
      return decorate(data || [])
    },

    async filter(conditions = {}, sort = '-created_at', limit = 1000) {
      let query = supabase.from(table).select('*')
      query = applyFilter(query, conditions)
      query = applySort(query, sort)
      if (limit) query = query.limit(limit)
      const { data, error } = await query
      if (error) {
        if (isMissingTable(error)) return []
        throw error
      }
      return decorate(data || [])
    },

    async get(id) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) {
        if (isMissingTable(error)) return null
        throw error
      }
      return decorate(data)
    },

    async create(payload) {
      const record = { ...payload }
      if (ORG_SCOPED.has(table) && !record.organization_id) {
        const profile = await getCurrentProfile()
        if (profile?.organization_id)
          record.organization_id = profile.organization_id
      }
      const { data, error } = await supabase
        .from(table)
        .insert(record)
        .select()
        .maybeSingle()
      if (error) throw error
      return decorate(data)
    },

    async bulkCreate(items = []) {
      let records = items
      if (ORG_SCOPED.has(table)) {
        const profile = await getCurrentProfile()
        const org = profile?.organization_id
        records = items.map((it) =>
          it.organization_id ? it : { ...it, organization_id: org }
        )
      }
      const { data, error } = await supabase
        .from(table)
        .insert(records)
        .select()
      if (error) throw error
      return decorate(data || [])
    },

    async update(id, payload) {
      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle()
      if (error) throw error
      return decorate(data)
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      return { success: true }
    },

    // base44 expõe schema(); retornamos algo inócuo para compatibilidade.
    async schema() {
      return { name: entityName, table }
    },
  }
}

// Cria o objeto entities com todas as entidades conhecidas do projeto.
const ENTITY_NAMES = [
  'Agreement', 'AgreementInstallment', 'AgreementSettings', 'AgreementVerificationLog',
  'AuditLog', 'AutomationFlow', 'BusinessHours', 'Call', 'Campaign', 'Charge',
  'ChatbotFlow', 'ContractTemplate', 'Conversation', 'Customer', 'E1Gateway',
  'ErrorLog', 'Extension', 'Goal', 'Holiday', 'InboundRoute', 'IntegrationConfig',
  'IntegrationLog', 'KnowledgeArticle', 'Lead', 'Message', 'MessageTemplate',
  'NegotiationOfferLog', 'OutboundRoute', 'Profile', 'Queue', 'SignatureRequest',
  'SipTrunk', 'Tag', 'TelephonyQueue', 'UraMenu', 'User',
  // extras usados pela aplicação
  'Plan', 'Organization', 'PermissionProfile', 'EvolutionInstance',
]

export const entities = ENTITY_NAMES.reduce((acc, name) => {
  acc[name] = makeEntity(name)
  return acc
}, {})

// ==========================================================================
// Auth — mesma superfície usada pelas telas atuais.
// ==========================================================================
export const auth = {
  async me() {
    const { data: sessionData } = await supabase.auth.getSession()
    const authUser = sessionData?.session?.user
    if (!authUser) {
      const err = new Error('Not authenticated')
      err.status = 401
      throw err
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle()
    cachedProfile = profile || null
    return {
      id: authUser.id,
      email: authUser.email,
      full_name: profile?.full_name || authUser.email,
      role: profile?.role || 'agent',
      organization_id: profile?.organization_id || null,
      sector: profile?.sector || null,
      status: profile?.status || 'ativo',
      permission_profile_key: profile?.permission_profile_key || null,
      avatar_url: profile?.avatar_url || null,
      ...profile,
    }
  },

  async isAuthenticated() {
    const { data } = await supabase.auth.getSession()
    return !!data?.session
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    clearProfileCache()
    return data
  },

  async register({ email, password, ...meta }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
    })
    if (error) throw error
    return data
  },

  async verifyOtp({ email, otpCode, type = 'signup' }) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type,
    })
    if (error) throw error
    clearProfileCache()
    return { access_token: data?.session?.access_token, ...data }
  },

  async resendOtp(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) throw error
    return { success: true }
  },

  setToken() {
    // Supabase gerencia a sessão automaticamente; mantido por compatibilidade.
    return true
  },

  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/ResetPassword`,
    })
    if (error) throw error
    return { success: true }
  },

  async resetPassword({ newPassword }) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return { success: true }
  },

  async updateMyUserData(payload) {
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData?.session?.user?.id
    if (!uid) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', uid)
      .select()
      .maybeSingle()
    if (error) throw error
    clearProfileCache()
    return data
  },

  async loginWithProvider(provider, redirectTo = '/') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${redirectTo}` },
    })
    if (error) throw error
  },

  async logout(redirectUrl) {
    await supabase.auth.signOut()
    clearProfileCache()
    if (redirectUrl !== undefined) window.location.href = '/Login'
  },

  redirectToLogin() {
    window.location.href = '/Login'
  },
}

// ==========================================================================
// Functions — invoca Supabase Edge Functions (migração das funções Deno).
// ==========================================================================
export const functions = {
  async invoke(name, body) {
    const { data, error } = await supabase.functions.invoke(name, { body })
    if (error) throw error
    return { data }
  },
}

// Stubs para superfícies raramente usadas (evitam crash em telas legadas).
export const connectors = {
  async connectAppUser() {
    throw new Error('Conector não disponível nesta versão.')
  },
  async disconnectAppUser() {
    return { success: true }
  },
}

export const agents = {
  async listConversations() {
    return []
  },
  async getConversation() {
    return null
  },
}
