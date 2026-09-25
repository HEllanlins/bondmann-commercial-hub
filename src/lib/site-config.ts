/**
 * Dados institucionais da Bondmann.
 *
 * ATENÇÃO: os valores `null` ainda NÃO foram fornecidos oficialmente.
 * Enquanto forem `null`, a interface mostra um aviso "a definir" em vez de
 * inventar telefone, e-mail, endereço ou redes sociais.
 */
export const SITE = {
  name: "Bondmann Química",
  phone: null as string | null,
  whatsapp: null as string | null, // somente números com DDI, ex.: 5511999999999
  email: null as string | null,
  address: null as string | null,
  city: null as string | null,
  instagram: null as string | null,
  linkedin: null as string | null,
  facebook: null as string | null,
};

export const PLACEHOLDER = "A definir";

export const SEGMENTS = [
  { slug: "agro", name: "Agro", text: "Soluções químicas para operações do campo e do agronegócio." },
  { slug: "automotivo", name: "Automotivo", text: "Linha para limpeza, manutenção e conservação automotiva." },
  { slug: "industrial", name: "Industrial", text: "Produtos para processos, manutenção e limpeza industrial." },
  { slug: "metalurgia", name: "Metalurgia", text: "Tratamento, desengraxe e proteção de superfícies metálicas." },
  { slug: "construcao", name: "Construção", text: "Soluções para obras, acabamento e manutenção predial." },
  { slug: "limpeza-higiene", name: "Limpeza e Higiene", text: "Linha profissional para limpeza e higienização." },
  { slug: "tratamento-agua", name: "Tratamento de Água", text: "Produtos para tratamento e condicionamento de água." },
] as const;
