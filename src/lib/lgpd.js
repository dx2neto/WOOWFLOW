/**
 * Utilitários LGPD para mascaramento de dados sensíveis.
 *
 * maskCpfCnpj: mascara CPF/CNPJ para exibição, mostrando apenas os 2 últimos dígitos.
 *   CPF  -> asteriscos.asteriscos.asteriscos-45
 *   CNPJ -> asteriscos.asteriscos.asteriscos/asteriscos-45
 *
 * Uso:
 *   import { maskCpfCnpj } from "@/lib/lgpd";
 *   maskCpfCnpj(customer.cpf_cnpj)
 */
export function maskCpfCnpj(doc) {
  if (!doc) return "";
  const digits = String(doc).replace(/\D/g, "");
  if (digits.length === 11) {
    return "***.***.***-" + digits.slice(-2);
  }
  if (digits.length === 14) {
    return "**.***.***/****-" + digits.slice(-2);
  }
  if (digits.length >= 2) {
    return "***.***.***-" + digits.slice(-2);
  }
  return "***";
}