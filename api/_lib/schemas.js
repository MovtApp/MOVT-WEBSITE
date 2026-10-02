/* BFF — validação de entrada (Zod). Objetos "strict": campo extra = rejeitado. */
import { z } from "zod";

// eslint-disable-next-line no-control-regex -- intencional: rejeita caracteres de controle no nome
const NO_CONTROL = /^[^\u0000-\u001f\u007f<>]*$/;

const email = z.string().trim().toLowerCase().max(254).pipe(z.email({ message: "E-mail inválido." }));
const anyPassword = z.string().min(1, "Informe a senha.").max(128);
const newPassword = z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128, "Senha muito longa.");
const code = z.string().trim().regex(/^\d{4,8}$/, "Código inválido.");
const digits = (v) => String(v).replace(/\D/g, "");

export function isValidCPF(v) {
  const d = digits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    if (((sum * 10) % 11) % 10 !== Number(d[len])) return false;
  }
  return true;
}

export function isValidCNPJ(v) {
  const d = digits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((acc, wi, i) => acc + Number(d[i]) * wi, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

// DD/MM/AAAA válida e com idade entre 18 e 120 anos
function isAdultBrDate(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return false;
  const [, d, mo, y] = m.map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return false;
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d)) age -= 1;
  return age >= 18 && age <= 120;
}

export const loginSchema = z.strictObject({ email, senha: anyPassword });

export const registerSchema = z
  .strictObject({
    nome: z.string().trim().min(2, "Informe seu nome.").max(120).regex(NO_CONTROL, "Nome inválido."),
    email,
    senha: newPassword,
    tipo_documento: z.enum(["CPF", "CNPJ"]),
    cpf_cnpj: z.string().max(20),
    data_nascimento: z.string().refine(isAdultBrDate, "É preciso ter 18 anos ou mais (data DD/MM/AAAA)."),
    telefone: z.string().max(20).refine((v) => /^\d{10,11}$/.test(digits(v)), "Telefone inválido."),
    acceptTerms: z.literal(true, { message: "É preciso aceitar os Termos de Uso." }),
    acceptPrivacy: z.literal(true, { message: "É preciso aceitar a Política de Privacidade." }),
  })
  .superRefine((v, ctx) => {
    const ok = v.tipo_documento === "CPF" ? isValidCPF(v.cpf_cnpj) : isValidCNPJ(v.cpf_cnpj);
    if (!ok) ctx.addIssue({ code: "custom", path: ["cpf_cnpj"], message: `${v.tipo_documento} inválido.` });
  });

export const recoveryRequestSchema = z.strictObject({ email });
export const recoveryVerifySchema = z.strictObject({ email, code });
export const recoveryResetSchema = z.strictObject({ email, code, newPassword });

export const trainingsQuerySchema = z.strictObject({
  specialty: z.enum(["musculacao", "funcional", "cardio", "yoga"]).optional(),
  daily: z.enum(["1"]).optional(),
});

// Primeiro erro → { error, field } amigável para o formulário
export function firstIssue(err) {
  const issue = err.issues?.[0];
  return { error: issue?.message || "Dados inválidos.", field: issue?.path?.[0] ? String(issue.path[0]) : undefined };
}

export { digits };
