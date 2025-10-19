export type AblyToken = {
  token?: string;
  expiresAt?: number; // ms epoch
  ok: boolean;
  stub?: boolean;
  message?: string;
};

export interface TokenService {
  getAblyToken(clientId: string): Promise<AblyToken>;
}
