import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const unexpectedRate = new Rate('unexpected_rate');
const holdDuration = new Trend('hold_duration');
const releaseDuration = new Trend('release_duration');

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 409));

export const options = {
  stages: [
    { duration: '20s', target: 10 },
    { duration: '30s', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '20s', target: 50 },
    { duration: '20s', target: 0 },
  ],

  thresholds: {
    unexpected_rate: ['rate<0.01'],

    hold_duration: ['p(95)<300', 'p(99)<500'],

    release_duration: ['p(95)<300', 'p(99)<500'],
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
      name: `Load Venue ${suffix}`,
      city: 'Istanbul',
    }),
    { headers },
  );

  if (venueResponse.status !== 201) {
    throw new Error(`Venue creation failed: ${venueResponse.status}`);
  }

  const venue = venueResponse.json();

  const eventResponse = http.post(
    `${BASE_URL}/venues/${venue.id}/events`,
    JSON.stringify({
      name: `Load Event ${suffix}`,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
    { headers },
  );

  if (eventResponse.status !== 201) {
    throw new Error(`Event creation failed: ${eventResponse.status}`);
  }

  const event = eventResponse.json();

  const eventSeatIds = [];

  for (let i = 1; i <= 100; i++) {
    const seatResponse = http.post(
      `${BASE_URL}/venues/${venue.id}/seats`,
      JSON.stringify({
        section: 'LOAD',
        row: 'A',
        number: i,
      }),
      { headers },
    );

    if (seatResponse.status !== 201) {
      throw new Error(`Seat creation failed: ${seatResponse.status}`);
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
      throw new Error(`EventSeat creation failed: ${eventSeatResponse.status}`);
    }

    eventSeatIds.push(eventSeatResponse.json().id);
  }

  return {
    eventSeatIds,
  };
}

export default function (data) {
  const index = Math.floor(Math.random() * data.eventSeatIds.length);

  const eventSeatId = data.eventSeatIds[index];

  const holdResponse = http.post(
    `${BASE_URL}/event-seats/${eventSeatId}/hold`,
    null,
  );

  holdDuration.add(holdResponse.timings.duration);

  if (holdResponse.status === 200 || holdResponse.status === 201) {
    unexpectedRate.add(false);

    const body = holdResponse.json();
    const holdToken = body.holdToken;

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
  } else if (holdResponse.status === 409) {
    unexpectedRate.add(false);
  } else {
    unexpectedRate.add(true);
  }

  sleep(0.1);
}
