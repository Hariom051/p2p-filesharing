export const app = {
  companyName: import.meta.env["VITE_COMPANY_NAME"],
  websocketUrl: import.meta.env["VITE_WEBSOCKET_URL"],
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
