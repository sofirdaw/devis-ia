import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  // Scénario de montée en charge progressive (Ramp-up)
  stages: [
    { duration: "10s", target: 50 }, // Montée à 50 utilisateurs
    { duration: "20s", target: 200 }, // Montée à 200 utilisateurs simultanés
    { duration: "20s", target: 500 }, // Montée à 500 utilisateurs simultanés
    { duration: "10s", target: 0 }, // Descente progressive
  ],
  thresholds: {
    http_req_duration: ["p(95)<300"], // 95% des requêtes doivent répondre en moins de 300ms
    http_req_failed: ["rate<0.01"], // Moins de 1% d'erreurs tolérées
  },
};

const BASE_URL = __ENV.TARGET_URL || "http://localhost:3000";

export default function k6LoadTest() {
  // 1. Test page d'accueil
  const resHome = http.get(`${BASE_URL}/`);
  check(resHome, {
    "status is 200 (Home)": (r) => r.status === 200,
    "page loads fast (<200ms)": (r) => r.timings.duration < 200,
  });

  // 2. Test Manifest PWA (mise en cache PWA)
  const resManifest = http.get(`${BASE_URL}/manifest.webmanifest`);
  check(resManifest, {
    "status is 200 (Manifest)": (r) => r.status === 200,
    "manifest loads fast (<100ms)": (r) => r.timings.duration < 100,
  });

  sleep(0.5);
}
