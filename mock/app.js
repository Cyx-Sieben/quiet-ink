/* Offline mock of firebase/app, used only by `npm run dev:mock`. */
export function initializeApp(config) {
  return { name: 'mock-app', options: config };
}
