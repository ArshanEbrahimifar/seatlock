import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { Rate, Trend } from 'k6/metrics';

const unexpectedRate = new Rate('unexpected_rate');
const holdDuration = new Trend('hold_duration');
const releaseDuration = new Trend('release_duration');

export const options = {
  stages: [
    { duration: '20s', target: 50 },
    { duration: '20s', target: 100 },
    { duration: '20s', target: 200 },
    { duration: '20s', target: 300 },
    { duration: '20s', target: 500 },
    { duration: '20s', target: 0 },
  ],

  thresholds: {
    unexpected_rate: ['rate<0.01'],
    hold_duration: ['p(95)<500', 'p(99)<1000'],
    release_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

const BASE_URL = 'http://localhost:3000';

const headers = {
  'Content-Type': 'application/json',
};

export function setup() {
  const suffix = Date.now();

  const venueResponse = http.post(
    `${BASE_URL}/venues`,
    JSON.stringify({
      name: `Stress Venue ${suffix}`,
      city: 'Istanbul',
    }),
    { headers },
  );

  if (venueResponse.status !== 201) {
    throw new Error(`Venue failed: ${venueResponse.status}`);
  }

  const venue = venueResponse.json();

  const eventResponse = http.post(
    `${BASE_URL}/venues/${venue.id}/events`,
    JSON.stringify({
      name: `Stress Event ${suffix}`,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
    { headers },
  );

  if (eventResponse.status !== 201) {
    throw new Error(`Event failed: ${eventResponse.status}`);
  }

  const event = eventResponse.json();

  const eventSeatIds = [];

  for (let i = 1; i <= 500; i++) {
    const seatResponse = http.post(
      `${BASE_URL}/venues/${venue.id}/seats`,
      JSON.stringify({
        section: 'STRESS',
        row: 'A',
        number: i,
      }),
      { headers },
    );

    if (seatResponse.status !== 201) {
      throw new Error(`Seat failed at ${i}`);
    }

    const seat = seatResponse.json();

    const eventSeatResponse = http.post(
      `${BASE_URL}/events/${event.id}/seats`,
      JSON.stringify({
        seatId: seat.id,
        price: 100,
      }),
      { headers },
    );

    if (eventSeatResponse.status !== 201) {
      throw new Error(`EventSeat failed at ${i}`);
    }

    eventSeatIds.push(eventSeatResponse.json().id);
  }

  return { eventSeatIds };
}

export default function (data) {
  const index = (exec.vu.idInTest - 1) % data.eventSeatIds.length;

  const eventSeatId = data.eventSeatIds[index];

  const holdResponse = http.post(
    `${BASE_URL}/event-seats/${eventSeatId}/hold`,
    null,
  );

  holdDuration.add(holdResponse.timings.duration);

  const holdOk = holdResponse.status === 200 || holdResponse.status === 201;

  if (!holdOk) {
    unexpectedRate.add(true);
    return;
  }

  unexpectedRate.add(false);

  const holdToken = holdResponse.json().holdToken;

  const releaseResponse = http.post(
    `${BASE_URL}/event-seats/${eventSeatId}/release`,
    JSON.stringify({
      holdToken,
    }),
    { headers },
  );

  releaseDuration.add(releaseResponse.timings.duration);

  const releaseOk =
    releaseResponse.status === 200 || releaseResponse.status === 201;

  unexpectedRate.add(!releaseOk);

  check(releaseResponse, {
    'release succeeded': () => releaseOk,
  });
}
