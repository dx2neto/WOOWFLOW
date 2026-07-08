// ==========================================================================
// Adaptador de compatibilidade: expõe a interface `base44` usada por toda a
// aplicação, porém 100% backed pelo Supabase. Isso permite migrar as telas
// gradualmente sem quebrar as que ainda importam `{ base44 }`.
//
// Telas novas/reescritas devem importar diretamente de:
//   - '@/lib/supabaseClient'  (cliente supabase)
//   - '@/api/supabaseData'    (entities, auth, functions)
// ==========================================================================
import {
  entities,
  auth,
  functions,
  connectors,
  agents,
} from '@/api/supabaseData'

export const base44 = {
  entities,
  auth,
  functions,
  connectors,
  agents,
}

export default base44
