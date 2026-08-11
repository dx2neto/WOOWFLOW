import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

/**
 * Registra um erro no ErrorLog com contexto completo.
 *
 * Uso em backend functions (Deno):
 *
 *   import { logError } from '../../shared/errorLogger.ts';
 *
 *   try { ... }
 *   catch (err) {
 *     await logError(b44, 'zapsignApi', err, {
 *       action: 'create_from_ixc',
 *       context: { ixcCustomerId, templateId },
 *       severity: 'critica',
 *     });
 *     return Response.json({ error: (err as Error).message }, { status: 500 });
 *   }
 *
 * O contexto é serializado e truncado para 2000 chars para evitar campos muito grandes.
 */
export async function logError(
  b44: ReturnType<typeof createClientFromRequest>,
  functionName: string,
  error: unknown,
  opts: {
    action?: string;
    context?: Record<string, unknown>;
    severity?: 'baixa' | 'media' | 'alta' | 'critica';
  } = {},
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));

  let contextStr: string | undefined;
  if (opts.context) {
    try {
      contextStr = JSON.stringify(opts.context).slice(0, 2000);
    } catch {
      contextStr = '[contexto não serializável]';
    }
  }

  try {
    await b44.asServiceRole.entities.ErrorLog.create({
      function_name: functionName,
      action: opts.action || undefined,
      error_message: err.message.slice(0, 1000),
      stack_trace: err.stack?.slice(0, 4000) || undefined,
      error_context: contextStr,
      severity: opts.severity || 'alta',
    });
  } catch {
    // Se o log falhar, não devemos quebrar a função ainda mais
  }
}