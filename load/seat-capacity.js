import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { Rate, Trend } from 'k6/metrics';

const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || '30s';

const unexpectedRate = new Rate('unexpected_rate');
const holdDuration = new Trend('hold_duration');
const releaseDuration = new Trend('release_duration');

export const options = {
  vus: VUS,
  duration: DURATION,

  thresholds: {
    unexpected_rate: ['rate<0.01'],
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
      name: `Capacity Venue ${suffix}`,
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
      name: `Capacity Event ${suffix}`,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
    { headers },
  );

  if (eventResponse.status !== 201) {
    throw new Error(`Event creation failed: ${eventResponse.status}`);
  }

  const event = eventResponse.json();

  const eventSeatIds = [];

  for (let i = 1; i <= VUS; i++) {
    const seatResponse = http.post(
      `${BASE_URL}/venues/${venue.id}/seats`,
      JSON.stringify({
        section: `CAPACITY-${suffix}`,
        row: 'A',
        number: i,
      }),
      { headers },
    );

    if (seatResponse.status !== 201) {
      throw new Error(`Seat ${i} creation failed: ${seatResponse.status}`);
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
      throw new Error(
        `EventSeat ${i} creation failed: ${eventSeatResponse.status}`,
      );
    }

    eventSeatIds.push(eventSeatResponse.json().id);
  }

  return {
    eventSeatIds,
  };
}

export default function (data) {
  const index = exec.vu.idInTest - 1;

  const eventSeatId = data.eventSeatIds[index];

  const holdResponse = http.post(
    `${BASE_URL}/event-seats/${eventSeatId}/hold`,
    null,
  );

  holdDuration.add(holdResponse.timings.duration);

  const holdOk = holdResponse.status === 200 || holdResponse.status === 201;

  check(holdResponse, {
    'hold succeeded': () => holdOk,
  });

  if (!holdOk) {
    unexpectedRate.add(true);
    return;
  }

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

  check(releaseResponse, {
    'release succeeded': () => releaseOk,
  });

  unexpectedRate.add(!releaseOk);
}
