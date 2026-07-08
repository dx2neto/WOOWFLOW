import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;
const hasUrlAppId = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('app_id');
const hasBase44Config = Boolean(import.meta.env.VITE_BASE44_APP_ID || import.meta.env.VITE_BASE44_APP_BASE_URL || hasUrlAppId);

const missingConfigError = () => new Error(
  'Base44 não está configurado neste ambiente local. Defina VITE_BASE44_APP_ID e VITE_BASE44_APP_BASE_URL no .env.local ou rode pelo base44 dev.'
);

const unavailable = async () => {
  throw missingConfigError();
};

const unavailableProxy = new Proxy(unavailable, {
  get: () => unavailableProxy,
  apply: unavailable,
});

const createUnavailableClient = () => ({
  auth: {
    loginViaEmailPassword: unavailable,
    register: unavailable,
    verifyOtp: unavailable,
    resendOtp: unavailable,
    me: unavailable,
    isAuthenticated: async () => false,
    setToken: () => {},
    loginWithProvider: () => { throw missingConfigError(); },
    redirectToLogin: () => { throw missingConfigError(); },
    logout: () => {},
  },
  entities: unavailableProxy,
  functions: unavailableProxy,
  integrations: unavailableProxy,
  connectors: unavailableProxy,
  agents: unavailableProxy,
  aiGateway: unavailableProxy,
  appLogs: unavailableProxy,
  users: unavailableProxy,
  analytics: { track: () => {}, cleanup: () => {} },
  cleanup: () => {},
});

/** @type {any} */
const unavailableClient = createUnavailableClient();

//Create a client with authentication required
export const base44 = hasBase44Config ? createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
}) : unavailableClient;
