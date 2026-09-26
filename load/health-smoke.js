import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '10s',

  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200'],
  },
};

export default function () {
  const response = http.get('http://localhost:3000/health/live');

  check(response, {
    'status is 200': (res) => res.status === 200,
  });
}
