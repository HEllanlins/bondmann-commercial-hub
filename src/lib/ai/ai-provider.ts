/**
 * Camada de IA desacoplada.
 *
 * O frontend conversa apenas com esta interface. Trocar o provedor
 * (gratuito para testes hoje, OpenAI no futuro) acontece na implementação
 * do lado do servidor, sem alterar as telas.
 */

export type AiAssistant = "comercial" | "cliente";

export type AiMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AiReply = {
  content: string;
  /** false quando o provedor ainda não está configurado. */
  available: boolean;
};

export interface AiProvider {
  readonly id: string;
  send(input: { assistant: AiAssistant; messages: AiMessage[] }): Promise<AiReply>;
}

/** Provedor padrão desta etapa: responde que a IA ainda não foi ativada. */
export const notConfiguredProvider: AiProvider = {
  id: "nao-configurado",
  async send() {
    return {
      available: false,
      content:
        "O assistente da Bondmann ainda não foi ativado. A estrutura já está pronta e será conectada na próxima etapa.",
    };
  },
};

let currentProvider: AiProvider = notConfiguredProvider;

export function setAiProvider(provider: AiProvider) {
  currentProvider = provider;
}

export function getAiProvider(): AiProvider {
  return currentProvider;
}

export function askAssistant(assistant: AiAssistant, messages: AiMessage[]): Promise<AiReply> {
  return getAiProvider().send({ assistant, messages });
}
