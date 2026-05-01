import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "5s", target: 10 },
    { duration: "15s", target: 50 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const adminToken = "ISI_TOKEN_ADMIN_KAMU_DI_SINI";

  const params = {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
  };

  // Nembak API Dashboard yang pake Promise.all tadi
  const res = http.get("http://localhost:5000/api/dashboard/main", params);

  check(res, {
    "Status 200 OK": (r) => r.status === 200,
    "Response cepat (< 200ms)": (r) => r.timings.duration < 200,
  });

  sleep(1);
}
